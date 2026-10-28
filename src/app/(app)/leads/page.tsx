import Link from "next/link";
import { Search } from "lucide-react";
import { LeadQuickActions } from "@/components/LeadActions";
import { CompanyMark, leadName } from "@/components/rich";
import {
  Empty,
  FitScore,
  KindBadge,
  PageHeader,
  StatusBadge,
} from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { getSetting } from "@/lib/db";
import { fmtNum, fmtShortDate } from "@/lib/format";
import { listLeads, nichesList, sourcesList, type LeadFilters } from "@/lib/leads";
import { STATUSES, KIND_LABELS } from "@/lib/status";

export const metadata = { title: "Leads" };

type SP = {
  kind?: string;
  status?: string;
  source?: string;
  niche?: string;
  assigned?: string;
  due?: string;
  q?: string;
  mine?: string;
};

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: SP;
}) {
  const user = await requirePermission("leads");
  const filters: LeadFilters = {
    kind: searchParams.kind || undefined,
    status: searchParams.status || undefined,
    source: searchParams.source || undefined,
    niche: searchParams.niche || undefined,
    assigned: Number(searchParams.assigned) || undefined,
    due: searchParams.due ? true : undefined,
    q: searchParams.q?.trim() || undefined,
    mine: searchParams.mine ? user.id : undefined,
  };
  const [leads, sources, niches, myWhatsapp] = await Promise.all([
    listLeads(filters),
    sourcesList(),
    nichesList(),
    getSetting("my_whatsapp"),
  ]);
  const filtered = Object.values(filters).some(Boolean);

  return (
    <>
      <PageHeader
        title={searchParams.status === "drafted" ? "Ready to send" : "Leads"}
        subtitle={
          searchParams.status === "drafted"
            ? "Drafts the agents wrote. Open one to read it, then send it from Outlook or WhatsApp."
            : "Companies and requirement posts the agents found. Open one to see who they are, why they fit and how to approach them."
        }
      />

      <form
        className="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-[minmax(0,1.6fr)_repeat(4,minmax(0,1fr))_auto_auto]"
        method="get"
      >
        <label className="relative block">
          <span className="sr-only">Search</span>
          <Search
            size={14}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-400"
          />
          <input
            name="q"
            defaultValue={searchParams.q ?? ""}
            placeholder="Search company, requirement, email, country"
            className="input pl-8"
          />
        </label>
        <select
          name="kind"
          defaultValue={searchParams.kind ?? ""}
          className="input"
          aria-label="Type"
        >
          <option value="">All types</option>
          {Object.entries(KIND_LABELS).filter(([v]) => v !== "college").map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <select
          name="status"
          defaultValue={searchParams.status ?? ""}
          className="input"
          aria-label="Status"
        >
          <option value="">All statuses</option>
          <option value="hot">Hot (replied or interested)</option>
          {STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <select
          name="source"
          defaultValue={searchParams.source ?? ""}
          className="input"
          aria-label="Source"
        >
          <option value="">All sources</option>
          {sources.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          name="niche"
          defaultValue={searchParams.niche ?? ""}
          className="input"
          aria-label="Niche"
        >
          <option value="">All niches</option>
          {niches.map((n) => (
            <option key={n.niche} value={n.niche}>
              {n.niche} ({n.n})
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 whitespace-nowrap px-1 text-[13px] text-ink-700">
          <input
            type="checkbox"
            name="mine"
            value="1"
            defaultChecked={Boolean(searchParams.mine)}
            className="accent-ink-900"
          />{" "}
          Assigned to me
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

      <div className="num mb-2 text-xs text-ink-500">
        {fmtNum(leads.length)} {leads.length === 1 ? "lead" : "leads"}
      </div>

      {leads.length === 0 ? (
        <Empty
          title={filtered ? "No leads match these filters" : "No leads yet"}
        >
          {filtered
            ? "Try clearing a filter."
            : "Your agents add leads here as they find them."}
        </Empty>
      ) : (
        <>
          {/* Phone: one stacked row per lead. */}
          <ul className="card divide-y divide-paper-rule md:hidden">
            {leads.map((l) => (
              <li key={l.id} className="px-4 py-3">
                <div className="flex items-start gap-3">
                  <CompanyMark name={l.company} post={!l.company} size={32} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <Link href={`/leads/${encodeURIComponent(l.id)}`} className="line-clamp-2 font-medium text-ink-950 hover:underline">
                        {leadName(l)}
                      </Link>
                      <StatusBadge status={l.status} />
                    </div>
                    <div className="mt-0.5 truncate text-xs text-ink-500">
                      {[l.niche, l.source_platform || 'Web research', l.country, fmtShortDate(l.updated_at)].filter(Boolean).join(' · ')}
                    </div>
                    {(l.kind === 'requirement' ? l.requirement : l.pain_point) && (
                      <p className="mt-1.5 line-clamp-2 text-[13px] text-ink-700">{l.kind === 'requirement' ? l.requirement : l.pain_point}</p>
                    )}
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <FitScore score={l.fit_score} />
                      <LeadQuickActions lead={l} myWhatsapp={myWhatsapp} />
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          {/* Tablet and up: a table that fits its column, so the send buttons are never clipped. */}
          <div className="card hidden md:block">
            <table className="w-full table-fixed text-sm">
              <colgroup>
                <col className="w-[34%] xl:w-[30%]" />
                <col />
                <col className="w-[64px]" />
                <col className="w-[112px]" />
                <col className="w-[92px] xl:w-[196px]" />
              </colgroup>
              <thead>
                <tr className="border-b border-paper-line text-left text-xs font-medium text-ink-500">
                  <th className="px-4 py-2.5">Lead</th>
                  <th className="px-3 py-2.5">Why them</th>
                  <th className="px-3 py-2.5">Fit</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-4 py-2.5">
                    <span className="sr-only">Send</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-paper-rule">
                {leads.map((l) => (
                  <tr key={l.id} className="align-top hover:bg-paper/50">
                    <td className="px-4 py-3">
                      <div className="flex items-start gap-3">
                        <CompanyMark name={l.company} post={!l.company} size={30} />
                        <div className="min-w-0">
                          <Link href={`/leads/${encodeURIComponent(l.id)}`} className="line-clamp-2 font-medium text-ink-950 hover:underline">
                            {leadName(l)}
                          </Link>
                          <div className="mt-0.5 truncate text-xs text-ink-500" title={l.assignee_name ? `Assigned to ${l.assignee_name}` : undefined}>
                            {[l.niche, l.source_platform || 'Web research', l.country, fmtShortDate(l.updated_at)].filter(Boolean).join(' · ')}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-ink-700">
                      <span className="line-clamp-2">{(l.kind === 'requirement' ? l.requirement : l.pain_point) || <span className="text-ink-400">–</span>}</span>
                      {l.budget && (
                        <span className="mt-0.5 block truncate text-xs text-ink-500">
                          Budget <span className="font-medium text-ink-900">{l.budget}</span>
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3.5">
                      <FitScore score={l.fit_score} />
                    </td>
                    <td className="px-3 py-3">
                      <StatusBadge status={l.status} />
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex justify-end">
                        <LeadQuickActions lead={l} myWhatsapp={myWhatsapp} compact />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
