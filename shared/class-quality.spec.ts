import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CLASS_QUALITY, initialLadder, LadderState, ladderCapabilities, precheckVerdict, reconnectDelayMs, reduceLadder, targetStep, teacherGridPage, viewerVideoTiles } from './class-quality';

const good = { downKbps: 4000, lossPct: 0, rttMs: 80 };
const mid = { downKbps: 800, lossPct: 2, rttMs: 200 };
const poor = { downKbps: 150, lossPct: 5, rttMs: 500 };
const awful = { downKbps: 20, lossPct: 40, rttMs: 3000 };

function run(samples: [number, any][], start?: LadderState) {
  let s = start ?? initialLadder(0);
  const steps: number[] = [];
  for (const [at, sample] of samples) {
    s = reduceLadder(s, { type: 'sample', at, sample }).state;
    steps.push(s.step);
  }
  return { s, steps };
}

describe('class quality engine (pure)', () => {
  it('config: ladder requirements are ordered from best to worst and layers are ascending', () => {
    const r = CLASS_QUALITY.ladder.requirements;
    for (let i = 1; i < r.length; i++) {
      assert.ok(r[i].minDownKbps < r[i - 1].minDownKbps);
      assert.ok(r[i].maxLossPct > r[i - 1].maxLossPct);
    }
    const h = CLASS_QUALITY.teacherLayers.map((l) => l.height);
    assert.deepEqual(h, [...h].sort((a, b) => a - b));
    assert.equal(CLASS_QUALITY.teacherLayers.length, 3);
    assert.ok(CLASS_QUALITY.pupilVideo.maxFps <= 20 && CLASS_QUALITY.pupilVideo.maxHeight <= 360);
    assert.ok(CLASS_QUALITY.maxVideoViewsMobile <= 4);
    assert.equal(CLASS_QUALITY.viewerTiles, 3);
  });

  it('target step follows bandwidth, loss and rtt', () => {
    assert.equal(targetStep(good), 0);
    assert.equal(targetStep(mid), 1);
    assert.equal(targetStep(poor), 2);
    assert.equal(targetStep(awful), 3);
    assert.equal(targetStep({ downKbps: 4000, lossPct: 12, rttMs: 80 }), 2, 'heavy loss beats high bandwidth');
    assert.equal(targetStep({ downKbps: 4000, lossPct: 0, rttMs: 900 }), 2, 'huge rtt');
  });

  it('degrades only after two bad samples, then recovers one step at a time after a stable period (no flapping)', () => {
    let { s, steps } = run([[1000, good], [2000, poor], [3000, good], [4000, poor]]);
    assert.deepEqual(steps, [0, 0, 0, 0], 'single blips are ignored');
    ({ s, steps } = run([[1000, poor], [2000, poor]]));
    assert.deepEqual(steps, [0, 2], 'two bad samples drop straight to the matching step');
    const r = run([[3000, good], [10_000, good], [17_000, good]], s);
    assert.deepEqual(r.steps, [2, 2, 2], 'not yet stable for 15 s');
    const r2 = run([[18_500, good]], r.s);
    assert.deepEqual(r2.steps, [1], 'one step up, not straight to FULL');
    const r3 = run([[19_000, good], [33_000, good]], r2.s);
    assert.deepEqual(r3.steps, [1, 1]);
    assert.equal(run([[34_500, good]], r3.s).s.step, 0, 'second step after another stable period');
    const flap = run([[100_000, good], [101_000, poor], [102_000, good], [103_000, poor], [104_000, good]], run([[0, poor], [1, poor]]).s);
    assert.ok(flap.steps.every((x) => x === 2));
  });

  it('manual override caps the step and the banner follows', () => {
    const m = reduceLadder(initialLadder(0), { type: 'manual', at: 10, cap: 2 });
    assert.equal(m.state.step, 2);
    assert.equal(m.banner, 'audio_only');
    const r = run([[20, good], [40_000, good], [80_000, good]], m.state);
    assert.deepEqual(r.steps, [2, 2, 2], 'a great network does not lift the manual cap');
    const cleared = reduceLadder(r.s, { type: 'manual', at: 90_000, cap: null });
    assert.equal(cleared.state.manualCap, null);
    assert.equal(reduceLadder(initialLadder(0), { type: 'manual', at: 1, cap: 3 }).banner, 'slides_only');
    assert.equal(reduceLadder(initialLadder(0), { type: 'sample', at: 1, sample: good }).banner, null);
  });

  it('capabilities: audio outranks video at every step; slides always on', () => {
    assert.deepEqual([0, 1, 2, 3].map((s) => ladderCapabilities(s as any).teacherVideo), [true, true, false, false]);
    assert.equal(ladderCapabilities(0).preferredLayer, 'high');
    assert.equal(ladderCapabilities(1).preferredLayer, 'low');
    for (const s of [0, 1, 2] as const) assert.equal(ladderCapabilities(s).audio, true);
    for (const s of [0, 1, 2, 3] as const) assert.equal(ladderCapabilities(s).slides, true);
  });

  it('tile policy: teacher plus at most 3 more video tiles, none below LOWER, never more than 4 views', () => {
    const base = { teacherId: 'T', spotlightId: 'S', activeSpeakers: ['A', 'B', 'C', 'D', 'S', 'T'] };
    assert.deepEqual(viewerVideoTiles({ ...base, step: 0 }), ['T', 'S', 'A', 'B']);
    assert.deepEqual(viewerVideoTiles({ ...base, step: 0, viewerTiles: 1 }), ['T', 'S']);
    assert.deepEqual(viewerVideoTiles({ ...base, step: 0, viewerTiles: 50 }), ['T', 'S', 'A', 'B'], 'capped by the mobile view limit');
    assert.deepEqual(viewerVideoTiles({ ...base, step: 1 }), ['T', 'S']);
    assert.deepEqual(viewerVideoTiles({ ...base, step: 2 }), []);
    assert.deepEqual(viewerVideoTiles({ ...base, spotlightId: null, step: 0 }), ['T', 'A', 'B', 'C']);
    const g = teacherGridPage(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'], 2);
    assert.deepEqual(g.ids, ['9', '10']);
    assert.equal(g.pages, 3);
    assert.deepEqual(teacherGridPage([], 5), { ids: [], pages: 1 });
    assert.equal(teacherGridPage(Array.from({ length: 30 }, (_, i) => String(i)), 0, 50).ids.length, 4, 'page size cannot exceed the view limit');
  });

  it('pre-call verdict and the teacher upload warning', () => {
    assert.equal(precheckVerdict({ downMbps: 5, upMbps: 5, rttMs: 60, isTeacher: false }).verdict, 'good');
    assert.equal(precheckVerdict({ downMbps: 1, upMbps: null, rttMs: 60, isTeacher: false }).verdict, 'weak');
    assert.equal(precheckVerdict({ downMbps: 5, upMbps: 5, rttMs: 800, isTeacher: false }).verdict, 'weak', 'a slow round trip is weak even with bandwidth');
    assert.equal(precheckVerdict({ downMbps: 0.2, upMbps: 1, rttMs: 60, isTeacher: false }).verdict, 'audio_only');
    assert.equal(precheckVerdict({ downMbps: 9, upMbps: 2, rttMs: 40, isTeacher: true }).teacherUploadLow, true);
    assert.equal(precheckVerdict({ downMbps: 9, upMbps: 8, rttMs: 40, isTeacher: true }).teacherUploadLow, false);
    assert.equal(precheckVerdict({ downMbps: 9, upMbps: null, rttMs: 40, isTeacher: true }).teacherUploadLow, true, 'unknown upload is treated as low');
    assert.equal(precheckVerdict({ downMbps: 9, upMbps: 1, rttMs: 40, isTeacher: false }).teacherUploadLow, false, 'pupils are not asked for upload');
  });

  it('reconnect delays back off and are capped; resync list covers every state a late joiner needs', () => {
    assert.deepEqual([0, 1, 2, 3, 4, 20].map(reconnectDelayMs), [1000, 2000, 4000, 8000, 8000, 8000]);
    for (const k of ['permissions', 'stage', 'presentation', 'whiteboard', 'chat', 'questions']) assert.ok((CLASS_QUALITY.resync as readonly string[]).includes(k), k);
  });

  it('mobile/src/call/class-quality.ts is identical to shared/class-quality.ts', () => {
    const a = readFileSync(join(__dirname, 'class-quality.ts'), 'utf8').replace(/\r\n/g, '\n');
    const b = readFileSync(join(__dirname, '..', 'mobile', 'src', 'call', 'class-quality.ts'), 'utf8').replace(/\r\n/g, '\n');
    assert.equal(a, b);
  });
});
