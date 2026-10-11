import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { backoffDelay, CallContext, CallEvent, classifyQuality, Effect, initialContext, POLICY, reduce } from './call-machine';

function run(events: CallEvent[], start: CallContext = initialContext()) {
  let ctx = start;
  const all: Effect[] = [];
  for (const e of events) {
    const s = reduce(ctx, e);
    ctx = s.ctx;
    all.push(...s.effects);
  }
  return { ctx, effects: all };
}
const types = (e: Effect[]) => e.map((x) => x.type);
const joinFlow: CallEvent[] = [{ type: 'ENTER_LOBBY' }, { type: 'JOIN', now: 1000 }, { type: 'CONNECTED', now: 3500 }];
const poor = { type: 'QUALITY', sample: { lossPct: 15, rttMs: 900 } } as const;
const good = { type: 'QUALITY', sample: { lossPct: 0.5, rttMs: 60 } } as const;

describe('call machine: join', () => {
  it('lobby -> connecting -> connected, measures join time, announces presence and heartbeat', () => {
    const { ctx, effects } = run(joinFlow);
    assert.equal(ctx.state, 'connected');
    assert.equal(ctx.joinMs, 2500);
    assert.deepEqual(types(effects), ['connect', 'presence', 'startHeartbeat', 'setMicPublishing', 'setCameraPublishing']);
  });
  it('cannot connect without joining; invalid events are ignored', () => {
    assert.equal(run([{ type: 'CONNECTED', now: 1 }]).ctx.state, 'idle');
    assert.equal(run([{ type: 'JOIN', now: 1 }]).ctx.state, 'idle');
    assert.equal(run([{ type: 'ENTER_LOBBY' }, { type: 'RECONNECTED', now: 1 }]).ctx.state, 'lobby');
  });
});

describe('call machine: reconnect', () => {
  it('connection loss shows a banner, schedules backoff retries, recovers with a fresh presence join', () => {
    const lost = run([...joinFlow, { type: 'CONNECTION_LOST', now: 10_000 }]);
    assert.equal(lost.ctx.state, 'reconnecting');
    assert.equal(lost.ctx.banner, 'reconnecting');
    assert.deepEqual(lost.effects.at(-1), { type: 'scheduleReconnect', delayMs: 1000 });
    const retry = run([{ type: 'RECONNECT_TICK', now: 11_000 }], lost.ctx);
    assert.deepEqual(types(retry.effects), ['tryReconnect', 'scheduleReconnect']);
    assert.deepEqual(retry.effects[1], { type: 'scheduleReconnect', delayMs: 2000 });
    const back = run([{ type: 'RECONNECTED', now: 12_000 }], retry.ctx);
    assert.equal(back.ctx.state, 'connected');
    assert.equal(back.ctx.banner, null);
    assert.equal(back.ctx.reconnects, 1);
    assert.ok(types(back.effects).includes('presence'));
  });
  it('backoff grows then plateaus', () => {
    assert.deepEqual([0, 1, 2, 3, 4, 10].map(backoffDelay), [1000, 2000, 4000, 8000, 8000, 8000]);
  });
  it('gives up after the limit and leaves cleanly; user can join again', () => {
    const lost = run([...joinFlow, { type: 'CONNECTION_LOST', now: 10_000 }]);
    const dead = run([{ type: 'RECONNECT_TICK', now: 10_000 + POLICY.reconnectGiveUpMs + 1 }], lost.ctx);
    assert.equal(dead.ctx.state, 'failed');
    assert.equal(dead.ctx.banner, 'failed');
    assert.ok(types(dead.effects).includes('disconnect') && types(dead.effects).includes('stopHeartbeat'));
    const again = run([{ type: 'JOIN', now: 500_000 }], dead.ctx);
    assert.equal(again.ctx.state, 'connecting');
    assert.equal(again.ctx.banner, null);
  });
  it('a second loss while reconnecting does not restart the timer', () => {
    const lost = run([...joinFlow, { type: 'CONNECTION_LOST', now: 10_000 }]);
    const twice = run([{ type: 'CONNECTION_LOST', now: 20_000 }], lost.ctx);
    assert.equal(twice.ctx.disconnectedAt, 10_000);
  });
  it('leaving while reconnecting ends the call and reports left', () => {
    const lost = run([...joinFlow, { type: 'CONNECTION_LOST', now: 10_000 }]);
    const left = run([{ type: 'LEAVE' }], lost.ctx);
    assert.equal(left.ctx.state, 'ended');
    assert.ok(types(left.effects).includes('presence'));
  });
});

