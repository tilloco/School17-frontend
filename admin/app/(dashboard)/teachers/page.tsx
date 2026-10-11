import Link from 'next/link';
import { adminFetch } from '@/lib/api';
import { getLang, tr } from '@/lib/i18n';
import type { TeacherQueueItem } from '@/lib/types';

export const dynamic = 'force-dynamic';

const STATUSES = ['PENDING', 'REJECTED', 'VERIFIED', 'SUSPENDED', 'DRAFT'];

export default async function TeachersQueuePage({ searchParams }: { searchParams: { status?: string; page?: string } }) {
  const t = tr(getLang());
  const status = STATUSES.includes(searchParams.status ?? '') ? (searchParams.status as string) : 'PENDING';
  const page = Math.max(1, Number(searchParams.page) || 1);
  const rows = await adminFetch<TeacherQueueItem[]>(`/admin/market/teachers/queue?status=${status}&skip=${(page - 1) * 20}&take=20`);

  return (
    <div>
      <h1 className="font-display text-2xl text-ink900 mb-2">{t('a.teachers.title')}</h1>
      <p className="text-sm text-muted mb-5">{t('a.d.onlyAfterApproval')}</p>
      <nav className="flex gap-2 mb-5" aria-label={t('a.col.status')}>
        {STATUSES.map((s) => (
          <Link key={s} href={`/teachers?status=${s}`} className={`px-3 py-1 rounded-sm text-sm border ${s === status ? 'bg-ink text-paper border-ink' : 'border-line bg-panel'}`}>
            {t(`a.status.${s}`)}
          </Link>
        ))}
      </nav>
      {rows.length === 0 ? (
        <p className="text-muted">{t('a.empty')}</p>
      ) : (
        <table className="w-full text-sm bg-panel border border-line">
          <thead>
            <tr className="text-left text-muted">
              <th className="p-3">{t('a.col.name')}</th>
              <th className="p-3">{t('a.col.headline')}</th>
              <th className="p-3">{t('a.col.submitted')}</th>
              <th className="p-3">{t('a.col.credentials')}</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-line">
                <td className="p-3">{r.name ?? '—'}</td>
                <td className="p-3">{r.headline}</td>
                <td className="p-3">{r.submittedAt ? new Date(r.submittedAt).toLocaleString() : '—'}</td>
                <td className="p-3">{r.credentialCount}</td>
                <td className="p-3"><Link href={`/teachers/${r.id}`} className="underline">{t('a.open')}</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="flex gap-3 mt-4 text-sm">
        {page > 1 && <Link href={`/teachers?status=${status}&page=${page - 1}`} className="underline">‹</Link>}
        {rows.length === 20 && <Link href={`/teachers?status=${status}&page=${page + 1}`} className="underline">›</Link>}
      </div>
    </div>
  );
}
