import Link from 'next/link';
import { Search } from 'lucide-react';
import { LeadQuickActions } from '@/components/LeadActions';
import { Empty, FitScore, KindBadge, PageHeader, StatusBadge } from '@/components/ui';
import { requireUser } from '@/lib/auth';
import { getSetting } from '@/lib/db';
import { fmtDate, fmtNum } from '@/lib/format';
import { listLeads, sourcesList, type LeadFilters } from '@/lib/leads';
import { STATUSES, KIND_LABELS } from '@/lib/status';

export const metadata = { title: 'Leads' };

type SP = { kind?: string; status?: string; source?: string; q?: string; mine?: string };

export default async function LeadsPage({ searchParams }: { searchParams: SP }) {
  const user = await requireUser();
  const filters: LeadFilters = {
    kind: searchParams.kind || undefined,
    status: searchParams.status || undefined,
    source: searchParams.source || undefined,
    q: searchParams.q?.trim() || undefined,
    mine: searchParams.mine ? user.id : undefined,
  };
  const [leads, sources, myWhatsapp] = await Promise.all([listLeads(filters), sourcesList(), getSetting('my_whatsapp')]);
  const filtered = Object.values(filters).some(Boolean);

  return (
    <>
      <PageHeader
        eyebrow="Pipeline"
        title="Leads"
        subtitle="Every company and requirement post your agents found. Open one to see who they are, why they fit and how to approach them."
      />

      <form className="card mb-4 grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr_auto_auto]" method="get">
        <label className="relative block">
          <span className="sr-only">Search</span>
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <input name="q" defaultValue={searchParams.q ?? ''} placeholder="Search company, requirement, email, country" className="input pl-9" />
        </label>
        <select name="kind" defaultValue={searchParams.kind ?? ''} className="input" aria-label="Type">
          <option value="">All types</option>
          {Object.entries(KIND_LABELS).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <select name="status" defaultValue={searchParams.status ?? ''} className="input" aria-label="Status">
          <option value="">All statuses</option>
          <option value="hot">Hot (replied or interested)</option>
          {STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <select name="source" defaultValue={searchParams.source ?? ''} className="input" aria-label="Source">
          <option value="">All sources</option>
          {sources.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 whitespace-nowrap px-1 text-sm text-ink-700">
          <input type="checkbox" name="mine" value="1" defaultChecked={Boolean(searchParams.mine)} className="accent-flame-orange" /> Assigned to me
        </label>
        <div className="flex gap-2">
          <button type="submit" className="btn-dark">
            Filter
          </button>
          {filtered && (
            <Link href="/leads" className="btn-ghost">
              Clear
            </Link>
          )}
        </div>
      </form>

      <div className="mb-2 text-xs text-ink-500">{fmtNum(leads.length)} leads</div>

      {leads.length === 0 ? (
        <Empty title={filtered ? 'No leads match these filters' : 'No leads yet'}>
          {filtered ? 'Try clearing a filter.' : 'Your agents add leads here as they find them.'}
        </Empty>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="border-b border-paper-line text-left text-xs font-semibold text-ink-500">
                <th className="px-4 py-3">Lead</th>
                <th className="px-3 py-3">Source</th>
                <th className="px-3 py-3">Why them</th>
                <th className="px-3 py-3">Fit</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Updated</th>
                <th className="px-4 py-3 text-right">Act</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-paper-line">
              {leads.map((l) => (
                <tr key={l.id} className="align-top hover:bg-paper/60">
                  <td className="max-w-[16rem] px-4 py-3">
                    <Link href={`/leads/${encodeURIComponent(l.id)}`} className="font-semibold text-ink-950 hover:text-flame-deep">
                      {l.company || l.requirement?.slice(0, 70) || 'Untitled lead'}
                    </Link>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-ink-500">
                      <KindBadge kind={l.kind} />
                      {l.country && <span>{l.country}</span>}
                      {l.assignee_name && <span>· {l.assignee_name}</span>}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-ink-700">{l.source_platform || 'Web research'}</td>
                  <td className="max-w-[22rem] px-3 py-3 text-ink-700">
                    <span className="line-clamp-2">{l.kind === 'requirement' ? l.requirement : l.pain_point}</span>
                    {l.budget && <span className="mt-0.5 block text-xs font-semibold text-ink-900">Budget: {l.budget}</span>}
                  </td>
                  <td className="px-3 py-3">
                    <FitScore score={l.fit_score} />
                  </td>
                  <td className="px-3 py-3">
                    <StatusBadge status={l.status} />
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-xs text-ink-500">{fmtDate(l.updated_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end">
                      <LeadQuickActions lead={l} myWhatsapp={myWhatsapp} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
