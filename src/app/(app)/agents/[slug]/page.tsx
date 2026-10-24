import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Card, Empty, KindBadge, PageHeader, StatusBadge } from '@/components/ui';
import { agentRuns, docKindLabel, getAgent, listDocs } from '@/lib/agents';
import { requireUser } from '@/lib/auth';
import { fmtDate, fmtDateTime, fmtNum } from '@/lib/format';
import { listLeads } from '@/lib/leads';

export const metadata = { title: 'Agent' };

export default async function AgentPage({ params }: { params: { slug: string } }) {
  await requireUser();
  const agent = await getAgent(params.slug);
  if (!agent) notFound();
  const [runs, docs, leads] = await Promise.all([agentRuns(agent.slug, 25), listDocs({ agent: agent.slug }, 12), listLeads({ agent: agent.slug }, 10)]);

  return (
    <>
      <Link href="/agents" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 hover:text-ink-900">
        <ArrowLeft size={15} /> AI team
      </Link>
      <PageHeader eyebrow={agent.schedule || 'AI agent'} title={agent.name} subtitle={agent.description} />

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Card title="Run history" note="What the agent did each time it ran.">
          {runs.length ? (
            <ol className="flex flex-col divide-y divide-paper-line">
              {runs.map((r) => (
                <li key={r.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-ink-950">{fmtDateTime(r.created_at)}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        r.status === 'error' ? 'bg-flame-red/10 text-flame-deep' : r.status === 'warning' ? 'bg-flame-amber/15 text-[#8A4B00]' : 'bg-emerald-50 text-emerald-800'
                      }`}
                    >
                      {r.status === 'ok' ? 'Done' : r.status === 'warning' ? 'Partly done' : 'Failed'}
                    </span>
                  </div>
                  {r.summary && <p className="mt-1 whitespace-pre-line text-sm text-ink-700">{r.summary}</p>}
                  {(Number(r.stats?.leads_created) > 0 || Number(r.stats?.documents) > 0) && (
                    <p className="mt-1 text-xs text-ink-500">
                      {fmtNum(Number(r.stats.leads_created) || 0)} new leads · {fmtNum(Number(r.stats.leads_updated) || 0)} updated ·{' '}
                      {fmtNum(Number(r.stats.documents) || 0)} reports
                    </p>
                  )}
                </li>
              ))}
            </ol>
          ) : (
            <Empty title="No runs reported yet">Runs appear here once the agent sends its first update.</Empty>
          )}
        </Card>

        <div className="flex min-w-0 flex-col gap-6">
          <Card title="Latest leads from this agent">
            {leads.length ? (
              <ul className="flex flex-col divide-y divide-paper-line">
                {leads.map((l) => (
                  <li key={l.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <Link href={`/leads/${encodeURIComponent(l.id)}`} className="block truncate text-sm font-semibold text-ink-950 hover:text-flame-deep">
                        {l.company || l.requirement?.slice(0, 60) || 'Untitled lead'}
                      </Link>
                      <KindBadge kind={l.kind} />
                    </div>
                    <StatusBadge status={l.status} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-500">This agent hasn&apos;t added leads.</p>
            )}
          </Card>
          <Card title="Reports from this agent">
            {docs.length ? (
              <ul className="flex flex-col gap-2">
                {docs.map((d) => (
                  <li key={d.id}>
                    <Link href={`/reports/${encodeURIComponent(d.id)}`} className="block rounded-lg px-2 py-1.5 hover:bg-paper">
                      <div className="text-sm font-semibold text-ink-950">{d.title}</div>
                      <div className="text-xs text-ink-500">
                        {docKindLabel(d.kind)} · {fmtDate(d.doc_date ?? d.created_at)}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-500">No reports yet.</p>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
