import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { RunTick } from '@/lib/agents';
import { fmtAgo, fmtDateTime, fmtNum } from '@/lib/format';
import type { FeedItem, Lead } from '@/lib/leads';
import { LeadQuickActions } from './LeadActions';
import { FitScore, StatusBadge } from './ui';

// Identity tints for companies: pale, stable per name, never used as data colour. Hues sit at least 30° apart.
const HUES = [14, 44, 96, 152, 186, 208, 232, 326];

function hueFor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return HUES[h % HUES.length];
}

function initials(name: string) {
  const words = name
    .replace(/[^\p{L}\p{N} ]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w && !/^(the|and|of|for|a|an|pvt|ltd|llc|inc)$/i.test(w));
  return ((words[0]?.[0] ?? '?') + (words[1]?.[0] ?? '')).toUpperCase();
}

export function leadName(l: Pick<Lead, 'company' | 'requirement'>) {
  return l.company || l.requirement?.slice(0, 70) || 'Untitled lead';
}

/** A company's initials on its own pale tint. Requirement posts without a company get a neutral mark. */
export function CompanyMark({ name, size = 32, post = false }: { name: string | null; size?: number; post?: boolean }) {
  const label = name ? initials(name) : 'RP';
  const h = name && !post ? hueFor(name) : null;
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 select-none items-center justify-center rounded-md font-semibold"
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.38),
        background: h == null ? '#EEEBE7' : `hsl(${h} 70% 93%)`,
        color: h == null ? '#45404A' : `hsl(${h} 45% 28%)`,
      }}
    >
      {label}
    </span>
  );
}

const TICK: Record<string, { cls: string; label: string }> = {
  ok: { cls: 'bg-[#247B50]', label: 'Done' },
  warning: { cls: 'bg-flame-amber', label: 'Partly done' },
  error: { cls: 'bg-[#C4242A]', label: 'Failed' },
};

/** The agent's last runs as ticks, oldest left. Empty slots keep the strip's width so rows line up. */
export function RunStrip({ runs, slots = 12 }: { runs: RunTick[]; slots?: number }) {
  const pad = Math.max(0, slots - runs.length);
  return (
    <span className="inline-flex items-end gap-[2px]" aria-label={`${runs.length} recent runs`}>
      {Array.from({ length: pad }).map((_, i) => (
        <span key={`p${i}`} className="h-3 w-[5px] rounded-[1px] bg-[#EEEBE7]" />
      ))}
      {runs.map((r, i) => {
        const t = TICK[r.status] ?? TICK.ok;
        return <span key={i} className={`h-3 w-[5px] rounded-[1px] ${t.cls}`} title={`${fmtDateTime(r.created_at)} · ${t.label}${r.summary ? ` · ${r.summary}` : ''}`} />;
      })}
    </span>
  );
}

