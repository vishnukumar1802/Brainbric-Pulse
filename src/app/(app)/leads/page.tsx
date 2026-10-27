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
        title={searchParams.status === 'drafted' ? 'Ready to send' : 'Leads'}
        subtitle={
          searchParams.status === 'drafted'
            ? 'Drafts the agents wrote. Open one to read it, then send it from Outlook or WhatsApp.'
            : 'Companies and requirement posts the agents found. Open one to see who they are, why they fit and how to approach them.'
        }
      />

      <form className="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,1fr))_auto_auto]" method="get">
        <label className="relative block">
          <span className="sr-only">Search</span>
          <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-400" />
          <input name="q" defaultValue={searchParams.q ?? ''} placeholder="Search company, requirement, email, country" className="input pl-8" />
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
        <label className="flex items-center gap-2 whitespace-nowrap px-1 text-[13px] text-ink-700">
          <input type="checkbox" name="mine" value="1" defaultChecked={Boolean(searchParams.mine)} className="accent-ink-900" /> Assigned to me
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

      <div className="num mb-2 text-xs text-ink-500">{fmtNum(leads.length)} {leads.length === 1 ? 'lead' : 'leads'}</div>

      {leads.length === 0 ? (
        <Empty title={filtered ? 'No leads match these filters' : 'No leads yet'}>
          {filtered ? 'Try clearing a filter.' : 'Your agents add leads here as they find them.'}
        </Empty>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="border-b border-paper-line text-left text-xs font-medium text-ink-500">
                <th className="px-4 py-2.5">Lead</th>
                <th className="px-3 py-2.5">Source</th>
                <th className="px-3 py-2.5">Why them</th>
                <th className="px-3 py-2.5">Fit</th>
                <th className="px-3 py-2.5">Status</th>
                <th className="px-3 py-2.5 text-right">Updated</th>
                <th className="px-4 py-2.5"><span className="sr-only">Send</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-paper-rule">
              {leads.map((l) => (
                <tr key={l.id} className="align-top hover:bg-paper/50">
                  <td className="max-w-[16rem] px-4 py-3">
                    <Link href={`/leads/${encodeURIComponent(l.id)}`} className="font-medium text-ink-950 hover:underline">
                      {l.company || l.requirement?.slice(0, 70) || 'Untitled lead'}
                    </Link>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-ink-500">
                      <KindBadge kind={l.kind} />
                      {l.country && <span>· {l.country}</span>}
                      {l.assignee_name && <span>· {l.assignee_name}</span>}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-ink-700">{l.source_platform || 'Web research'}</td>
                  <td className="max-w-[22rem] px-3 py-3 text-ink-700">
                    <span className="line-clamp-2">{l.kind === 'requirement' ? l.requirement : l.pain_point}</span>
                    {l.budget && <span className="mt-0.5 block text-xs text-ink-500">Budget <span className="font-medium text-ink-900">{l.budget}</span></span>}
                  </td>
                  <td className="px-3 py-3.5">
                    <FitScore score={l.fit_score} />
                  </td>
                  <td className="px-3 py-3">
                    <StatusBadge status={l.status} />
                  </td>
                  <td className="num whitespace-nowrap px-3 py-3 text-right text-xs text-ink-500">{fmtDate(l.updated_at)}</td>
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
