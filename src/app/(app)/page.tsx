import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Card, Empty, FitScore, KpiStrip, PageHeader, StatusBadge, ViewAll } from '@/components/ui';
import { AgentToggle, AllAgentsToggle } from '@/components/AgentToggle';
import { LeadQuickActions } from '@/components/LeadActions';
import { Markdown } from '@/components/Markdown';
import { PipelineFlow } from '@/components/PipelineFlow';
import { ActivityFeed, CompanyMark, leadName, MarketSplit, NextUp, RunStrip } from '@/components/rich';
import { listAgents, listDocs, recentRunsByAgent } from '@/lib/agents';
import { requirePermission } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { getSetting } from '@/lib/db';
import { fmtAgo, fmtDate, fmtNum } from '@/lib/format';
import { listLeads, nextUp, openByCountry, pipelineStats, recentActivity, teamActivity } from '@/lib/leads';

export const metadata = { title: 'Overview' };

function plural(n: number, one: string, many: string) {
  return `${fmtNum(n)} ${n === 1 ? one : many}`;
}

export default async function Overview() {
  const user = await requirePermission('leads');
  const [stats, next, ready, hot, agents, runs, feed, countries, briefs, myWhatsapp, team] = await Promise.all([
    pipelineStats(),
    nextUp(),
    listLeads({ status: 'drafted' }, 7),
    listLeads({ status: 'hot' }, 5),
    listAgents(),
    recentRunsByAgent(14),
    recentActivity(6),
    openByCountry(),
    listDocs({ kind: 'brief' }, 1),
    getSetting('my_whatsapp'),
    teamActivity(user.role === 'admin' ? undefined : user.id),
  ]);
  const t = stats.totals ?? { total: 0, cold: 0, requirement: 0, drafted: 0, hot: 0, contacted: 0, won: 0, week: 0 };
  const maxSource = Math.max(1, ...stats.bySource.map((s) => s.n));
  const brief = briefs[0];
  const paused = agents.filter((a) => a.paused);
  const failing = agents.filter((a) => !a.paused && a.last_status === 'error');
  const canAgents = can(user, 'agents');
  // The queue under Next up skips the lead already shown in it.
  const queue = ready.filter((l) => l.id !== next?.id).slice(0, 6);

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

      <Card
        flush
        className="mt-4"
        title={user.role === 'admin' ? 'Team activity' : 'Your follow-ups'}
        note={
          user.role === 'admin'
            ? 'Emails your team marked as sent, the leads they own and their follow-ups due. Click a number to see the leads.'
            : 'Leads you sent. Follow-ups are due 4 days after the last email.'
        }
      >
        <div className="overflow-x-auto border-t border-paper-line">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b border-paper-line text-left text-xs font-medium text-ink-500">
                <th className="px-5 py-2">Person</th>
                <th className="px-3 py-2 text-right">Sent today</th>
                <th className="px-3 py-2 text-right">Sent, 7 days</th>
                <th className="px-3 py-2 text-right">In talks</th>
                <th className="px-5 py-2 text-right">Follow-ups due</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-paper-rule">
              {team.map((m) => (
                <tr key={m.id}>
                  <td className="px-5 py-2.5 font-medium text-ink-950">{m.name}</td>
                  <td className="num px-3 py-2.5 text-right text-ink-900">{fmtNum(m.sent_today)}</td>
                  <td className="num px-3 py-2.5 text-right">
                    <Link href={`/leads?assigned=${m.id}`} className="text-ink-900 hover:underline">
                      {fmtNum(m.sent_week)}
                    </Link>
                  </td>
                  <td className="num px-3 py-2.5 text-right">
                    <Link href={`/leads?assigned=${m.id}&status=hot`} className="text-ink-900 hover:underline">
                      {fmtNum(m.talking)}
                    </Link>
                  </td>
                  <td className="num px-5 py-2.5 text-right">
                    <Link
                      href={`/leads?assigned=${m.id}&due=1`}
                      className={m.due ? 'font-semibold text-[#C4242A] hover:underline' : 'text-ink-500 hover:underline'}
                    >
                      {fmtNum(m.due)}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.75fr)_minmax(0,1fr)] xl:items-start">
        <NextUp lead={next} queued={t.drafted} myWhatsapp={myWhatsapp} />
        <Card flush title="Latest activity" note="What the agents and your team did.">
          <ActivityFeed items={feed} />
        </Card>
      </div>

      <div className="mt-4">
        <PipelineFlow byStatus={stats.byStatus} recent={stats.recent} />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.75fr)_minmax(0,1fr)] xl:items-start">
        <Card
          flush
          title="Also ready to send"
          note="Read the draft, then send it from Outlook or WhatsApp."
          action={t.drafted > queue.length + (next ? 1 : 0) ? <ViewAll href="/leads?status=drafted">View all {fmtNum(t.drafted)}</ViewAll> : undefined}
        >
          {queue.length ? (
            <ul className="border-t border-paper-line">
              {queue.map((l) => (
                <li key={l.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-paper-rule px-5 py-2.5 last:border-b-0">
                  <CompanyMark name={l.company} post={!l.company} size={32} />
                  <div className="min-w-0 flex-1">
                    <Link href={`/leads/${encodeURIComponent(l.id)}`} className="block truncate text-sm font-medium text-ink-950 hover:underline">
                      {leadName(l)}
                    </Link>
                    <div className="truncate text-xs text-ink-500">
                      {[l.kind === 'requirement' ? 'Requirement post' : null, l.source_platform || 'Web research', l.country, `drafted ${fmtAgo(l.updated_at)}`]
                        .filter(Boolean)
                        .join(' · ')}
                    </div>
                  </div>
                  <span className="hidden sm:inline-flex">
                    <FitScore score={l.fit_score} />
                  </span>
                  <LeadQuickActions lead={l} myWhatsapp={myWhatsapp} />
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-5 pb-5">
              <Empty title={next ? 'Only the one above' : 'All caught up'}>New drafts appear here as the agents write them.</Empty>
            </div>
          )}
        </Card>

        <Card
          flush
          title="AI team"
          note={
            paused.length
              ? `${fmtNum(agents.length - paused.length)} of ${fmtNum(agents.length)} running. Ticks are the last 14 runs.`
              : `All ${fmtNum(agents.length)} running. Ticks are the last 14 runs.`
          }
          action={canAgents ? <AllAgentsToggle anyRunning={agents.some((a) => !a.paused)} anyPaused={paused.length > 0} /> : undefined}
        >
          <ul className="border-t border-paper-line">
            {agents.map((a) => (
              <li key={a.slug} className="flex items-center gap-3 border-b border-paper-rule px-5 py-2.5 last:border-b-0">
                <Link href={`/agents/${a.slug}`} className="group min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className={`truncate text-sm font-medium group-hover:underline ${a.paused ? 'text-ink-500' : 'text-ink-950'}`}>{a.name}</span>
                    <span className={`shrink-0 text-xs ${a.last_status === 'error' && !a.paused ? 'font-medium text-[#C4242A]' : 'text-ink-500'}`}>
                      {a.paused ? 'Paused' : a.last_status === 'error' ? 'Failed' : a.last_run_at ? fmtAgo(a.last_run_at) : 'No runs yet'}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <RunStrip runs={runs[a.slug] ?? []} slots={14} />
                    <span className="truncate text-xs text-ink-500">{a.schedule || 'On demand'}</span>
                  </div>
                </Link>
                {canAgents && <AgentToggle slug={a.slug} paused={a.paused} name={a.name} />}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card flush title="In talks" note="They replied or showed interest. Answer these first." action={t.hot > hot.length ? <ViewAll href="/leads?status=hot">View all {fmtNum(t.hot)}</ViewAll> : undefined}>
          {hot.length ? (
            <ul className="border-t border-paper-line">
              {hot.map((l) => (
                <li key={l.id} className="flex items-center gap-3 border-b border-paper-rule px-5 py-2.5 last:border-b-0">
                  <CompanyMark name={l.company} post={!l.company} size={28} />
                  <div className="min-w-0 flex-1">
                    <Link href={`/leads/${encodeURIComponent(l.id)}`} className="block truncate text-sm font-medium text-ink-950 hover:underline">
                      {leadName(l)}
                    </Link>
                    <div className="truncate text-xs text-ink-500">{l.contact_name || l.source_platform || 'Web research'}</div>
                  </div>
                  <StatusBadge status={l.status} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-5 pb-5 text-sm text-ink-500">No one is in talks yet. Replies to your messages show up here.</p>
          )}
        </Card>

        <Card title="Markets" note="Open leads, India against international.">
          {countries.length ? <MarketSplit rows={countries} /> : <p className="text-sm text-ink-500">No open leads yet.</p>}
        </Card>

        <Card title="Where leads come from" note="All leads, by the site the agent found them on.">
          {stats.bySource.length ? (
            <table className="w-full text-[13px]">
              <tbody>
                {stats.bySource.map((s) => (
                  <tr key={s.source}>
                    <td className="w-[44%] max-w-0 py-1.5 pr-3">
                      <Link href={`/leads?source=${encodeURIComponent(s.source)}`} className="block truncate text-ink-700 hover:text-ink-950 hover:underline">
                        {s.source}
                      </Link>
                    </td>
                    <td className="py-1.5">
                      <div className="h-1.5 rounded-full bg-ink-800" style={{ width: `${Math.max(2, (s.n / maxSource) * 100)}%` }} />
                    </td>
                    <td className="num w-10 py-1.5 pl-3 text-right text-ink-900">{fmtNum(s.n)}</td>
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
