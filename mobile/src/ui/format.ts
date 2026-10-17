import { getLocale } from '../i18n';
import { t } from '../i18n';

const pad = (n: number) => String(n).padStart(2, '0');
const toDate = (d: Date | string) => (d instanceof Date ? d : new Date(d));

export const fmtTime = (d: Date | string) => {
  const x = toDate(d);
  return `${pad(x.getHours())}:${pad(x.getMinutes())}`;
};

const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();

/** "Today", "Tomorrow" or "Mon, 12 Nov" in the app language. */
export function fmtDay(d: Date | string, now = new Date()): string {
  const x = toDate(d);
  const diff = Math.round((startOfDay(x) - startOfDay(now)) / 86_400_000);
  if (diff === 0) return t('common.today');
  if (diff === 1) return t('common.tomorrow');
  return `${t(`dow.${x.getDay()}`)}, ${x.getDate()} ${t(`mon.${x.getMonth()}`)}`;
}

export const fmtDate = (d: Date | string) => {
  const x = toDate(d);
  return `${x.getDate()} ${t(`mon.${x.getMonth()}`)} ${x.getFullYear()}`;
};

export const fmtDayTime = (d: Date | string, now = new Date()) => `${fmtDay(d, now)} · ${fmtTime(d)}`;

/** Money is stored as integer minor units (tiyin); shown in som with spaces between thousands. */
export const fmtMoney = (minor: number) => `${Math.round(minor / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} ${t('common.currency')}`;

/** "in 25 min", "in 3 h", "in 2 days" or "now". */
export function fmtIn(d: Date | string, now = new Date()): string {
  const mins = Math.round((toDate(d).getTime() - now.getTime()) / 60_000);
  if (mins <= 0) return t('time.now');
  if (mins < 60) return t('time.inMin', { n: mins });
  if (mins < 48 * 60) return t('time.inHours', { n: Math.round(mins / 60) });
  return t('time.inDays', { n: Math.round(mins / 1440) });
}

/** BCP-47 tag of the language chosen in the app, so dates and times follow it (not the phone's language). */
export const loc = (): string => {
  const l = getLocale();
  return l === 'uz' ? 'uz-UZ' : l === 'ru' ? 'ru-RU' : 'en-GB';
};

/** "Mon, 19 Oct 18:00" in the app language, built from the app's own day and month names (the phone's date library does not know Uzbek). */
export const fmtDateTime = (d: Date | string) => {
  const x = toDate(d);
  return `${t(`dow.${x.getDay()}`)}, ${x.getDate()} ${t(`mon.${x.getMonth()}`)} ${fmtTime(x)}`;
};
/** "Mon 19" for the day pickers. */
export const fmtDayShort = (d: Date | string) => {
  const x = toDate(d);
  return `${t(`dow.${x.getDay()}`)} ${x.getDate()}`;
};
