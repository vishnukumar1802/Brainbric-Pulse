const TZ = 'Asia/Kolkata';

function toDate(v: unknown): Date | null {
  if (v == null || v === '') return null;
  const d = v instanceof Date ? v : new Date(String(v));
  return isNaN(d.getTime()) ? null : d;
}

export function fmtDate(v: unknown): string {
  const d = toDate(v);
  return d ? d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: TZ }) : '—';
}

export function fmtDateTime(v: unknown): string {
  const d = toDate(v);
  return d
    ? d.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: TZ })
    : '—';
}

export function fmtAgo(v: unknown): string {
  const d = toDate(v);
  if (!d) return 'never';
  const s = Math.round((Date.now() - d.getTime()) / 1000);
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const days = Math.round(h / 24);
  return days === 1 ? 'yesterday' : `${days} days ago`;
}

export function fmtNum(n: number | null | undefined): string {
  return new Intl.NumberFormat('en-IN').format(n ?? 0);
}

/** "27 Oct", with the year only when it is not this year. */
export function fmtShortDate(v: unknown): string {
  const d = toDate(v);
  if (!d) return '—';
  const year = (x: Date) => x.toLocaleDateString('en-IN', { year: 'numeric', timeZone: TZ });
  const sameYear = year(d) === year(new Date());
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }), timeZone: TZ });
}
