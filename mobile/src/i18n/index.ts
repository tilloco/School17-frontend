import { en } from './locales/en';
import { ru } from './locales/ru';
import { uz } from './locales/uz';

export type Locale = 'uz' | 'ru' | 'en';
export const LOCALES: Locale[] = ['uz', 'ru', 'en'];
export const DEFAULT_LOCALE: Locale = 'uz';

export const dictionaries: Record<Locale, Record<string, string>> = { uz, ru, en };

let current: Locale = DEFAULT_LOCALE;

export function setLocale(l: Locale) {
  current = l;
}
export function getLocale(): Locale {
  return current;
}

/** Tarjima: joriy til -> ingliz tili -> kalitning o'zi. {name} kabi o'rinbosarlar params orqali. */
export function t(key: string, params?: Record<string, string | number>): string {
  const raw = dictionaries[current][key] ?? dictionaries.en[key] ?? key;
  if (!params) return raw;
  return raw.replace(/\{(\w+)\}/g, (_, k) => (params[k] !== undefined ? String(params[k]) : `{${k}}`));
}
