import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { DICT, LANGS } from '../admin/lib/dict';
import { isAllowedProxy, sameOrigin } from '../admin/lib/proxy-allow';

const U = '11111111-1111-4111-8111-111111111111';
const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');

describe('admin web: proxy allow-list (pure)', () => {
  it('allows exactly the moderation actions', () => {
    for (const p of [`teachers/${U}/approve`, `teachers/${U}/reject`, `teachers/${U}/suspend`, `teachers/${U}/reinstate`, `teachers/credentials/${U}/approve`, `teachers/credentials/${U}/reject`, `reports/${U}/resolve`, `users/${U}/suspend`, `users/${U}/reinstate`, `reviews/${U}/hide`, `reviews/${U}/restore`, `files/${U}/download-url`, `class-files/${U}/takedown`, `class-files/${U}/restore`, `teachers/${U}/storage-quota`]) {
      assert.equal(isAllowedProxy('POST', p), true, p);
      assert.equal(isAllowedProxy('GET', p), false, 'GET ' + p);
    }
  });
  it('rejects everything else: money, audit log, listing, traversal, malformed ids, other verbs', () => {
    for (const p of ['users', 'audit', 'payouts/' + U + '/pay', 'payments/' + U + '/resolve', 'ledger/integrity', `teachers/${U}`, `teachers/${U}/delete`, 'teachers/not-a-uuid/approve', `teachers/${U}/approve/extra`, `../auth/login`, `teachers/../users/${U}/suspend`, `/teachers/${U}/approve`, `teachers//${U}/approve`, `reports/${U}/resolve?x=1`, '']) {
      assert.equal(isAllowedProxy('POST', p), false, p);
    }
    for (const m of ['PUT', 'DELETE', 'PATCH']) assert.equal(isAllowedProxy(m, `teachers/${U}/approve`), false, m);
  });
  it('same-origin check', () => {
    assert.equal(sameOrigin(null, 'admin.example'), true);
    assert.equal(sameOrigin('https://admin.example', 'admin.example'), true);
    assert.equal(sameOrigin('https://evil.example', 'admin.example'), false);
    assert.equal(sameOrigin('https://admin.example.evil.com', 'admin.example'), false);
    assert.equal(sameOrigin('not a url', 'admin.example'), false);
    assert.equal(sameOrigin('https://admin.example', null), false);
  });
});

describe('admin web: uz / ru / en dictionary parity', () => {
  it('same keys, no empty values, same placeholders', () => {
    const base = Object.keys(DICT.uz).sort();
    for (const l of LANGS) {
      assert.deepEqual(Object.keys(DICT[l]).sort(), base, l);
      for (const k of base) {
        assert.ok(DICT[l][k].trim().length > 0, `${l}:${k}`);
        assert.equal(placeholders(DICT[l][k]), placeholders(DICT.uz[k]), `${l}:${k}`);
      }
    }
  });
  it('the panel never offers or implies money handling', () => {
    for (const l of LANGS) assert.ok(!/refund|escrow|payout|komissiya|комисси|qaytarib ber/i.test(Object.values(DICT[l]).join(' ').replace(/cannot recover money|не может вернуть деньги|pulni qaytara olmaydi/gi, '')), l);
  });
});