/** The best-fit draft, shown whole enough to send from here. */
export function NextUp({ lead, queued, myWhatsapp }: { lead: Lead | null; queued: number; myWhatsapp: string | null }) {
  if (!lead) {
    return (
      <section className="card flex min-h-[220px] flex-col justify-center p-6">
        <h2 className="text-[15px] font-semibold text-ink-950">Next up</h2>
        <p className="mt-1 max-w-md text-sm text-ink-500">No drafts are waiting. The Lead Hunter runs every hour and puts its next draft here.</p>
      </section>
    );
  }
  const href = `/leads/${encodeURIComponent(lead.id)}`;
  const isPost = lead.kind === 'requirement';
  const draft = lead.email_body || lead.whatsapp_message || lead.bid_text;
  return (
    <section className="card flex min-w-0 flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-paper-line px-5 py-3">
        <h2 className="text-[15px] font-semibold text-ink-950">
          Next up <span className="font-normal text-ink-500">· best fit of {plural(queued, 'draft', 'drafts')}</span>
        </h2>
        <Link href="/leads?status=drafted" className="text-xs font-medium text-ink-500 hover:text-ink-950">
          Queue
        </Link>
      </div>

      <div className="grid min-w-0 flex-1 gap-5 p-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="min-w-0">
          <div className="flex items-start gap-3">
            <CompanyMark name={lead.company} post={isPost && !lead.company} size={44} />
            <div className="min-w-0">
              <Link href={href} className="block text-lg font-semibold leading-snug tracking-[-0.01em] text-ink-950 hover:underline">
                {leadName(lead)}
              </Link>
              <div className="mt-0.5 truncate text-xs text-ink-500">
                {[isPost ? 'Requirement post' : lead.segment, lead.country, lead.source_platform].filter(Boolean).join(' · ')}
              </div>
            </div>
          </div>
          <dl className="mt-4 grid gap-3 text-sm">
            <div>
              <dt className="text-xs text-ink-500">{isPost ? 'What they asked for' : 'Why them'}</dt>
              <dd className="mt-0.5 line-clamp-3 text-ink-900">{(isPost ? lead.requirement : lead.pain_point) || '–'}</dd>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <dt className="text-xs text-ink-500">{isPost ? 'Budget' : 'Pitch'}</dt>
                <dd className="mt-0.5 line-clamp-2 text-ink-900">{(isPost ? lead.budget : lead.service_fit) || '–'}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-500">Fit</dt>
                <dd className="mt-1.5 flex items-center gap-2">
                  <FitScore score={lead.fit_score} />
                  <span className="num text-xs text-ink-700">{lead.fit_score != null ? `${lead.fit_score} of 5` : ''}</span>
                </dd>
              </div>
            </div>
          </dl>
        </div>

        <div className="flex min-w-0 flex-col rounded-md border border-paper-rule bg-paper/70 p-4">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-xs font-medium text-ink-700">
              {lead.email_body ? `Email${lead.email ? ` to ${lead.email}` : ''}` : lead.whatsapp_message ? 'WhatsApp message' : 'Bid'}
            </span>
            <span className="shrink-0 text-xs text-ink-500">drafted {fmtAgo(lead.updated_at)}</span>
          </div>
          {lead.email_body && lead.email_subject && <div className="mt-2 truncate text-sm font-medium text-ink-950">{lead.email_subject}</div>}
          <p className="mt-1 line-clamp-5 flex-1 whitespace-pre-line text-[13px] leading-relaxed text-ink-700">{draft || 'No message written yet.'}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <LeadQuickActions lead={lead} myWhatsapp={myWhatsapp} />
            <Link href={href} className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-ink-700 hover:text-ink-950">
              Read in full <ArrowRight size={13} />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

/** Who did what, newest first. */
export function ActivityFeed({ items }: { items: FeedItem[] }) {
  if (!items.length) return <p className="px-5 pb-5 text-sm text-ink-500">Nothing yet. Agent finds and your sends show up here.</p>;
  return (
    <ol className="border-t border-paper-line">
      {items.map((a) => (
        <li key={a.id} className="flex gap-3 border-b border-paper-rule px-5 py-2.5 last:border-b-0">
          <CompanyMark name={a.company} post={!a.company} size={24} />
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 text-[13px] leading-snug text-ink-900">
              <span className="font-medium">{a.actor || 'System'}</span> <span className="text-ink-700">{lowerFirst(a.note || a.type)}</span>
            </p>
            <div className="mt-0.5 flex items-baseline gap-1.5 text-xs text-ink-500">
              {a.lead_id && (
                <Link href={`/leads/${encodeURIComponent(a.lead_id)}`} className="truncate hover:text-ink-950 hover:underline">
                  {a.company || a.requirement?.slice(0, 40) || 'Lead'}
                </Link>
              )}
              <span className="shrink-0">· {fmtAgo(a.created_at)}</span>
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Open leads split between India and international markets, then by country. */
export function MarketSplit({ rows }: { rows: { country: string; n: number }[] }) {
  const total = rows.reduce((a, r) => a + r.n, 0);
  const india = rows.filter((r) => /india|^in$/i.test(r.country)).reduce((a, r) => a + r.n, 0);
  const intl = total - india;
  const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);
  const top = rows.slice(0, 6);
  const rest = rows.slice(6).reduce((a, r) => a + r.n, 0);
  return (
    <div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="flex items-center gap-1.5 text-xs text-ink-500">
            <span className="h-2 w-2 rounded-[2px] bg-ink-800" /> India
          </div>
          <div className="num mt-1 text-2xl font-semibold text-ink-950">
            {fmtNum(india)} <span className="text-sm font-normal text-ink-500">{pct(india)}%</span>
          </div>
        </div>
        <div>
          <div className="flex items-center gap-1.5 text-xs text-ink-500">
            <span className="h-2 w-2 rounded-[2px] bg-flame-deep" /> International
          </div>
          <div className="num mt-1 text-2xl font-semibold text-ink-950">
            {fmtNum(intl)} <span className="text-sm font-normal text-ink-500">{pct(intl)}%</span>
          </div>
        </div>
      </div>
      <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-paper-rule">
        {india > 0 && <div className="bg-ink-800" style={{ width: `${pct(india)}%` }} />}
        {intl > 0 && <div className="bg-flame-deep" style={{ width: `${100 - pct(india)}%` }} />}
      </div>
      {top.length > 0 && (
        <table className="mt-4 w-full text-[13px]">
          <tbody>
            {top.map((r) => (
              <tr key={r.country} className="border-t border-paper-rule">
                <td className="py-1.5 text-ink-700">{r.country}</td>
                <td className="num py-1.5 text-right text-ink-900">{fmtNum(r.n)}</td>
              </tr>
            ))}
            {rest > 0 && (
              <tr className="border-t border-paper-rule">
                <td className="py-1.5 text-ink-500">{fmtNum(rows.length - 6)} more countries</td>
                <td className="num py-1.5 text-right text-ink-500">{fmtNum(rest)}</td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}

const TRACK = [
  { label: 'Found', statuses: ['new'] },
  { label: 'Ready to send', statuses: ['drafted'] },
  { label: 'Contacted', statuses: ['sent', 'followup1', 'followup2'] },
  { label: 'In talks', statuses: ['replied', 'interested', 'call_booked', 'proposal'] },
  { label: 'Won', statuses: ['won'] },
];

/** Where one lead sits in the pipeline. A closed lead shows the track greyed out with its status. */
export function StageTrack({ status }: { status: string }) {
  const at = TRACK.findIndex((t) => t.statuses.includes(status));
  const closed = at === -1;
  return (
    <div>
      <ol className="grid grid-cols-5 gap-1.5" aria-label="Pipeline stage">
        {TRACK.map((t, i) => {
          const done = !closed && i < at;
          const current = !closed && i === at;
          return (
            <li key={t.label} className="min-w-0" aria-current={current ? 'step' : undefined}>
              <div className={`h-1.5 rounded-full ${current ? 'bg-flame-deep' : done ? 'bg-ink-800' : 'bg-paper-rule'}`} />
              <div className={`mt-1.5 text-xs leading-tight ${current ? 'font-medium text-ink-950' : done ? 'text-ink-700' : 'text-ink-400'}`}>{t.label}</div>
            </li>
          );
        })}
      </ol>
      {closed && (
        <p className="mt-2 flex items-center gap-2 text-xs text-ink-500">
          Out of the pipeline: <StatusBadge status={status} />
        </p>
      )}
    </div>
  );
}

function plural(n: number, one: string, many: string) {
  return `${fmtNum(n)} ${n === 1 ? one : many}`;
}

function lowerFirst(s: string) {
  return /^[A-Z][a-z]/.test(s) ? s[0].toLowerCase() + s.slice(1) : s;
}
