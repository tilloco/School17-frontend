import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { routeFor } from './notification-routes';
import { TYPE_RULES } from '../backend/src/marketplace/notifications/categories';

const U = '11111111-1111-4111-8111-111111111111';

describe('notification tap routing (pure)', () => {
  it('every notification type opens a sensible screen (or deliberately none)', () => {
    const none = ['payment.received', 'payment.on_hold', 'payment.released', 'payment.refunded', 'payment.disputed', 'payment.resolved', 'payout.paid', 'payout.rejected'];
    for (const type of Object.keys(TYPE_RULES)) {
      const r = routeFor(type, { threadId: U, classId: U, sessionId: U });
      if (none.includes(type)) assert.equal(r, null, type + ' (dormant paid-escrow types)');
      else assert.ok(r && r.startsWith('/'), `${type} -> ${r}`);
    }
  });
  it('uses ids from the push data and falls back to a list when the id is missing or hostile', () => {
    assert.equal(routeFor('message.new', { threadId: U }), `/market/thread/${U}`);
    assert.equal(routeFor('message.new', {}), '/market/threads');
    assert.equal(routeFor('message.new', { threadId: '../../admin' }), '/market/threads', 'ids are validated, never pasted into a path');
    assert.equal(routeFor('class.live', { sessionId: U }), `/market/class-room/${U}`);
    assert.equal(routeFor('class.live', { sessionId: 'x/../y' }), '/market/classes');
    assert.equal(routeFor('class.homework', { classId: U }), `/market/class-homework/${U}`);
    assert.equal(routeFor('class.cancelled', null), '/market/classes');
    assert.equal(routeFor('unknown.type', { threadId: U }), null);
  });
  it('mobile/src/notifications/routes.ts is identical to shared/notification-routes.ts', () => {
    const a = readFileSync(join(__dirname, 'notification-routes.ts'), 'utf8').replace(/\r\n/g, '\n');
    const b = readFileSync(join(__dirname, '..', 'mobile', 'src', 'notifications', 'routes.ts'), 'utf8').replace(/\r\n/g, '\n');
    assert.equal(a, b);
  });
});
