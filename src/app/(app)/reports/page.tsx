import Link from 'next/link';
import { Empty, PageHeader } from '@/components/ui';
import { docKindLabel, docKinds, listDocs } from '@/lib/agents';
import { requirePermission } from '@/lib/auth';
import { fmtDate } from '@/lib/format';

export const metadata = { title: 'Reports' };

export default async function ReportsPage({ searchParams }: { searchParams: { kind?: string } }) {
  await requirePermission('reports');
  const kind = searchParams.kind || undefined;
  const [kinds, docs] = await Promise.all([docKinds(), listDocs({ kind }, 100)]);

  return (
    <>
      <PageHeader title="Reports" subtitle="Briefs, inbox summaries, meeting preps, proposals, social plans and competitor reports from your agents." />

      <div className="mb-5 flex flex-wrap gap-2">
        <Link href="/reports" className={`rounded-md px-2.5 py-1 text-[13px] ${!kind ? 'bg-paper-active font-medium text-ink-950' : 'text-ink-700 hover:bg-paper-active/60 hover:text-ink-950'}`}>
          All
        </Link>
        {kinds.map((k) => (
          <Link
            key={k.kind}
            href={`/reports?kind=${encodeURIComponent(k.kind)}`}
            className={`rounded-md px-2.5 py-1 text-[13px] ${kind === k.kind ? 'bg-paper-active font-medium text-ink-950' : 'text-ink-700 hover:bg-paper-active/60 hover:text-ink-950'}`}
          >
            {docKindLabel(k.kind)} <span className="ml-1 tabular-nums opacity-60">{k.n}</span>
          </Link>
        ))}
      </div>

      {docs.length === 0 ? (
        <Empty title="No reports yet">Reports appear here as the agents write them.</Empty>
      ) : (
        <ul className="card divide-y divide-paper-rule">
          {docs.map((d) => (
            <li key={d.id}>
              <Link
                href={`/reports/${encodeURIComponent(d.id)}`}
                className="grid gap-x-6 gap-y-1 px-5 py-3.5 transition-colors hover:bg-paper/50 sm:grid-cols-[7rem_minmax(0,1fr)]"
              >
                <div className="num text-xs text-ink-500 sm:pt-0.5">
                  {fmtDate(d.doc_date ?? d.created_at)}
                  <span className="block">{docKindLabel(d.kind)}</span>
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-ink-950">{d.title}</div>
                  <p className="mt-0.5 line-clamp-2 text-sm text-ink-500">{d.body.replace(/[#*_>`|-]/g, ' ').replace(/\s+/g, ' ').slice(0, 240)}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
