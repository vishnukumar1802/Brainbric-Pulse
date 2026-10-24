import Link from 'next/link';
import { statusInfo, TONE_CLASSES, KIND_LABELS } from '@/lib/status';

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <div className="eyebrow mb-1">{eyebrow}</div>}
        <h1 className="font-display text-2xl font-semibold tracking-tight text-ink-950 sm:text-[28px]">{title}</h1>
        {subtitle && <p className="mt-1 max-w-[70ch] text-sm text-ink-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ title, note, children, className = '', action }: { title?: string; note?: string; children: React.ReactNode; className?: string; action?: React.ReactNode }) {
  return (
    <section className={`card min-w-0 p-5 ${className}`}>
      {(title || action) && (
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            {title && <h2 className="font-display text-[15px] font-semibold text-ink-950">{title}</h2>}
            {note && <p className="mt-0.5 text-xs text-ink-500">{note}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const s = statusInfo(status);
  return (
    <span title={s.hint} className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${TONE_CLASSES[s.tone]}`}>
      {s.label}
    </span>
  );
}

export function KindBadge({ kind }: { kind: string }) {
  return (
    <span className="inline-flex items-center whitespace-nowrap rounded-md bg-ink-900/[0.04] px-1.5 py-0.5 text-[11px] font-semibold text-ink-700">
      {KIND_LABELS[kind] ?? kind}
    </span>
  );
}

export function FitScore({ score }: { score: number | null }) {
  if (score == null) return <span className="text-ink-400">—</span>;
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`Fit ${score} of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={`h-1.5 w-3 rounded-full ${i <= score ? 'bg-flame-x' : 'bg-ink-800/10'}`} />
      ))}
    </span>
  );
}

export function Kpi({ label, value, sub, href, accent }: { label: string; value: string; sub?: string; href?: string; accent?: boolean }) {
  const inner = (
    <div className={`card h-full p-4 transition ${href ? 'hover:border-ink-400' : ''} ${accent ? 'relative overflow-hidden' : ''}`}>
      {accent && <span className="absolute inset-x-0 top-0 h-1 bg-flame-x" aria-hidden />}
      <div className="text-xs font-semibold text-ink-500">{label}</div>
      <div className="mt-2 font-display text-3xl font-semibold tabular-nums text-ink-950">{value}</div>
      {sub && <div className="mt-1 text-xs text-ink-500">{sub}</div>}
    </div>
  );
  return href ? (
    <Link href={href} className="block rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-flame-orange">
      {inner}
    </Link>
  ) : (
    inner
  );
}

export function Empty({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-paper-line bg-white/60 px-6 py-10 text-center">
      <div className="font-display text-sm font-semibold text-ink-900">{title}</div>
      {children && <div className="mx-auto mt-1 max-w-md text-sm text-ink-500">{children}</div>}
    </div>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="eyebrow mb-0.5">{label}</dt>
      <dd className="break-words text-sm text-ink-900">{children || <span className="text-ink-400">—</span>}</dd>
    </div>
  );
}
