import { cookies, headers } from 'next/headers';
import { AppShell } from '@/components/AppShell';
import { MobileNav } from '@/components/MobileNav';
import { SenderProvider } from '@/components/SenderContext';
import { SidebarContent } from '@/components/Sidebar';
import { listAgents } from '@/lib/agents';
import { requireUser } from '@/lib/auth';
import { getSetting, one } from '@/lib/db';
import { getFocus } from '@/lib/focus';
import { focusLabel } from '@/lib/services';

export const dynamic = 'force-dynamic';

function portalBaseUrl(): string {
  const h = headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'brainbric-pulse.vercel.app';
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}

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
    baseUrl: portalBaseUrl(),
  };
  const sidebar = <SidebarContent user={user} agents={agents} counts={counts ?? { drafted: 0, hot: 0, colleges: 0 }} focus={focusLabel(focus)} />;

  return (
    <SenderProvider sender={sender}>
    <AppShell sidebar={sidebar} mobileNav={<MobileNav>{sidebar}</MobileNav>} initialClosed={cookies().get('pulse_sidebar')?.value === 'closed'}>
      {children}
    </AppShell>
    </SenderProvider>
  );
}
