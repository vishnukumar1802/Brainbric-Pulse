import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Card, Empty, KindBadge, Kpi, PageHeader, StatusBadge } from '@/components/ui';
import { AgentToggle, AllAgentsToggle } from '@/components/AgentToggle';
import { LeadQuickActions } from '@/components/LeadActions';
import { Markdown } from '@/components/Markdown';
import { listAgents, listDocs } from '@/lib/agents';
import { requireUser } from '@/lib/auth';
import { getSetting } from '@/lib/db';
import { fmtAgo, fmtDate, fmtNum } from '@/lib/format';
import { listLeads, pipelineStats } from '@/lib/leads';
import { STATUSES } from '@/lib/status';

export const metadata = { title: 'Overview' };

function greeting() {
  const h = Number(new Date().toLocaleString('en-IN', { hour: 'numeric', hour12: false, timeZone: 'Asia/Kolkata' }));
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export default async function Overview() {
  const user = await requireUser();
  const [stats, ready, hot, agents, briefs, myWhatsapp] = await Promise.all([
    pipelineStats(),
    listLeads({ status: 'drafted' }, 8),
    listLeads({ status: 'hot' }, 5),
    listAgents(),
    listDocs({ kind: 'brief' }, 1),
    getSetting('my_whatsapp'),
  ]);
  const t = stats.totals ?? { total: 0, cold: 0, requirement: 0, drafted: 0, hot: 0, contacted: 0, won: 0, week: 0 };
  const byStatus = STATUSES.map((s) => ({ ...s, n: stats.byStatus.find((b) => b.status === s.value)?.n ?? 0 })).filter((s) => s.n > 0);
  const maxStatus = Math.max(1, ...byStatus.map((s) => s.n));
  const maxSource = Math.max(1, ...stats.bySource.map((s) => s.n));
  const brief = briefs[0];

  return (
    <>
      <PageHeader
        eyebrow={new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Kolkata' })}
        title={`${greeting()}, ${user.name.split(' ')[0]}`}
        subtitle={
          t.drafted
            ? `${fmtNum(t.drafted)} messages are ready for you to check and send${t.hot ? `, and ${fmtNum(t.hot)} leads are waiting on a reply from you` : ''}.`
            : 'Nothing is waiting for you right now. Your agents keep working in the background.'
        }
        actions={
          <Link href="/leads?status=drafted" className="btn-primary">
            Review ready to send <ArrowRight size={16} />
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Kpi accent label="Ready to send" value={fmtNum(t.drafted)} sub="Drafted, waiting for you" href="/leads?status=drafted" />
        <Kpi label="Hot leads" value={fmtNum(t.hot)} sub="Replied, interested or in talks" href="/hot" />
        <Kpi label="Contacted" value={fmtNum(t.contacted)} sub="Messages you have sent" href="/leads?status=sent" />
        <Kpi label="Won" value={fmtNum(t.won)} sub="Became clients" href="/leads?status=won" />
        <Kpi label="New this week" value={fmtNum(t.week)} sub={`${fmtNum(t.cold)} cold · ${fmtNum(t.requirement)} posts in total`} href="/leads" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <Card
          title="Ready to send"
          note="Check each message, then send it from Outlook or WhatsApp with one click."
          action={
            <Link href="/leads?status=drafted" className="text-xs font-semibold text-flame-deep hover:underline">
              See all
            </Link>
          }
        >
          {ready.length ? (
            <ul className="divide-y divide-paper-line">
              {ready.map((l) => (
                <li key={l.id} className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0 flex-1">
                    <Link href={`/leads/${encodeURIComponent(l.id)}`} className="font-semibold text-ink-950 hover:text-flame-deep">
                      {l.company || l.requirement?.slice(0, 60) || 'Untitled lead'}
                    </Link>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-ink-500">
                      <KindBadge kind={l.kind} />
                      <span>{l.source_platform || 'Web research'}</span>
                      {l.country && <span>· {l.country}</span>}
                    </div>
                  </div>
                  <LeadQuickActions lead={l} myWhatsapp={myWhatsapp} />
                </li>
              ))}
            </ul>
          ) : (
            <Empty title="All caught up">New drafts appear here as the agents write them.</Empty>
          )}
        </Card>

        <Card
          title="AI team"
          note={
            agents.some((a) => a.paused)
              ? `${agents.filter((a) => a.paused).length} of ${agents.length} paused. Paused agents skip their runs until you start them.`
              : 'All agents running. Pause any agent to stop its runs.'
          }
          action={
            user.role === 'admin' ? (
              <AllAgentsToggle anyRunning={agents.some((a) => !a.paused)} anyPaused={agents.some((a) => a.paused)} />
            ) : undefined
          }
        >
          <ul className="flex flex-col gap-3">
            {agents.map((a) => (
              <li key={a.slug} className="flex items-start gap-3">
                <span
                  className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${a.paused ? 'bg-flame-amber' : a.last_status === 'error' ? 'bg-flame-red' : a.last_status === 'warning' ? 'bg-flame-amber' : a.last_run_at ? 'bg-emerald-500' : 'bg-ink-400'}`}
                  aria-hidden
                />
                <Link href={`/agents/${a.slug}`} className="group min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-semibold text-ink-950 group-hover:text-flame-deep">
                      {a.name}
                      {a.paused && (
                        <span className="ml-2 rounded-full bg-flame-amber/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#8A4B00]">
                          Paused
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 text-xs text-ink-500">{fmtAgo(a.last_run_at)}</span>
                  </div>
                  <p className="line-clamp-2 text-xs text-ink-500">
                    {a.paused ? `Paused by ${a.paused_by || 'an admin'} ${fmtAgo(a.paused_at)}. ${a.schedule}` : a.last_summary || a.schedule}
                  </p>
                </Link>
                {user.role === 'admin' && <AgentToggle slug={a.slug} paused={a.paused} name={a.name} />}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="Pipeline by stage" note="Every lead, by where it stands now.">
          {byStatus.length ? (
            <div className="flex flex-col gap-2.5">
              {byStatus.map((s) => (
                <Link key={s.value} href={`/leads?status=${s.value}`} className="group grid grid-cols-[7.5rem_1fr] items-center gap-3 text-sm">
                  <span className="truncate text-ink-700 group-hover:text-ink-950">{s.label}</span>
                  <span className="flex items-center gap-2">
                    <span className="h-3 rounded-full bg-flame-x" style={{ width: `${Math.max(3, (s.n / maxStatus) * 85)}%` }} />
                    <span className="text-xs font-semibold tabular-nums text-ink-900">{fmtNum(s.n)}</span>
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <Empty title="No leads yet">The agents add them every hour.</Empty>
          )}
        </Card>

        <Card title="Where leads come from" note="Top sources across all agents.">
          {stats.bySource.length ? (
            <div className="flex flex-col gap-2.5">
              {stats.bySource.map((s) => (
                <Link key={s.source} href={`/leads?source=${encodeURIComponent(s.source)}`} className="group grid grid-cols-[7.5rem_1fr] items-center gap-3 text-sm">
                  <span className="truncate text-ink-700 group-hover:text-ink-950">{s.source}</span>
                  <span className="flex items-center gap-2">
                    <span className="h-3 rounded-full bg-ink-800" style={{ width: `${Math.max(3, (s.n / maxSource) * 85)}%` }} />
                    <span className="text-xs font-semibold tabular-nums text-ink-900">{fmtNum(s.n)}</span>
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <Empty title="No sources yet" />
          )}
        </Card>
      </div>

      {hot.length > 0 && (
        <Card className="mt-6" title="Hot leads" note="They replied or showed interest. Answer these first.">
          <ul className="divide-y divide-paper-line">
            {hot.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <Link href={`/leads/${encodeURIComponent(l.id)}`} className="font-semibold text-ink-950 hover:text-flame-deep">
                  {l.company || 'Untitled lead'}
                </Link>
                <StatusBadge status={l.status} />
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card
        className="mt-6"
        title="Today's brief"
        note={brief ? `From the Daily Brief agent · ${fmtDate(brief.doc_date)}` : 'Arrives every morning at 9:00 AM.'}
        action={
          brief ? (
            <Link href={`/reports/${encodeURIComponent(brief.id)}`} className="text-xs font-semibold text-flame-deep hover:underline">
              Open full brief
            </Link>
          ) : undefined
        }
      >
        {brief ? (
          <div className="max-h-[28rem] overflow-y-auto">
            <Markdown>{brief.body}</Markdown>
          </div>
        ) : (
          <Empty title="No brief yet">The Daily Brief agent writes one every morning.</Empty>
        )}
      </Card>
    </>
  );
}
