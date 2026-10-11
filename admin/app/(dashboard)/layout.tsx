import { Sidebar } from '@/components/Sidebar';
import { getLang } from '@/lib/i18n';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-paper">
      <Sidebar lang={getLang()} />
      <main className="flex-1 px-8 py-8 max-w-6xl">{children}</main>
    </div>
  );
}
