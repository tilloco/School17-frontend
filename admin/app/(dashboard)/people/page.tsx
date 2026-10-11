import Link from 'next/link';
import { ActionForm } from '@/components/ActionForm';
import { adminFetch } from '@/lib/api';
import { getLang, tr } from '@/lib/i18n';
import type { PeopleResponse } from '@/lib/types';

export const dynamic = 'force-dynamic';

const ROLES = ['STUDENT', 'GUARDIAN', 'TEACHER'];
const STATUSES = ['ACTIVE', 'SUSPENDED', 'DELETED'];

export default async function PeoplePage({ searchParams }: { searchParams: { q?: string; role?: string; status?: string; page?: string } }) {
  const t = tr(getLang());
  const q = (searchParams.q ?? '').slice(0, 80);
  const role = ROLES.includes(searchParams.role ?? '') ? searchParams.role : '';
  const status = STATUSES.includes(searchParams.status ?? '') ? searchParams.status : '';
  const page = Math.max(1, Number(searchParams.page) || 1);
  const qs = new URLSearchParams({ skip: String((page - 1) * 20), take: '20' });
  if (q) qs.set('q', q);
  if (role) qs.set('role', role);
  if (status) qs.set('status', status);
  const data = await adminFetch<PeopleResponse>(`/admin/market/users?${qs.toString()}`);
  const pageLink = (p: number) => `/people?${new URLSearchParams({ q, role: role ?? '', status: status ?? '', page: String(p) }).toString()}`;

  return (
    <div>
      <h1 className="font-display text-2xl text-ink900 mb-4">{t('a.p.title')}</h1>
      <form className="flex flex-wrap gap-3 mb-4" action="/people">
        <input name="q" defaultValue={q} placeholder={t('a.p.search')} aria-label={t('a.p.search')} className="border border-line rounded-sm px-3 py-2 text-sm bg-panel w-64" />
        <select name="role" defaultValue={role} aria-label={t('a.col.role')} className="border border-line rounded-sm px-3 py-2 text-sm bg-panel">
          <option value="">{t('a.p.all')}</option>
          {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <select name="status" defaultValue={status} aria-label={t('a.col.status')} className="border border-line rounded-sm px-3 py-2 text-sm bg-panel">
          <option value="">{t('a.p.all')}</option>
          {STATUSES.map((s) => <option key={s} value={s}>{t(`a.status.${s}`)}</option>)}
        </select>
        <button type="submit" className="bg-ink text-paper rounded-sm px-4 py-2 text-sm">{t('a.apply')}</button>
      </form>
      <p className="text-sm text-muted mb-3">{t('a.p.results', { count: data.total })}</p>
      <table className="w-full text-sm bg-panel border border-line">
        <thead>
          <tr className="text-left text-muted">
            <th className="p-3">{t('a.col.name')}</th><th className="p-3">{t('a.col.email')}</th><th className="p-3">{t('a.col.role')}</th>
            <th className="p-3">{t('a.col.status')}</th><th className="p-3">{t('a.col.created')}</th><th className="p-3" />
          </tr>
        </thead>
        <tbody>
          {data.items.map((u) => (
            <tr key={u.id} className="border-t border-line align-top">
              <td className="p-3">{u.name ?? '—'}</td>
              <td className="p-3 break-all">{u.email}</td>
              <td className="p-3">{u.role}{u.verificationStatus ? ` · ${t(`a.status.${u.verificationStatus}`)}` : ''}</td>
              <td className="p-3">{t(`a.status.${u.status}`)}</td>
              <td className="p-3">{new Date(u.createdAt).toLocaleDateString()}</td>
              <td className="p-3 space-y-2">
                {u.teacherProfileId && <Link className="underline block" href={`/teachers/${u.teacherProfileId}`}>{t('a.open')}</Link>}
                {u.status === 'ACTIVE' && <ActionForm path={`users/${u.id}/suspend`} label={t('a.d.suspend')} reasonLabel={t('a.p.suspendReason')} reasonRequired requiredMsg={t('a.d.reasonRequired')} variant="danger" />}
                {u.status === 'SUSPENDED' && <ActionForm path={`users/${u.id}/reinstate`} label={t('a.d.reinstate')} />}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex gap-3 mt-4 text-sm">
        {page > 1 && <Link href={pageLink(page - 1)} className="underline">‹</Link>}
        {page * 20 < data.total && <Link href={pageLink(page + 1)} className="underline">›</Link>}
      </div>
    </div>
  );
}
