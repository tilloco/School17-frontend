'use client';

import { useState } from 'react';

/** Hujjatni ochish: backenddan qisqa muddatli imzolangan havola oladi (audit jurnaliga yoziladi) va yangi oynada ochadi. */
export function OpenDocument({ fileId, label }: { fileId: string; label: string }) {
  const [err, setErr] = useState<string | null>(null);
  async function open() {
    setErr(null);
    const res = await fetch(`/api/proxy/files/${fileId}/download-url`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    const d = await res.json().catch(() => ({}));
    if (!res.ok || typeof d.url !== 'string') {
      setErr(d.message || `HTTP ${res.status}`);
      return;
    }
    window.open(d.url, '_blank', 'noopener,noreferrer');
  }
  return (
    <span>
      <button type="button" onClick={open} className="border border-line bg-panel rounded-sm px-3 py-1 text-sm">{label}</button>
      {err && <span role="alert" className="ml-2 text-sm text-rust">{err}</span>}
    </span>
  );
}
