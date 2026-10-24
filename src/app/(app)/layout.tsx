import { MobileNav } from '@/components/MobileNav';
import { SidebarContent } from '@/components/Sidebar';
import { listAgents } from '@/lib/agents';
import { requireUser } from '@/lib/auth';
import { one } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [agents, counts] = await Promise.all([
    listAgents(),
    one<{ drafted: number; hot: number }>(
      `SELECT COUNT(*) FILTER (WHERE status = 'drafted')::int AS drafted,
              COUNT(*) FILTER (WHERE status IN ('replied','interested','call_booked','proposal'))::int AS hot FROM leads`,
    ),
  ]);
  const sidebar = <SidebarContent user={user} agents={agents} counts={counts ?? { drafted: 0, hot: 0 }} />;

  return (
    <div className="min-h-screen lg:pl-64">
      <aside className="fixed inset-y-0 left-0 hidden w-64 overflow-y-auto bg-ink-950 lg:block">{sidebar}</aside>
      <MobileNav>{sidebar}</MobileNav>
      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
    </div>
  );
}
