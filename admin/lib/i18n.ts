import { cookies } from 'next/headers';
import { DICT, Lang, LANGS } from './dict';

export type { Lang };
export { LANGS };

export function getLang(): Lang {
  const v = cookies().get('lang')?.value;
  return (LANGS as readonly string[]).includes(v ?? '') ? (v as Lang) : 'uz';
}

/** Server komponentlar uchun tarjima: tr(lang)('a.teachers') */
export function tr(lang: Lang) {
  return (key: string, params?: Record<string, string | number>) => {
    const raw = DICT[lang][key] ?? DICT.en[key] ?? key;
    return params ? raw.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? `{${k}}`)) : raw;
  };
}
