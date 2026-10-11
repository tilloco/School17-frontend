'use client';

import { useState } from 'react';

/** Admin: sinf faylini ID bo'yicha olib tashlash yoki qaytarish. */
export function TakedownForm({ takedown, restore, idLabel, reasonLabel }: { takedown: string; restore: string; idLabel: string; reasonLabel: string }) {
  const [id, setId] = useState('');
  const [reason, setReason] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  async function act(kind: 'takedown' | 'restore') {
    setMsg(null);
    const res = await fetch(`/api/proxy/class-files/${encodeURIComponent(id.trim())}/${kind}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(kind === 'takedown' ? { reason: reason.trim() } : {}) });
    setMsg(res.ok ? 'OK' : `HTTP ${res.status}`);
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input value={id} onChange={(e) => setId(e.target.value)} placeholder={idLabel} aria-label={idLabel} className="border border-line bg-paper px-2 py-1 text-sm" />
      <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={reasonLabel} aria-label={reasonLabel} maxLength={300} className="border border-line bg-paper px-2 py-1 text-sm" />
      <button type="button" onClick={() => act('takedown')} className="bg-rust text-white rounded-sm px-4 py-2 text-sm">{takedown}</button>
      <button type="button" onClick={() => act('restore')} className="border border-line bg-panel rounded-sm px-4 py-2 text-sm">{restore}</button>
      {msg && <span role="status" className="text-sm">{msg}</span>}
    </div>
  );
}
