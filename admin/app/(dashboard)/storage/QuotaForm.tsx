'use client';

import { useState } from 'react';

/** Admin: bitta o'qituvchi uchun saqlash kvotasini oshirish (MB). Faqat ruxsat etilgan proksi yo'li ishlatiladi. */
export function QuotaForm({ label, idLabel, mbLabel }: { label: string; idLabel: string; mbLabel: string }) {
  const [id, setId] = useState('');
  const [mb, setMb] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  async function run(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const res = await fetch(`/api/proxy/teachers/${encodeURIComponent(id.trim())}/storage-quota`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mb: Number(mb) }) });
    setMsg(res.ok ? 'OK' : `HTTP ${res.status}`);
  }
  return (
    <form onSubmit={run} className="flex flex-wrap items-center gap-2">
      <input value={id} onChange={(e) => setId(e.target.value)} placeholder={idLabel} aria-label={idLabel} className="border border-line bg-paper px-2 py-1 text-sm" />
      <input value={mb} onChange={(e) => setMb(e.target.value)} placeholder={mbLabel} aria-label={mbLabel} inputMode="numeric" className="border border-line bg-paper px-2 py-1 text-sm w-40" />
      <button type="submit" className="bg-ink text-paper rounded-sm px-4 py-2 text-sm">{label}</button>
      {msg && <span role="status" className="text-sm">{msg}</span>}
    </form>
  );
}
