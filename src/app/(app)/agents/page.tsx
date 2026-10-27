import Link from 'next/link';
import { Bot } from 'lucide-react';
import { AgentToggle, AllAgentsToggle } from '@/components/AgentToggle';
import { Card, PageHeader } from '@/components/ui';
import { listAgents } from '@/lib/agents';
import { requireUser } from '@/lib/auth';
import { fmtAgo, fmtNum } from '@/lib/format';

export const metadata = { title: 'AI team' };

export default async function AgentsPage() {
  const user = await requireUser();
  const agents = await listAgents();
  const isAdmin = user.role === 'admin';
  return (
    <>
      <PageHeader
        eyebrow="AI team"
        title="Your agents"
        subtitle="Each agent runs in the cloud on its own schedule. Pause an agent and it skips its runs until you start it again. When you give the team a new job, it shows up here as a new module the first time it reports in."
        actions={isAdmin ? <AllAgentsToggle anyRunning={agents.some((a) => !a.paused)} anyPaused={agents.some((a) => a.paused)} /> : undefined}
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {agents.map((a) => (
          <div key={a.slug} className={`card flex flex-col p-5 ${a.paused ? 'bg-paper/70' : ''}`}>
            <div className="flex items-center justify-between gap-2">
              <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${a.paused ? 'bg-ink-400 text-white' : 'bg-ink-950 text-flame-amber'}`}>
                <Bot size={18} />
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                  a.paused
                    ? 'bg-flame-amber/15 text-[#8A4B00]'
                    : a.last_status === 'error'
                      ? 'bg-flame-red/10 text-flame-deep'
                      : a.last_run_at
                        ? 'bg-emerald-50 text-emerald-800'
                        : 'bg-ink-800/5 text-ink-500'
                }`}
              >
                {a.paused ? 'Paused' : a.last_status === 'error' ? 'Needs attention' : a.last_run_at ? `Ran ${fmtAgo(a.last_run_at)}` : 'Waiting for first run'}
              </span>
            </div>
            <Link href={`/agents/${a.slug}`} className="group mt-3 flex-1">
              <div className="font-display text-base font-semibold text-ink-950 group-hover:text-flame-deep">{a.name}</div>
              <p className="mt-1 text-sm text-ink-500">{a.description}</p>
            </Link>
            <div className="mt-4 flex items-center justify-between gap-2 text-xs text-ink-500">
              <span>
                {a.paused ? `Paused by ${a.paused_by || 'an admin'} ${fmtAgo(a.paused_at)}` : `${a.schedule || 'On demand'} · ${fmtNum(a.runs_7d)} runs this week`}
              </span>
              {isAdmin && <AgentToggle slug={a.slug} paused={a.paused} name={a.name} />}
            </div>
          </div>
        ))}
      </div>
      {isAdmin && (
        <Card className="mt-6" title="Adding a new agent" note="No code change needed.">
          <p className="text-sm text-ink-700">
            Create the new routine in Claude and have it send its results to this portal&apos;s feed with a new agent name (for example
            <code className="mx-1 rounded bg-ink-800/5 px-1">invoice-reminder</code>). The portal creates the module, its menu entry, its history and its
            Pause/Start button automatically. See Settings for the feed address.
          </p>
        </Card>
      )}
    </>
  );
}
