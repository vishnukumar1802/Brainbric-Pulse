import Link from 'next/link';
import { AgentNameForm } from '@/components/AgentNameForm';
import { AgentToggle, AllAgentsToggle } from '@/components/AgentToggle';
import { Card, PageHeader } from '@/components/ui';
import { RunStrip } from '@/components/rich';
import { agentLabel } from '@/lib/agentName';
import { listAgents, recentRunsByAgent } from '@/lib/agents';
import { requirePermission } from '@/lib/auth';
import { fmtAgo, fmtNum } from '@/lib/format';

export const metadata = { title: 'AI team' };

export default async function AgentsPage() {
  const user = await requirePermission('agents');
  const [agents, runs] = await Promise.all([listAgents(), recentRunsByAgent(20)]);
  const isAdmin = true; // everyone who can open this page may pause and start agents
  const canRename = user.role === 'admin';
  const paused = agents.filter((a) => a.paused).length;
  return (
    <>
      <PageHeader
        title="AI team"
        subtitle={`${fmtNum(agents.length - paused)} of ${fmtNum(agents.length)} agents running in the cloud on their own schedules. A paused agent skips its runs until you start it again.`}
        actions={isAdmin ? <AllAgentsToggle anyRunning={agents.some((a) => !a.paused)} anyPaused={paused > 0} /> : undefined}
      />
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[960px] text-sm">
          <thead>
            <tr className="border-b border-paper-line text-left text-xs font-medium text-ink-500">
              <th className="px-5 py-2.5">Agent</th>
              {canRename && <th className="px-3 py-2.5">Name</th>}
              <th className="px-3 py-2.5">Schedule</th>
              <th className="px-3 py-2.5">Last 20 runs</th>
              <th className="px-3 py-2.5">Last run</th>
              <th className="px-3 py-2.5 text-right">Runs, 7 days</th>
              {isAdmin && (
                <th className="px-5 py-2.5">
                  <span className="sr-only">Pause or start</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-paper-rule">
            {agents.map((a) => (
              <tr key={a.slug} className="align-top hover:bg-paper/50">
                <td className="max-w-[26rem] px-5 py-3">
                  <Link href={`/agents/${a.slug}`} className={`font-medium hover:underline ${a.paused ? 'text-ink-500' : 'text-ink-950'}`}>
                    {a.nickname ?? a.name}
                  </Link>
                  {a.nickname && <span className="ml-1.5 text-xs text-ink-500">{a.name}</span>}
                  <p className="mt-0.5 line-clamp-2 text-xs text-ink-500">{a.description}</p>
                </td>
                {canRename && (
                  <td className="px-3 py-2.5">
                    <AgentNameForm slug={a.slug} nickname={a.nickname} role={a.name} />
                  </td>
                )}
                <td className="whitespace-nowrap px-3 py-3 text-ink-700">{a.schedule || 'On demand'}</td>
                <td className="px-3 py-3.5">
                  <RunStrip runs={runs[a.slug] ?? []} slots={20} />
                </td>
                <td className="whitespace-nowrap px-3 py-3">
                  {a.paused ? (
                    <span className="text-ink-500">Paused {a.paused_at ? fmtAgo(a.paused_at) : ''}</span>
                  ) : a.last_status === 'error' ? (
                    <span className="font-medium text-[#C4242A]">Failed {fmtAgo(a.last_run_at)}</span>
                  ) : a.last_run_at ? (
                    <span className="text-ink-700">{fmtAgo(a.last_run_at)}</span>
                  ) : (
                    <span className="text-ink-400">–</span>
                  )}
                </td>
                <td className="num px-3 py-3 text-right text-ink-900">{fmtNum(a.runs_7d)}</td>
                {isAdmin && (
                  <td className="px-5 py-2.5">
                    <div className="flex justify-end">
                      <AgentToggle slug={a.slug} paused={a.paused} name={agentLabel(a)} />
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {isAdmin && (
        <Card className="mt-4" title="Adding a new agent" note="No code change needed.">
          <p className="max-w-[75ch] text-sm text-ink-700">
            Create the new routine in Claude and have it send its results to this portal&apos;s feed under a new agent name, for example
            <code className="mx-1 rounded bg-paper px-1 font-mono text-[12px]">invoice-reminder</code>. The portal adds its row here, its menu entry, its
            history and its Pause and Start button the first time it reports in. Settings has the feed address.
          </p>
        </Card>
      )}
    </>
  );
}
