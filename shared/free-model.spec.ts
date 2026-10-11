// School17 BEPUL: foydalanuvchiga ko'rinadigan hech bir matn escrow, ushlab turish, qaytarish, komissiya yoki "himoyalangan to'lov" haqida gapirmasligi kerak.
import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { LEGAL_TEXTS } from '../backend/src/marketplace/legal/texts';
import { SAFETY_TIPS } from '../backend/src/marketplace/safety/tips';
import { TEMPLATES } from '../backend/src/marketplace/notifications/templates';
import { en } from '../mobile/src/i18n/locales/en';
import { ru } from '../mobile/src/i18n/locales/ru';
import { uz } from '../mobile/src/i18n/locales/uz';

const FREE = {
  en: 'School17 is free. It does not handle, hold or guarantee payments; pupils pay teachers directly.',
  ru: 'School17 бесплатен. Он не принимает, не удерживает и не гарантирует платежи; ученики платят преподавателям напрямую.',
  uz: "School17 bepul. U to'lovlarni qabul qilmaydi, ushlab turmaydi va kafolatlamaydi; o'quvchilar o'qituvchiga to'g'ridan-to'g'ri to'laydi.",
} as const;

const FORBIDDEN = {
  en: /escrow|refund|commission|protected payment|payment protection|secure(d)? payment|money.back|\bhold(s|ing)?\b|guarantee[sd]? (the )?(payment|money|refund)|(payment|money)s? (is|are) guaranteed/i,
  ru: /эскроу|возврат|вернут|верн[её]м|комисси|удерж|гарант\S* (платеж|оплат|деньг|возврат)|безопасн\S* (платеж|оплат)/i,
  uz: /escrow|komissiya|pul qaytar|qaytarilad|ushlab|kafolat\S* (to'lov|pul)|xavfsiz to'lov/i,
} as const;

function check(locale: 'en' | 'ru' | 'uz', text: string, where: string) {
  const cleaned = text.split(FREE[locale]).join('');
  const m = FORBIDDEN[locale].exec(cleaned);
  assert.equal(m, null, `${where} (${locale}) mentions "${m?.[0]}"`);
}

describe('free model: no text implies the platform handles or protects money', () => {
  it('terms and privacy drafts', () => {
    for (const kind of ['terms', 'privacy'] as const) for (const loc of ['en', 'ru', 'uz'] as const) {
      for (const s of LEGAL_TEXTS[kind][loc].sections) check(loc, s.heading + ' ' + s.body, `${kind}/${s.heading}`);
    }
    for (const loc of ['en', 'ru', 'uz'] as const) {
      const pay = LEGAL_TEXTS.terms[loc].sections.find((s) => /^4\./.test(s.heading))!;
      assert.ok(pay.body.includes(FREE[loc]), `${loc} terms section 4 must state that School17 is free`);
    }
  });
  it('safety tips', () => {
    for (const aud of ['pupil', 'guardian', 'teacher'] as const) for (const loc of ['en', 'ru', 'uz'] as const) {
      for (const tip of SAFETY_TIPS[aud][loc]) check(loc, tip, `tip/${aud}`);
    }
  });
  it('mobile UI strings, plus the "free" notice in every language', () => {
    for (const [loc, dict] of [['en', en], ['ru', ru], ['uz', uz]] as const) {
      for (const [k, v] of Object.entries(dict)) if (k !== 'free.notice') check(loc, v, `i18n ${k}`);
      assert.equal(dict['free.notice'], FREE[loc]);
    }
  });
  it('notifications users can receive in free mode (payment.* / payout.* are dormant S8 templates)', () => {
    for (const [type, byLoc] of Object.entries(TEMPLATES)) {
      if (/^pay(ment|out)\./.test(type)) continue;
      for (const loc of ['en', 'ru', 'uz'] as const) check(loc, byLoc[loc].title + ' ' + byLoc[loc].body, `notification ${type}`);
    }
  });
});
