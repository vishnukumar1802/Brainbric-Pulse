import Link from 'next/link';
import { Bot } from 'lucide-react';
import { Card, PageHeader } from '@/components/ui';
import { listAgents } from '@/lib/agents';
import { requireUser } from '@/lib/auth';
import { fmtAgo, fmtNum } from '@/lib/format';

export const metadata = { title: 'AI team' };

export default async function AgentsPage() {
  const user = await requireUser();
  const agents = await listAgents();
  return (
    <>
      <PageHeader
        eyebrow="AI team"
        title="Your agents"
        subtitle="Each agent runs in the cloud on its own schedule. When you give the team a new job, it shows up here as a new module the first time it reports in."
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {agents.map((a) => (
          <Link key={a.slug} href={`/agents/${a.slug}`} className="card group flex flex-col p-5 transition hover:border-ink-400">
            <div className="flex items-center justify-between">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-ink-950 text-flame-amber">
                <Bot size={18} />
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                  a.last_status === 'error'
                    ? 'bg-flame-red/10 text-flame-deep'
                    : a.last_run_at
                      ? 'bg-emerald-50 text-emerald-800'
                      : 'bg-ink-800/5 text-ink-500'
                }`}
              >
                {a.last_status === 'error' ? 'Needs attention' : a.last_run_at ? `Ran ${fmtAgo(a.last_run_at)}` : 'Waiting for first run'}
              </span>
            </div>
            <div className="mt-3 font-display text-base font-semibold text-ink-950 group-hover:text-flame-deep">{a.name}</div>
            <p className="mt-1 flex-1 text-sm text-ink-500">{a.description}</p>
            <div className="mt-4 flex justify-between text-xs text-ink-500">
              <span>{a.schedule || 'On demand'}</span>
              <span>{fmtNum(a.runs_7d)} runs this week</span>
            </div>
          </Link>
        ))}
      </div>
      {user.role === 'admin' && (
        <Card className="mt-6" title="Adding a new agent" note="No code change needed.">
          <p className="text-sm text-ink-700">
            Create the new routine in Claude and have it send its results to this portal&apos;s feed with a new agent name (for example
            <code className="mx-1 rounded bg-ink-800/5 px-1">invoice-reminder</code>). The portal creates the module, its menu entry and its history
            automatically. See Settings for the feed address.
          </p>
        </Card>
      )}
    </>
  );
}
