'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Bitta moderatsiya amali: ixtiyoriy/majburiy sabab maydoni + tugma. /api/proxy/<path> ga POST qiladi, so'ng sahifani yangilaydi.
 * Matnlar server komponentdan tayyor holda keladi (til tanlovi).
 */
export function ActionForm(props: {
  path: string;
  label: string;
  reasonLabel?: string;
  reasonRequired?: boolean;
  requiredMsg?: string;
  extraBody?: Record<string, unknown>;
  reasonField?: string; // backend maydon nomi: reason | note
  variant?: 'primary' | 'danger' | 'plain';
}) {
  const router = useRouter();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function run(e: React.FormEvent) {
    e.preventDefault();
    if (props.reasonRequired && !reason.trim()) {
      setErr(props.requiredMsg ?? 'Reason required');
      return;
    }
    setBusy(true);
    setErr(null);
    const res = await fetch(`/api/proxy/${props.path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...(props.extraBody ?? {}), ...(props.reasonLabel ? { [props.reasonField ?? 'reason']: reason.trim() } : {}) }),
    });
    setBusy(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setErr(Array.isArray(d.message) ? d.message.join(', ') : d.message || `HTTP ${res.status}`);
      return;
    }
    setReason('');
    router.refresh();
  }

  const color = props.variant === 'danger' ? 'bg-rust text-white' : props.variant === 'plain' ? 'border border-line bg-panel text-ink900' : 'bg-ink text-paper';
  return (
    <form onSubmit={run} className="flex flex-wrap items-center gap-2">
      {props.reasonLabel && (
        <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={props.reasonLabel} aria-label={props.reasonLabel} maxLength={500} className="border border-line rounded-sm px-3 py-2 text-sm bg-panel w-64" />
      )}
      <button type="submit" disabled={busy} className={`${color} rounded-sm px-4 py-2 text-sm disabled:opacity-60`}>{props.label}</button>
      {err && <span role="alert" className="text-sm text-rust">{err}</span>}
    </form>
  );
}