describe('call machine: weak network (audio-first)', () => {
  it('classifies quality', () => {
    assert.equal(classifyQuality({ lossPct: 0, rttMs: 50 }), 'good');
    assert.equal(classifyQuality({ lossPct: 5 }), 'fair');
    assert.equal(classifyQuality({ rttMs: 500 }), 'fair');
    assert.equal(classifyQuality({ lossPct: 12 }), 'poor');
    assert.equal(classifyQuality({ rttMs: 1200 }), 'poor');
  });
  it('3 poor samples in a row switch to audio-only; video returns only after 6 good samples', () => {
    let r = run([...joinFlow, poor, poor]);
    assert.equal(r.ctx.audioOnlyAuto, false);
    assert.equal(r.ctx.banner, 'poor_connection');
    r = run([poor], r.ctx);
    assert.equal(r.ctx.audioOnlyAuto, true);
    assert.equal(r.ctx.banner, 'audio_only');
    assert.deepEqual(r.effects.filter((e) => e.type === 'setCameraPublishing'), [{ type: 'setCameraPublishing', on: false }]);
    r = run([good, good, good, good, good], r.ctx);
    assert.equal(r.ctx.audioOnlyAuto, true, 'not yet');
    r = run([good], r.ctx);
    assert.equal(r.ctx.audioOnlyAuto, false);
    assert.deepEqual(r.effects.filter((e) => e.type === 'setCameraPublishing'), [{ type: 'setCameraPublishing', on: true }]);
  });
  it('a good sample resets the poor streak (no flapping)', () => {
    const r = run([...joinFlow, poor, poor, good, poor, poor]);
    assert.equal(r.ctx.audioOnlyAuto, false);
  });
  it('user-disabled camera stays off after the network recovers', () => {
    let r = run([...joinFlow, { type: 'TOGGLE_CAMERA' }, poor, poor, poor, good, good, good, good, good, good]);
    assert.equal(r.ctx.audioOnlyAuto, false);
    assert.equal(r.ctx.cameraOff, true);
    assert.deepEqual(r.effects.filter((e) => e.type === 'setCameraPublishing').at(-1), { type: 'setCameraPublishing', on: false });
  });
  it('audio-only survives a reconnect', () => {
    const r = run([...joinFlow, poor, poor, poor, { type: 'CONNECTION_LOST', now: 5000 }, { type: 'RECONNECTED', now: 6000 }]);
    assert.equal(r.ctx.state, 'connected');
    assert.equal(r.ctx.banner, 'audio_only');
    assert.deepEqual(r.effects.filter((e) => e.type === 'setCameraPublishing').at(-1), { type: 'setCameraPublishing', on: false });
  });
});

describe('call machine: controls and end', () => {
  it('mic, camera and screen share toggles only when connected', () => {
    assert.equal(run([{ type: 'TOGGLE_MIC' }]).ctx.micMuted, false);
    const r = run([...joinFlow, { type: 'TOGGLE_MIC' }, { type: 'SCREEN_SHARE', on: true }]);
    assert.equal(r.ctx.micMuted, true);
    assert.equal(r.ctx.screenSharing, true);
    assert.ok(r.effects.some((e) => e.type === 'setScreenShare'));
  });
  it('window closing ends the call with presence left', () => {
    const r = run([...joinFlow, { type: 'WINDOW_CLOSED' }]);
    assert.equal(r.ctx.state, 'ended');
    assert.equal(r.ctx.banner, 'window_closed');
    assert.ok(types(r.effects).includes('presence'));
  });
  it('fatal error fails the call; leave from lobby ends it', () => {
    assert.equal(run([...joinFlow, { type: 'FATAL', message: 'x' }]).ctx.state, 'failed');
    assert.equal(run([{ type: 'ENTER_LOBBY' }, { type: 'LEAVE' }]).ctx.state, 'ended');
  });
  it('reducer is pure: input context is never mutated', () => {
    const before = JSON.stringify(initialContext());
    const c = initialContext();
    reduce(c, { type: 'ENTER_LOBBY' });
    assert.equal(JSON.stringify(c), before);
  });
});

describe('mobile copy', () => {
  it('mobile/src/call/call-machine.ts is identical to shared/call-machine.ts', () => {
    const a = readFileSync(join(__dirname, 'call-machine.ts'), 'utf8').replace(/\r\n/g, '\n');
    const b = readFileSync(join(__dirname, '..', 'mobile', 'src', 'call', 'call-machine.ts'), 'utf8').replace(/\r\n/g, '\n');
    assert.equal(a, b);
  });
});
