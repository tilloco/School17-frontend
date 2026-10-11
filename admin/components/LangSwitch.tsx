'use client';

import { useRouter } from 'next/navigation';

export function LangSwitch({ current, label }: { current: string; label: string }) {
  const router = useRouter();
  async function pick(lang: string) {
    await fetch('/api/lang', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lang }) });
    router.refresh();
  }
  return (
    <div className="px-3 py-3 border-t border-white/10 text-paper/70 text-xs">
      <span className="block mb-1">{label}</span>
      <div className="flex gap-1">
        {['uz', 'ru', 'en'].map((l) => (
          <button key={l} type="button" onClick={() => pick(l)} aria-pressed={current === l} className={`px-2 py-1 rounded-sm ${current === l ? 'bg-brass/30 text-brass' : 'hover:bg-white/5'}`}>
            {l.toUpperCase()}
          </button>
        ))}
      </div>
    </div>
  );
}
