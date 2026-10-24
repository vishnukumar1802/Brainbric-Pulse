import Link from 'next/link';
import { Empty, PageHeader } from '@/components/ui';
import { docKindLabel, docKinds, listDocs } from '@/lib/agents';
import { requireUser } from '@/lib/auth';
import { fmtDate } from '@/lib/format';

export const metadata = { title: 'Reports' };

export default async function ReportsPage({ searchParams }: { searchParams: { kind?: string } }) {
  await requireUser();
  const kind = searchParams.kind || undefined;
  const [kinds, docs] = await Promise.all([docKinds(), listDocs({ kind }, 100)]);

  return (
    <>
      <PageHeader eyebrow="Library" title="Reports" subtitle="Briefs, inbox summaries, meeting preps, proposals, social plans and competitor reports from your agents." />

      <div className="mb-5 flex flex-wrap gap-2">
        <Link href="/reports" className={`rounded-full px-3 py-1.5 text-sm font-semibold ${!kind ? 'bg-ink-900 text-white' : 'bg-white text-ink-700 ring-1 ring-paper-line hover:ring-ink-400'}`}>
          All
        </Link>
        {kinds.map((k) => (
          <Link
            key={k.kind}
            href={`/reports?kind=${encodeURIComponent(k.kind)}`}
            className={`rounded-full px-3 py-1.5 text-sm font-semibold ${kind === k.kind ? 'bg-ink-900 text-white' : 'bg-white text-ink-700 ring-1 ring-paper-line hover:ring-ink-400'}`}
          >
            {docKindLabel(k.kind)} <span className="ml-1 tabular-nums opacity-60">{k.n}</span>
          </Link>
        ))}
      </div>

      {docs.length === 0 ? (
        <Empty title="No reports yet">Reports appear here as the agents write them.</Empty>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {docs.map((d) => (
            <li key={d.id}>
              <Link href={`/reports/${encodeURIComponent(d.id)}`} className="card block h-full p-4 transition hover:border-ink-400">
                <div className="eyebrow">{docKindLabel(d.kind)}</div>
                <div className="mt-1 font-display text-[15px] font-semibold text-ink-950">{d.title}</div>
                <p className="mt-2 line-clamp-3 text-sm text-ink-500">{d.body.replace(/[#*_>`|-]/g, ' ').replace(/\s+/g, ' ').slice(0, 220)}</p>
                <div className="mt-3 text-xs text-ink-500">{fmtDate(d.doc_date ?? d.created_at)}</div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
