import Link from 'next/link';
import { statusInfo, TONE_CLASSES, KIND_LABELS } from '@/lib/status';

export function PageHeader({
  title,
  subtitle,
  actions,
  meta,
}: {
  title: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  /** Small grey line above the title row's right side, e.g. a freshness stamp. */
  meta?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-[-0.01em] text-ink-950">{title}</h1>
        {subtitle && <p className="mt-1 max-w-[72ch] text-sm text-ink-500">{subtitle}</p>}
      </div>
      {(actions || meta) && (
        <div className="flex flex-wrap items-center gap-3">
          {meta && <span className="text-xs text-ink-500">{meta}</span>}
          {actions}
        </div>
      )}
    </div>
  );
}

export function Card({
  title,
  note,
  children,
  className = '',
  action,
  flush = false,
}: {
  title?: React.ReactNode;
  note?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
  /** No inner padding below the header, for tables and divided lists that run edge to edge. */
  flush?: boolean;
}) {
  return (
    <section className={`card min-w-0 ${className}`}>
      {(title || action) && (
        <div className={`flex items-start justify-between gap-3 px-5 pt-4 ${flush ? 'pb-3' : 'pb-1'}`}>
          <div className="min-w-0">
            {title && <h2 className="text-[15px] font-semibold text-ink-950">{title}</h2>}
            {note && <p className="mt-0.5 text-xs text-ink-500">{note}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      <div className={flush ? '' : 'px-5 pb-5 pt-3'}>{children}</div>
    </section>
  );
}

export function ViewAll({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="text-xs font-medium text-ink-500 hover:text-ink-950">
      {children}
    </Link>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const s = statusInfo(status);
  return (
    <span title={s.hint} className={`inline-flex h-5 items-center whitespace-nowrap rounded px-1.5 text-xs font-medium ${TONE_CLASSES[s.tone]}`}>
      {s.label}
    </span>
  );
}

export function KindBadge({ kind }: { kind: string }) {
  return <span className="whitespace-nowrap text-xs text-ink-500">{KIND_LABELS[kind] ?? kind}</span>;
}

/** Fit as five small segments; the filled ones carry the brand hue because fit is data. */
export function FitScore({ score }: { score: number | null }) {
  if (score == null) return <span className="text-ink-400">–</span>;
  return (
    <span className="inline-flex items-center gap-[3px]" title={`Fit ${score} of 5`} aria-label={`Fit ${score} of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={`h-2.5 w-1 rounded-[1px] ${i <= score ? 'bg-flame-deep' : 'bg-[#E4E0DC]'}`} />
      ))}
    </span>
  );
}

/** One container split by hairlines: label over value, no icons. */
export function KpiStrip({ items }: { items: { label: string; value: string; sub?: string; href?: string }[] }) {
  return (
    // Hairlines come from a 1px gap over the border colour. Below lg the first item spans the row so 5 items fill 2 columns.
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-card border border-paper-line bg-paper-line lg:grid-cols-5">
      {items.map((k, i) => {
        const inner = (
          <>
            <div className="text-xs text-ink-500">{k.label}</div>
            <div className="num mt-1.5 text-2xl font-semibold tracking-[-0.01em] text-ink-950">{k.value}</div>
            {k.sub && <div className="mt-0.5 text-xs text-ink-500">{k.sub}</div>}
          </>
        );
        const cls = `block bg-white px-5 py-4 ${i === 0 && items.length % 2 ? 'col-span-2 lg:col-span-1' : ''}`;
        return k.href ? (
          <Link key={k.label} href={k.href} className={`${cls} transition-colors hover:bg-paper/70 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ink-900`}>
            {inner}
          </Link>
        ) : (
          <div key={k.label} className={cls}>
            {inner}
          </div>
        );
      })}
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-md border border-dashed border-paper-line px-5 py-8 text-center">
      <div className="text-sm font-medium text-ink-900">{title}</div>
      {children && <div className="mx-auto mt-1 max-w-md text-sm text-ink-500">{children}</div>}
    </div>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="mb-0.5 text-xs text-ink-500">{label}</dt>
      <dd className="break-words text-sm text-ink-900">{children || <span className="text-ink-400">–</span>}</dd>
    </div>
  );
}
