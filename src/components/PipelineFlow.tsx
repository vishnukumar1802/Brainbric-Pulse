import Link from 'next/link';
import { fmtNum } from '@/lib/format';

type Count = { status: string; n: number };

// The stages a lead moves through, left to right. "Ready to send" is the queue the owner works, so it carries the brand hue.
const STAGES = [
  { key: 'new', label: 'Found', statuses: ['new'], href: '/leads?status=new', note: 'Researched, no draft yet' },
  { key: 'drafted', label: 'Ready to send', statuses: ['drafted'], href: '/leads?status=drafted', note: 'Drafted, waiting for you' },
  { key: 'sent', label: 'Contacted', statuses: ['sent', 'followup1', 'followup2'], href: '/leads?status=sent', note: 'Sent, waiting on them' },
  { key: 'hot', label: 'In talks', statuses: ['replied', 'interested', 'call_booked', 'proposal'], href: '/leads?status=hot', note: 'Replied or interested' },
  { key: 'won', label: 'Won', statuses: ['scheduled', 'delivered', 'won'], href: '/leads?status=won', note: 'Clients and booked workshops' },
] as const;

const CLOSED = [
  { status: 'lost', label: 'lost' },
  { status: 'no_response', label: 'no response' },
  { status: 'do_not_contact', label: 'do not contact' },
];

/** Open pipeline by stage, plus leads found per day over the last 14 days (IST). */
export function PipelineFlow({ byStatus, recent }: { byStatus: Count[]; recent: { day: string; n: number }[] }) {
  const n = (statuses: readonly string[]) => byStatus.filter((b) => statuses.includes(b.status)).reduce((a, b) => a + b.n, 0);
  const stages = STAGES.map((s) => ({ ...s, n: n(s.statuses) }));
  const open = stages.reduce((a, s) => a + s.n, 0);
  const max = Math.max(1, ...stages.map((s) => s.n));
  const closed = CLOSED.map((c) => ({ ...c, n: n([c.status]) })).filter((c) => c.n > 0);

  const days: { day: string; n: number }[] = [];
  const today = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  for (let i = 13; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    days.push({ day: key, n: recent.find((r) => r.day === key)?.n ?? 0 });
  }
  const found14 = days.reduce((a, d) => a + d.n, 0);
  const dayMax = Math.max(1, ...days.map((d) => d.n));

  return (
    <section className="card grid min-w-0 xl:grid-cols-[minmax(0,1fr)_300px]">
      <div className="min-w-0 p-5">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-[15px] font-semibold text-ink-950">Open pipeline</h2>
          <span className="num text-xs text-ink-500">{fmtNum(open)} leads</span>
        </div>
        <ol className="mt-4 grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-5 sm:gap-0">
          {stages.map((s, i) => (
            <li key={s.key} className={`min-w-0 ${i > 0 ? 'sm:border-l sm:border-paper-rule sm:pl-4' : ''} ${i < stages.length - 1 ? 'sm:pr-4' : ''}`}>
              <Link href={s.href} className="group block">
                <div className={`text-xs ${s.key === 'drafted' ? 'font-medium text-flame-ink' : 'text-ink-500'} group-hover:text-ink-950`}>{s.label}</div>
                <div className="num mt-1 text-[28px] font-semibold leading-none tracking-[-0.02em] text-ink-950">{fmtNum(s.n)}</div>
                <div className="mt-3 h-1.5 w-full rounded-full bg-paper-rule">
                  <div
                    className={`h-full rounded-full ${s.key === 'drafted' ? 'bg-flame-deep' : 'bg-ink-800'}`}
                    style={{ width: s.n ? `${Math.max(4, (s.n / max) * 100)}%` : 0 }}
                  />
                </div>
                <div className="mt-2 text-xs text-ink-500">{s.note}</div>
              </Link>
            </li>
          ))}
        </ol>
        <p className="mt-5 text-xs text-ink-500">
          {closed.length ? (
            <>
              Closed and out of the pipeline:{' '}
              {closed.map((c, i) => (
                <span key={c.status}>
                  {i > 0 && ', '}
                  <Link href={`/leads?status=${c.status}`} className="num text-ink-700 underline decoration-ink-400/40 underline-offset-2 hover:text-ink-950">
                    {fmtNum(c.n)} {c.label}
                  </Link>
                </span>
              ))}
              .
            </>
          ) : (
            'Nothing closed yet.'
          )}
        </p>
      </div>

      <div className="min-w-0 border-t border-paper-line p-5 xl:border-l xl:border-t-0">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-[15px] font-semibold text-ink-950">Found, last 14 days</h2>
          <span className="num text-xs text-ink-500">{fmtNum(found14)}</span>
        </div>
        <div className="mt-4 flex h-24 items-end gap-[3px] border-b border-paper-line" role="img" aria-label={`${found14} leads found in the last 14 days`}>
          {days.map((d, i) => (
            <div key={d.day} className="group relative flex h-full flex-1 items-end" title={`${d.day}: ${d.n} found`}>
              <div
                className={`w-full rounded-t-[2px] ${i === days.length - 1 ? 'bg-flame-deep' : 'bg-ink-800'}`}
                style={{ height: d.n ? `${Math.max(4, (d.n / dayMax) * 100)}%` : 0 }}
              />
            </div>
          ))}
        </div>
        <div className="num mt-1.5 flex justify-between text-[11px] text-ink-500">
          <span>{fmtShort(days[0].day)}</span>
          <span>Today</span>
        </div>
      </div>
    </section>
  );
}

function fmtShort(day: string) {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}
