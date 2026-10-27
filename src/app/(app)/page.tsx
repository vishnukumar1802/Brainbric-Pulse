import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Card, Empty, KindBadge, KpiStrip, PageHeader, StatusBadge, ViewAll } from '@/components/ui';
import { AgentToggle, AllAgentsToggle } from '@/components/AgentToggle';
import { LeadQuickActions } from '@/components/LeadActions';
import { Markdown } from '@/components/Markdown';
import { PipelineFlow } from '@/components/PipelineFlow';
import { listAgents, listDocs } from '@/lib/agents';
import { requireUser } from '@/lib/auth';
import { getSetting } from '@/lib/db';
import { fmtAgo, fmtDate, fmtNum } from '@/lib/format';
import { listLeads, pipelineStats } from '@/lib/leads';

export const metadata = { title: 'Overview' };

function plural(n: number, one: string, many: string) {
  return `${fmtNum(n)} ${n === 1 ? one : many}`;
}

export default async function Overview() {
  const user = await requireUser();
  const [stats, ready, hot, agents, briefs, myWhatsapp] = await Promise.all([
    pipelineStats(),
    listLeads({ status: 'drafted' }, 6),
    listLeads({ status: 'hot' }, 5),
    listAgents(),
    listDocs({ kind: 'brief' }, 1),
    getSetting('my_whatsapp'),
  ]);
  const t = stats.totals ?? { total: 0, cold: 0, requirement: 0, drafted: 0, hot: 0, contacted: 0, won: 0, week: 0 };
  const maxSource = Math.max(1, ...stats.bySource.map((s) => s.n));
  const brief = briefs[0];
  const paused = agents.filter((a) => a.paused);
  const failing = agents.filter((a) => !a.paused && a.last_status === 'error');
  const isAdmin = user.role === 'admin';

  // The one finding, read first: what is waiting on the owner today.
  const finding = [
    t.hot ? `${plural(t.hot, 'lead is', 'leads are')} waiting on your reply` : null,
    t.drafted ? `${plural(t.drafted, 'message is', 'messages are')} drafted and ready to send` : null,
  ].filter(Boolean);
  const subtitle = finding.length
    ? `${finding.join(', and ')}.${failing.length ? ` ${plural(failing.length, 'agent', 'agents')} failed on the last run.` : ''}`
    : 'Nothing is waiting on you. The agents keep researching in the background.';

  return (
    <>
      <PageHeader
        title="Overview"
        subtitle={subtitle}
        meta={new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' })}
        actions={
          t.drafted ? (
            <Link href="/leads?status=drafted" className="btn-primary">
              Review {plural(t.drafted, 'draft', 'drafts')} <ArrowRight size={15} />
            </Link>
          ) : undefined
        }
      />

      <KpiStrip
        items={[
          { label: 'Ready to send', value: fmtNum(t.drafted), sub: 'Drafts waiting for you', href: '/leads?status=drafted' },
          { label: 'In talks', value: fmtNum(t.hot), sub: 'Replied or interested', href: '/leads?status=hot' },
          { label: 'Contacted', value: fmtNum(t.contacted), sub: 'Messages you have sent', href: '/leads?status=sent' },
          { label: 'Won', value: fmtNum(t.won), sub: 'Became clients', href: '/leads?status=won' },
          { label: 'Found this week', value: fmtNum(t.week), sub: `${plural(t.cold, 'company', 'companies')}, ${plural(t.requirement, 'post', 'posts')} overall`, href: '/leads' },
        ]}
      />

      <div className="mt-4">
        <PipelineFlow byStatus={stats.byStatus} recent={stats.recent} />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <Card
          flush
          title="Ready to send"
          note="Read the draft, then send it from Outlook or WhatsApp."
          action={t.drafted > ready.length ? <ViewAll href="/leads?status=drafted">View all {fmtNum(t.drafted)}</ViewAll> : undefined}
        >
          {ready.length ? (
            <ul className="border-t border-paper-line">
              {ready.map((l) => (
                <li key={l.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-paper-rule px-5 py-3 last:border-b-0">
                  <div className="min-w-0 flex-1">
                    <Link href={`/leads/${encodeURIComponent(l.id)}`} className="block truncate text-sm font-medium text-ink-950 hover:underline">
                      {l.company || l.requirement?.slice(0, 60) || 'Untitled lead'}
                    </Link>
                    <div className="mt-0.5 truncate text-xs text-ink-500">
                      {[l.kind === 'requirement' ? 'Requirement post' : null, l.source_platform || 'Web research', l.country].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                  <LeadQuickActions lead={l} myWhatsapp={myWhatsapp} />
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-5 pb-5">
              <Empty title="All caught up">New drafts appear here as the agents write them.</Empty>
            </div>
          )}
        </Card>

        <Card
          flush
          title="AI team"
          note={
            paused.length
              ? `${fmtNum(agents.length - paused.length)} of ${fmtNum(agents.length)} running. Paused agents skip their runs.`
              : `All ${fmtNum(agents.length)} running.`
          }
          action={isAdmin ? <AllAgentsToggle anyRunning={agents.some((a) => !a.paused)} anyPaused={paused.length > 0} /> : undefined}
        >
          <ul className="border-t border-paper-line">
            {agents.map((a) => (
              <li key={a.slug} className="flex items-center gap-3 border-b border-paper-rule px-5 py-2.5 last:border-b-0">
                <Link href={`/agents/${a.slug}`} className="group min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className={`truncate text-sm font-medium group-hover:underline ${a.paused ? 'text-ink-500' : 'text-ink-950'}`}>{a.name}</span>
                    <span
                      className={`shrink-0 text-xs ${a.last_status === 'error' && !a.paused ? 'font-medium text-[#C4242A]' : 'text-ink-500'}`}
                    >
                      {a.paused ? 'Paused' : a.last_status === 'error' ? 'Failed' : a.last_run_at ? fmtAgo(a.last_run_at) : 'No runs yet'}
                    </span>
                  </div>
                  <p className="truncate text-xs text-ink-500">{a.schedule || 'On demand'}</p>
                </Link>
                {isAdmin && <AgentToggle slug={a.slug} paused={a.paused} name={a.name} />}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card flush title="In talks" note="They replied or showed interest. Answer these first." action={t.hot > hot.length ? <ViewAll href="/leads?status=hot">View all {fmtNum(t.hot)}</ViewAll> : undefined}>
          {hot.length ? (
            <ul className="border-t border-paper-line">
              {hot.map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-3 border-b border-paper-rule px-5 py-3 last:border-b-0">
                  <div className="min-w-0">
                    <Link href={`/leads/${encodeURIComponent(l.id)}`} className="block truncate text-sm font-medium text-ink-950 hover:underline">
                      {l.company || 'Untitled lead'}
                    </Link>
                    <div className="truncate text-xs text-ink-500">{l.contact_name || l.source_platform || 'Web research'}</div>
                  </div>
                  <StatusBadge status={l.status} />
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-5 pb-5">
              <p className="text-sm text-ink-500">No one is in talks yet. Replies to your messages show up here.</p>
            </div>
          )}
        </Card>

        <Card title="Where leads come from" note="All leads, by the site the agent found them on.">
          {stats.bySource.length ? (
            <table className="w-full text-sm">
              <tbody>
                {stats.bySource.map((s) => (
                  <tr key={s.source}>
                    <td className="w-[40%] max-w-0 py-1.5 pr-3">
                      <Link href={`/leads?source=${encodeURIComponent(s.source)}`} className="block truncate text-ink-700 hover:text-ink-950 hover:underline">
                        {s.source}
                      </Link>
                    </td>
                    <td className="py-1.5">
                      <div className="h-1.5 rounded-full bg-ink-800" style={{ width: `${Math.max(2, (s.n / maxSource) * 100)}%` }} />
                    </td>
                    <td className="num w-12 py-1.5 pl-3 text-right text-ink-900">{fmtNum(s.n)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-ink-500">No leads yet.</p>
          )}
        </Card>
      </div>

      <Card
        className="mt-4"
        title="Today's brief"
        note={brief ? `Daily Brief agent · ${fmtDate(brief.doc_date)}` : 'Written every morning at 9:00 AM IST.'}
        action={brief ? <ViewAll href={`/reports/${encodeURIComponent(brief.id)}`}>Open full brief</ViewAll> : undefined}
      >
        {brief ? (
          <div className="max-h-[26rem] overflow-y-auto">
            <Markdown>{brief.body}</Markdown>
          </div>
        ) : (
          <Empty title="No brief yet">The Daily Brief agent writes one every morning.</Empty>
        )}
      </Card>
    </>
  );
}
