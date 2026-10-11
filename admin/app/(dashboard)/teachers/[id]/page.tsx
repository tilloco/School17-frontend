import Link from 'next/link';
import { ActionForm } from '@/components/ActionForm';
import { OpenDocument } from '@/components/OpenDocument';
import { adminFetch } from '@/lib/api';
import { getLang, tr } from '@/lib/i18n';
import type { TeacherDetail } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function TeacherReviewPage({ params }: { params: { id: string } }) {
  const t = tr(getLang());
  const p = await adminFetch<TeacherDetail>(`/admin/market/teachers/${params.id}`);
  const base = `teachers/${p.id}`;
  const st = p.verificationStatus;

  return (
    <div className="space-y-6">
      <Link href="/teachers" className="text-sm underline">‹ {t('a.back')}</Link>
      <header>
        <h1 className="font-display text-2xl text-ink900">{p.name ?? '—'} <span className="text-base text-muted">({p.email})</span></h1>
        <p className="mt-1 text-sm"><span className="rounded-sm bg-brassLight text-brass px-2 py-0.5">{t(`a.status.${st}`)}</span></p>
        {p.rejectionReason && <p className="text-sm text-rust mt-2">{t('a.d.rejectionReason', { reason: p.rejectionReason })}</p>}
      </header>

      {/* Matn React tomonidan avtomatik escape qilinadi (dangerouslySetInnerHTML ishlatilmaydi) */}
      <section className="bg-panel border border-line p-4 space-y-2 text-sm">
        <p className="font-semibold">{p.headline}</p>
        <p className="whitespace-pre-wrap">{p.bio}</p>
        <p><b>{t('a.d.subjects')}:</b> {p.subjects.join(', ')}</p>
        <p><b>{t('a.d.levels')}:</b> {p.levels.join(', ')}</p>
        <p><b>{t('a.d.languages')}:</b> {p.languages.join(', ')}</p>
        <p><b>{t('a.d.price')}:</b> {Math.round(p.priceMinor / 100).toLocaleString('en-US').replace(/,/g, ' ')}</p>
        {p.introVideoUrl && <p><b>{t('a.d.video')}:</b> <a href={p.introVideoUrl} target="_blank" rel="noopener noreferrer nofollow" className="underline break-all">{p.introVideoUrl}</a></p>}
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg">{t('a.d.credentials')}</h2>
        <p className="text-xs text-muted">{t('a.d.docNote')}</p>
        {p.credentials.length === 0 && <p className="text-muted">{t('a.empty')}</p>}
        {p.credentials.map((c) => (
          <div key={c.id} className="bg-panel border border-line p-3 space-y-2 text-sm">
            <p><b>{c.kind}</b> — {c.title} · <span>{t(`a.cred.status.${c.status}`)}</span>{c.reviewNote ? ` · ${c.reviewNote}` : ''}</p>
            <div className="flex flex-wrap items-center gap-3">
              {c.fileId && <OpenDocument fileId={c.fileId} label={t('a.d.openDoc')} />}
              <ActionForm path={`teachers/credentials/${c.id}/approve`} label={t('a.d.approve')} />
              <ActionForm path={`teachers/credentials/${c.id}/reject`} label={t('a.d.reject')} reasonLabel={t('a.d.reason')} reasonRequired requiredMsg={t('a.d.reasonRequired')} variant="danger" />
            </div>
          </div>
        ))}
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap gap-4">
          {st === 'PENDING' && <ActionForm path={`${base}/approve`} label={t('a.d.approve')} />}
          {st === 'PENDING' && <ActionForm path={`${base}/reject`} label={t('a.d.reject')} reasonLabel={t('a.d.reason')} reasonRequired requiredMsg={t('a.d.reasonRequired')} variant="danger" />}
          {st === 'VERIFIED' && <ActionForm path={`${base}/suspend`} label={t('a.d.suspend')} reasonLabel={t('a.d.reason')} reasonRequired requiredMsg={t('a.d.reasonRequired')} variant="danger" />}
          {st === 'SUSPENDED' && <ActionForm path={`${base}/reinstate`} label={t('a.d.reinstate')} />}
        </div>
        <p className="text-xs text-muted">{t('a.noMoney')}</p>
      </section>
    </div>
  );
}
