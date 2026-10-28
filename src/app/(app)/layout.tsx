import { MobileNav } from '@/components/MobileNav';
import { SenderProvider } from '@/components/SenderContext';
import { SidebarContent } from '@/components/Sidebar';
import { listAgents } from '@/lib/agents';
import { requireUser } from '@/lib/auth';
import { getSetting, one } from '@/lib/db';
import { getFocus } from '@/lib/focus';
import { focusLabel } from '@/lib/services';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [agents, counts, focus, teamBcc, firstAdmin] = await Promise.all([
    listAgents(),
    one<{ drafted: number; hot: number; colleges: number }>(
      `SELECT COUNT(*) FILTER (WHERE status = 'drafted' AND kind <> 'college')::int AS drafted,
              COUNT(*) FILTER (WHERE status = 'drafted' AND kind = 'college')::int AS colleges,
              COUNT(*) FILTER (WHERE status IN ('replied','interested','call_booked','proposal') AND kind <> 'college')::int AS hot FROM leads`,
    ),
    getFocus(),
    getSetting('team_bcc'),
    one<{ email: string | null }>("SELECT email FROM users WHERE role = 'admin' AND active AND email IS NOT NULL ORDER BY id LIMIT 1"),
  ]);
  // Team members' emails carry a hidden copy to the admin (or the address set in Settings) so nothing is sent unseen.
  const sender = {
    isAdmin: user.role === 'admin',
    email: user.email,
    signature: user.signature,
    bcc: teamBcc || firstAdmin?.email || null,
  };
  const sidebar = <SidebarContent user={user} agents={agents} counts={counts ?? { drafted: 0, hot: 0, colleges: 0 }} focus={focusLabel(focus)} />;

  return (
    <SenderProvider sender={sender}>
    <div className="min-h-screen lg:pl-60">
      <aside className="fixed inset-y-0 left-0 hidden w-60 overflow-y-auto border-r border-paper-line bg-paper lg:block">{sidebar}</aside>
      <MobileNav>{sidebar}</MobileNav>
      <main className="mx-auto w-full max-w-[1240px] px-4 py-6 sm:px-6 lg:px-10 lg:py-8">{children}</main>
    </div>
    </SenderProvider>
  );
}
