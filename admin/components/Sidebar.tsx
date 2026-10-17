'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

import { LangSwitch } from './LangSwitch';
import { DICT, Lang } from '@/lib/dict';

export function Sidebar({ lang = 'uz' }: { lang?: Lang }) {
  const T = DICT[lang];
  const navItems = [
    { href: '/teachers', label: T['a.nav.teachers'] },
    { href: '/reports', label: T['a.nav.reports'] },
    { href: '/people', label: T['a.nav.people'] },
    { href: '/storage', label: T['a.nav.storage'] },
  ];
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await fetch('/api/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  return (
    <aside className="w-60 shrink-0 bg-ink min-h-screen flex flex-col">
      <div className="px-6 py-6 border-b border-white/10">
        <p className="font-display text-xl text-paper tracking-tight">School17 Admin</p>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`block px-3 py-2 rounded-sm text-sm transition-colors ${
                active ? 'bg-brass/20 text-brass font-medium' : 'text-paper/70 hover:bg-white/5 hover:text-paper'
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <LangSwitch current={lang} label={T['a.lang']} />
      <div className="px-3 py-4 border-t border-white/10">
        <button
          onClick={handleLogout}
          className="w-full text-left px-3 py-2 rounded-sm text-sm text-paper/70 hover:bg-white/5 hover:text-paper transition-colors"
        >
          Chiqish
        </button>
      </div>
    </aside>
  );
}
