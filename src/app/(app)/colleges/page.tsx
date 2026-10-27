import Link from 'next/link';
import { Download, Search } from 'lucide-react';
import { LeadQuickActions } from '@/components/LeadActions';
import { CompanyMark } from '@/components/rich';
import { Card, Empty, KpiStrip, PageHeader, StatusBadge, TierBadge } from '@/components/ui';
import { requireUser } from '@/lib/auth';
import { collegeDistricts, collegeStats, estValue, fmtRupees, INSTITUTION_TYPES, programInfo, PROPOSAL_URL, TIERS } from '@/lib/colleges';
import { getSetting } from '@/lib/db';
import { fmtNum, fmtShortDate } from '@/lib/format';
import { listLeads } from '@/lib/leads';
import { STATUSES } from '@/lib/status';

export const metadata = { title: 'Colleges' };

type SP = { tier?: string; type?: string; district?: string; status?: string; q?: string };

function qs(sp: SP, patch: Partial<SP>) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...sp, ...patch })) if (v) p.set(k, v);
  const s = p.toString();
  return s ? `/colleges?${s}` : '/colleges';
}

export default async function CollegesPage({ searchParams }: { searchParams: SP }) {
  await requireUser();
  const tier = Number(searchParams.tier) || undefined;
  const filtered = Boolean(tier || searchParams.type || searchParams.district || searchParams.status || searchParams.q);
  const [stats, districts, colleges, myWhatsapp] = await Promise.all([
    collegeStats(),
    collegeDistricts(),
    listLeads({
      kind: 'college',
      tier,
      institutionType: searchParams.type || undefined,
      district: searchParams.district || undefined,
      status: searchParams.status || undefined,
      q: searchParams.q?.trim() || undefined,
    }),
    getSetting('my_whatsapp'),
  ]);
  const tierRow = (n: number) => stats.byTier.find((t) => t.tier === n) ?? { tier: n, n: 0, drafted: 0, won: 0 };
  const untiered = stats.byTier.find((t) => t.tier == null)?.n ?? 0;
  const maxDistrict = Math.max(1, ...stats.byDistrict.map((d) => d.n));

  return (
    <>
      <PageHeader
        title="Colleges"
        subtitle="Tamil Nadu engineering, polytechnic and arts & science colleges for workshops, bootcamps and internships. Each college is sorted into a tier so you know what to pitch and how."
        actions={
          <a href={PROPOSAL_URL} download className="btn-ghost">
            <Download size={14} className="text-ink-500" /> Proposal PDF
          </a>
        }
      />

      <KpiStrip
        items={[
          { label: 'Proposals ready', value: fmtNum(stats.drafted), sub: 'Drafted, waiting for you', href: qs({}, { status: 'drafted' }) },
          { label: 'Colleges found', value: fmtNum(stats.total), sub: `${fmtNum(districts.length)} ${districts.length === 1 ? 'district' : 'districts'}` },
          { label: 'In talks', value: fmtNum(stats.talking), sub: 'Replied or interested', href: qs({}, { status: 'interested' }) },
          { label: 'Workshops scheduled', value: fmtNum(stats.scheduled), sub: `${fmtNum(stats.delivered)} delivered`, href: qs({}, { status: 'scheduled' }) },
          { label: 'Open pipeline value', value: fmtRupees(stats.open_value), sub: 'Pitched program × batch size' },
        ]}
      />

      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3].map((n) => {
          const t = TIERS[n];
          const row = tierRow(n);
          const active = tier === n;
          return (
            <Link
              key={n}
              href={active ? qs(searchParams, { tier: undefined }) : qs(searchParams, { tier: String(n) })}
              className={`card block p-4 transition-colors hover:border-ink-400 ${active ? 'border-ink-900 ring-1 ring-ink-900' : ''}`}
              aria-pressed={active}
            >
              <div className="flex items-center justify-between gap-2">
                <TierBadge tier={n} />
                <span className="num text-xs text-ink-500">
                  {fmtNum(row.drafted)} ready · {fmtNum(row.won)} booked
                </span>
              </div>
              <div className="num mt-2 text-2xl font-semibold text-ink-950">
                {fmtNum(row.n)} <span className="text-sm font-normal text-ink-500">{row.n === 1 ? 'college' : 'colleges'}</span>
              </div>
              <p className="mt-1 text-xs text-ink-500">{t.who}</p>
              <p className="mt-2 text-xs text-ink-900">
                <span className="text-ink-500">Pitch:</span> {t.pitch}
              </p>
            </Link>
          );
        })}
        <Card title="By district" note={untiered ? `${fmtNum(untiered)} not yet tiered` : 'Colleges found and booked'}>
          {stats.byDistrict.length ? (
            <table className="w-full text-[13px]">
              <tbody>
                {stats.byDistrict.slice(0, 6).map((d) => (
                  <tr key={d.district}>
                    <td className="w-[44%] max-w-0 py-1">
                      <Link href={qs(searchParams, { district: d.district === 'Unknown' ? undefined : d.district })} className="block truncate text-ink-700 hover:text-ink-950 hover:underline">
                        {d.district}
                      </Link>
                    </td>
                    <td className="py-1">
                      <div className="h-1.5 rounded-full bg-ink-800" style={{ width: `${Math.max(4, (d.n / maxDistrict) * 100)}%` }} />
                    </td>
                    <td className="num w-8 py-1 pl-2 text-right text-ink-900">{fmtNum(d.n)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-ink-500">No colleges yet.</p>
          )}
        </Card>
      </div>

      <form className="mb-3 mt-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,1fr))_auto_auto]" method="get">
        {tier && <input type="hidden" name="tier" value={tier} />}
        <label className="relative block">
          <span className="sr-only">Search</span>
          <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-400" />
          <input name="q" defaultValue={searchParams.q ?? ''} placeholder="Search college, district, department" className="input pl-8" />
        </label>
        <select name="type" defaultValue={searchParams.type ?? ''} className="input" aria-label="College type">
          <option value="">All types</option>
          {Object.entries(INSTITUTION_TYPES).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <select name="district" defaultValue={searchParams.district ?? ''} className="input" aria-label="District">
          <option value="">All districts</option>
          {districts.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <select name="status" defaultValue={searchParams.status ?? ''} className="input" aria-label="Status">
          <option value="">All statuses</option>
          <option value="hot">In talks (replied or interested)</option>
          {STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.value === 'drafted' ? 'Proposal ready' : s.label}
            </option>
          ))}
        </select>
        <button type="submit" className="btn-dark">
          Filter
        </button>
        {filtered && (
          <Link href="/colleges" className="btn-ghost">
            Clear
          </Link>
        )}
      </form>

      <div className="num mb-2 text-xs text-ink-500">
        {fmtNum(colleges.length)} {colleges.length === 1 ? 'college' : 'colleges'}
        {tier ? ` in Tier ${tier}` : ''}
      </div>

      {colleges.length === 0 ? (
        <Empty title={filtered ? 'No colleges match these filters' : 'No colleges yet'}>
          {filtered ? 'Try clearing a filter.' : 'The College Outreach agent adds Tamil Nadu colleges here every weekday.'}
        </Empty>
      ) : (
        <>
          {/* Phone: one stacked row per college. */}
          <ul className="card divide-y divide-paper-rule md:hidden">
            {colleges.map((l) => {
              const p = programInfo(l.program);
              return (
                <li key={l.id} className="px-4 py-3">
                  <div className="flex items-start gap-3">
                    <CompanyMark name={l.company} size={32} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <Link href={`/leads/${encodeURIComponent(l.id)}`} className="line-clamp-2 font-medium text-ink-950 hover:underline">
                          {l.company || 'Unnamed college'}
                        </Link>
                        <TierBadge tier={l.tier} />
                      </div>
                      <div className="mt-0.5 truncate text-xs text-ink-500">
                        {[INSTITUTION_TYPES[l.institution_type ?? ''], l.district, l.department].filter(Boolean).join(' · ')}
                      </div>
                      <div className="mt-1.5 flex items-baseline justify-between gap-2 text-[13px]">
                        <span className="truncate text-ink-700">{p?.label ?? '–'}</span>
                        <span className="num shrink-0 font-medium text-ink-950">{fmtRupees(estValue(l))}</span>
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <StatusBadge status={l.status} />
                        <LeadQuickActions lead={l} myWhatsapp={myWhatsapp} />
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          {/* Tablet and up. */}
          <div className="card hidden md:block">
            <table className="w-full table-fixed text-sm">
              <colgroup>
                <col className="w-[30%]" />
                <col />
                <col className="w-[120px]" />
                <col className="w-[72px]" />
                <col className="w-[128px]" />
                <col className="w-[92px] xl:w-[196px]" />
              </colgroup>
              <thead>
                <tr className="border-b border-paper-line text-left text-xs font-medium text-ink-500">
                  <th className="px-4 py-2.5">College</th>
                  <th className="px-3 py-2.5">Pitch</th>
                  <th className="px-3 py-2.5 text-right">Est. value</th>
                  <th className="px-3 py-2.5">Tier</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-4 py-2.5">
                    <span className="sr-only">Send</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-paper-rule">
                {colleges.map((l) => {
                  const p = programInfo(l.program);
                  return (
                    <tr key={l.id} className="align-top hover:bg-paper/50">
                      <td className="px-4 py-3">
                        <div className="flex items-start gap-3">
                          <CompanyMark name={l.company} size={30} />
                          <div className="min-w-0">
                            <Link href={`/leads/${encodeURIComponent(l.id)}`} className="line-clamp-2 font-medium text-ink-950 hover:underline">
                              {l.company || 'Unnamed college'}
                            </Link>
                            <div className="mt-0.5 truncate text-xs text-ink-500">
                              {[INSTITUTION_TYPES[l.institution_type ?? ''], l.district, fmtShortDate(l.updated_at)].filter(Boolean).join(' · ')}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="truncate text-ink-900">{p?.label ?? '–'}</div>
                        <div className="mt-0.5 truncate text-xs text-ink-500">
                          {[l.department, l.domain, l.student_strength ? `~${fmtNum(l.student_strength)} students` : null].filter(Boolean).join(' · ') || '–'}
                        </div>
                      </td>
                      <td className="num px-3 py-3 text-right font-medium text-ink-950">{fmtRupees(estValue(l))}</td>
                      <td className="px-3 py-3">
                        <TierBadge tier={l.tier} />
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
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
