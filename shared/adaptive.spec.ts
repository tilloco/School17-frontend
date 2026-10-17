import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { AdaptiveController, budgetKbps, CallContext, CAMERA_TIERS, choose, LinkSample, remoteCameraFor, SCREEN_TIERS } from '../mobile/src/call/adaptive';

const both: CallContext = { screenOn: true, cameraOn: true, remoteScreenOn: false };
const camOnly: CallContext = { screenOn: false, cameraOn: true, remoteScreenOn: false };

/** Feeds samples (2 s apart) and returns the last plan state. */
function run(c: AdaptiveController, samples: LinkSample[], ctx: CallContext, t0 = 0) {
  let now = t0;
  const plans: ReturnType<AdaptiveController['update']>[] = [];
  for (const s of samples) {
    now += 2000;
    plans.push(c.update(s, ctx, now));
  }
  return { plans, now, last: plans.filter(Boolean).slice(-1)[0] };
}
const rep = (n: number, s: LinkSample) => Array.from({ length: n }, () => s);

describe('adaptive call quality', () => {
  it('plenty of bandwidth: sharp screen and a sharp face', () => {
    const { last } = run(new AdaptiveController(), rep(24, { availKbps: 9000, rttMs: 40, lossPct: 0 }), both);
    assert.ok(last, 'a plan was made');
    assert.equal(last!.screen!.id, 0);
    assert.equal(last!.camera.id, 0);
  });

  it('the screen keeps its resolution and the face gives way first', () => {
    for (const kbps of [6000, 3000, 2000, 1200, 900, 700, 500, 300]) {
      const { cam, screen } = choose(budgetKbps(kbps), both);
      assert.ok(SCREEN_TIERS[screen].label.startsWith('1080p'), `screen stays 1080p at ${kbps}`);
      // the screen never ends up on a lower tier than the face when the budget is tight
      assert.ok(cam >= Math.min(screen, 4) - 1 || CAMERA_TIERS[cam].layer !== 'high' || kbps > 3000, `${kbps}: cam ${cam} screen ${screen}`);
    }
    // at 1 Mb/s the face is already small and the screen still has its 5 fps
    const mid = choose(budgetKbps(1000), both);
    assert.ok(CAMERA_TIERS[mid.cam].layer === 'low' || CAMERA_TIERS[mid.cam].layer === 'off' || CAMERA_TIERS[mid.cam].layer === 'medium');
    assert.ok(SCREEN_TIERS[mid.screen].fps >= 3);
  });

  it('a very poor network pauses the face, not the screen', () => {
    const r = choose(budgetKbps(450), both);
    assert.equal(CAMERA_TIERS[r.cam].layer, 'off');
    assert.equal(r.screen, SCREEN_TIERS.length - 1);
  });

  it('without sharing the face uses the whole budget, sharpest first', () => {
    assert.equal(choose(budgetKbps(8000), camOnly).cam, 0);
    assert.equal(CAMERA_TIERS[choose(budgetKbps(900), camOnly).cam].layer, 'medium');
    assert.equal(CAMERA_TIERS[choose(budgetKbps(250), camOnly).cam].layer, 'low');
    assert.equal(CAMERA_TIERS[choose(budgetKbps(100), camOnly).cam].layer, 'off');
  });

  it('degrades within seconds when the network collapses, recovers slowly and one step at a time', () => {
    const c = new AdaptiveController();
    let r = run(c, rep(24, { availKbps: 9000, rttMs: 40, lossPct: 0 }), both);
    const start = r.plans.filter(Boolean).slice(-1)[0] ?? r.last!;
    r = run(c, rep(6, { availKbps: 900, rttMs: 150, lossPct: 1 }), both, r.now);
    const low = r.last!;
    assert.ok(low.screen!.id > start.screen!.id, 'screen fps fell');
    assert.ok(low.camera.id > start.camera.id, 'face got smaller');
    assert.equal(low.reason, 'network_worse');
    // network is good again: nothing changes during the first 3 samples (6 s) ...
    r = run(c, rep(3, { availKbps: 9000, rttMs: 40, lossPct: 0 }), both, r.now);
    assert.ok(r.plans.every((p) => p === null), 'no upgrade before the streak');
    // ... then steps up by ONE tier at a time
    const up1 = run(c, rep(4, { availKbps: 9000, rttMs: 40, lossPct: 0 }), both, r.now);
    const step = up1.last!;
    assert.equal(step.reason, 'network_better');
    assert.ok(step.screen!.id === low.screen!.id - 1 || step.camera.id === low.camera.id - 1);
    assert.ok(!(step.screen!.id < low.screen!.id - 1) && !(step.camera.id < low.camera.id - 1), 'only one step');
  });

  it('a flickering network does not make the picture flicker', () => {
    const c = new AdaptiveController();
    let r = run(c, rep(24, { availKbps: 9000 }), both);
    const samples: LinkSample[] = Array.from({ length: 30 }, (_, i) => (i % 2 ? { availKbps: 9000, rttMs: 40 } : { availKbps: 1000, rttMs: 200 }));
    r = run(c, samples, both, r.now);
    const changes = r.plans.filter(Boolean).length;
    assert.ok(changes <= 4, `too many changes: ${changes}`);
  });

  it('the low bandwidth estimate at the very start of a call does not degrade the picture', () => {
    const c = new AdaptiveController();
    // the network estimate starts around 300 kb/s and climbs: during warm-up it is ignored
    const { plans } = run(c, [300, 450, 700, 1100, 1800, 2600, 3500].map((k) => ({ availKbps: k, rttMs: 30, lossPct: 0 })), both);
    const first = plans.find(Boolean)!;
    assert.ok(first.screen!.id <= 2 && first.camera.layer !== 'off', 'the first plan is a sensible mid tier, not the bottom');
    assert.ok(plans.slice(1).every((p) => p === null || p.reason !== 'network_worse'), 'no downgrade during warm-up');
  });

  it('loss and delay shrink the budget even when the estimate looks fine', () => {
    assert.ok(budgetKbps(3000, 10, 0) < budgetKbps(3000, 0, 0) * 0.7);
    assert.ok(budgetKbps(3000, 0, 900) < budgetKbps(3000, 0, 0));
  });

  it('starting or stopping a share re-plans at once', () => {
    const c = new AdaptiveController();
    let r = run(c, rep(24, { availKbps: 2000 }), camOnly);
    const withShare = c.update({ availKbps: 2000 }, both, r.now + 2000);
    assert.ok(withShare && withShare.screen && withShare.reason === 'context');
    assert.ok(withShare!.screen!.id >= 1, 'on a 2 Mb/s uplink the screen is not at its top tier');
    const stopped = c.update({ availKbps: 2000 }, camOnly, r.now + 4000);
    assert.ok(stopped && stopped.screen === null && stopped.reason === 'context');
  });

  it('the other side camera is reduced on a bad downlink, the other side screen never', () => {
    assert.equal(remoteCameraFor({ lossPct: 12 }, { remoteScreenOn: true }), 'off');
    assert.equal(remoteCameraFor({ lossPct: 12 }, { remoteScreenOn: false }), 'low');
    assert.equal(remoteCameraFor({ lossPct: 5 }, { remoteScreenOn: true }), 'low');
    assert.equal(remoteCameraFor({ lossPct: 0, rttMs: 60 }, { remoteScreenOn: true }), 'high');
  });
});
