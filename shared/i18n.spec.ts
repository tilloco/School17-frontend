import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { en } from '../mobile/src/i18n/locales/en';
import { ru } from '../mobile/src/i18n/locales/ru';
import { uz } from '../mobile/src/i18n/locales/uz';

const dicts = { uz, ru, en } as const;
const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    if (n === 'node_modules' || n === 'android' || n.startsWith('.')) return [];
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(p) ? [p] : [];
  });
}

describe('i18n: uz / ru / en key parity (enforced)', () => {
  it('all three languages have exactly the same keys', () => {
    const base = Object.keys(uz).sort();
    for (const loc of ['ru', 'en'] as const) {
      const keys = Object.keys(dicts[loc]).sort();
      assert.deepEqual(base.filter((k) => !keys.includes(k)), [], `${loc} is missing keys`);
      assert.deepEqual(keys.filter((k) => !base.includes(k)), [], `${loc} has extra keys`);
    }
  });
  it('no empty translations and identical {placeholders} in every language', () => {
    for (const key of Object.keys(uz)) {
      for (const loc of ['uz', 'ru', 'en'] as const) {
        assert.ok(dicts[loc][key].trim().length > 0, `${loc}:${key} is empty`);
        assert.equal(placeholders(dicts[loc][key]), placeholders(uz[key]), `${loc}:${key} placeholders differ`);
      }
    }
  });
  it('Russian and Uzbek texts are really translated (not copies of English) except for neutral words', () => {
    const neutral = new Set(['common.ok', 'call.chat']); // "Chat" is the normal Uzbek word too
    for (const key of Object.keys(en)) {
      if (neutral.has(key) || /^\{\w+\}$/.test(en[key])) continue;
      assert.notEqual(ru[key], en[key], `ru:${key} equals English`);
      assert.notEqual(uz[key], en[key], `uz:${key} equals English`);
    }
  });
  it('every literal t("key") used in the mobile app exists', () => {
    const root = join(__dirname, '..', 'mobile');
    const used = new Set<string>();
    for (const dir of ['app', 'src']) {
      for (const f of walk(join(root, dir))) {
        if (f.includes(`${join('src', 'i18n')}`)) continue;
        for (const m of readFileSync(f, 'utf8').matchAll(/\bt\(\s*'([a-zA-Z0-9_.]+)'/g)) used.add(m[1]);
      }
    }
    assert.ok(used.size > 20, `scanned ${used.size} keys`);
    assert.deepEqual([...used].filter((k) => !(k in uz)), []);
  });
  it('dynamic key families are complete (call.quality.*, status.*)', () => {
    for (const k of ['good', 'fair', 'poor']) assert.ok(`call.quality.${k}` in uz);
    for (const s of ['REQUESTED', 'CONFIRMED', 'DECLINED', 'EXPIRED', 'CANCELLED', 'COMPLETED', 'NO_SHOW_STUDENT', 'NO_SHOW_TEACHER', 'FAILED']) assert.ok(`status.${s}` in uz);
  });
  it('UI strings make no unproven security claims', () => {
    for (const loc of ['uz', 'ru', 'en'] as const) {
      const all = Object.values(dicts[loc]).join('\n');
      assert.ok(!/100%|bank-grade|unhackable|military|полностью защищ|to'liq himoyalangan/i.test(all), loc);
    }
    assert.match(en['safety.noEncryptionClaim'], /not end-to-end encrypted/);
  });
});
