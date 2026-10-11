import { adminFetch } from '@/lib/api';
import { getLang, tr } from '@/lib/i18n';
import type { StorageInfo } from '@/lib/types';
import { QuotaForm } from './QuotaForm';
import { TakedownForm } from './TakedownForm';

export const dynamic = 'force-dynamic';

const gb = (n: number) => `${(n / 1024 ** 3).toFixed(1)} GB`;

export default async function StoragePage() {
  const t = tr(getLang());
  const info = await adminFetch<StorageInfo>('/admin/market/storage');
  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl text-ink900">{t('a.s.title')}</h1>
      {'unavailable' in info ? (
        <p className="text-muted">{t('a.s.unavailable')}</p>
      ) : (
        <div className="bg-panel border border-line p-4 text-sm space-y-1">
          <p>{t('a.s.disk', { free: gb(info.freeBytes), total: gb(info.totalBytes), min: gb(info.minFreeBytes) })}</p>
          <p>{t('a.s.classFiles', { size: gb(info.classFilesBytes) })}</p>
        </div>
      )}
      <section className="bg-panel border border-line p-4 space-y-3 text-sm">
        <h2 className="font-semibold">{t('a.s.quota')}</h2>
        <QuotaForm label={t('a.s.quota')} idLabel={t('a.s.quotaTeacher')} mbLabel={t('a.s.quotaMb')} />
      </section>
      <section className="bg-panel border border-line p-4 space-y-3 text-sm">
        <h2 className="font-semibold">{t('a.s.takedown')}</h2>
        <TakedownForm takedown={t('a.s.takedown')} restore={t('a.s.restore')} idLabel={t('a.s.takedownId')} reasonLabel={t('a.r.note')} />
      </section>
    </div>
  );
}
