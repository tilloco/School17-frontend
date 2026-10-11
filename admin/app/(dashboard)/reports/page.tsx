import Link from 'next/link';
import { ActionForm } from '@/components/ActionForm';
import { adminFetch } from '@/lib/api';
import { getLang, tr } from '@/lib/i18n';
import type { ReportItem } from '@/lib/types';

export const dynamic = 'force-dynamic';

const STATUSES = ['OPEN', 'ACTIONED', 'DISMISSED'];

export default async function ReportsPage({ searchParams }: { searchParams: { status?: string } }) {
  const t = tr(getLang());
  const status = STATUSES.includes(searchParams.status ?? '') ? (searchParams.status as string) : 'OPEN';
  const rows = await adminFetch<ReportItem[]>(`/admin/market/reports?status=${status}&take=50`);

  return (
    <div>
      <h1 className="font-display text-2xl text-ink900 mb-2">{t('a.r.title')}</h1>
      <p className="text-xs text-muted mb-4">{t('a.r.paymentNote')}</p>
      <nav className="flex gap-2 mb-5">
        {STATUSES.map((s) => (
          <Link key={s} href={`/reports?status=${s}`} className={`px-3 py-1 rounded-sm text-sm border ${s === status ? 'bg-ink text-paper border-ink' : 'border-line bg-panel'}`}>
            {t(`a.r.status.${s}`)}
          </Link>
        ))}
      </nav>
      {rows.length === 0 && <p className="text-muted">{t('a.empty')}</p>}
      <div className="space-y-4">
        {rows.map((r) => (
          <article key={r.id} className="bg-panel border border-line p-4 space-y-3 text-sm">
            <p className="font-semibold">{t('a.r.target', { type: r.targetType })} · {t('a.r.reason', { reason: r.reason })} · {new Date(r.createdAt).toLocaleString()}</p>
            {r.note && <p className="whitespace-pre-wrap">{r.note}</p>}
            {/* Snapshot oddiy matn sifatida (JSON) ko'rsatiladi: HTML sifatida emas */}
            <details>
              <summary className="cursor-pointer text-muted">{t('a.r.context')}</summary>
              <pre className="mt-2 whitespace-pre-wrap break-words text-xs bg-paper p-2 border border-line">{JSON.stringify(r.target, null, 2)}</pre>
            </details>
            {r.status === 'OPEN' && (
              <div className="flex flex-wrap gap-4">
                <ActionForm path={`reports/${r.id}/resolve`} label={t(`a.r.act.${r.targetType}`)} reasonLabel={t('a.r.note')} reasonField="note" extraBody={{ action: 'ACTION' }} variant="danger" />
                <ActionForm path={`reports/${r.id}/resolve`} label={t('a.r.dismiss')} reasonLabel={t('a.r.note')} reasonField="note" extraBody={{ action: 'DISMISS' }} variant="plain" />
              </div>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
