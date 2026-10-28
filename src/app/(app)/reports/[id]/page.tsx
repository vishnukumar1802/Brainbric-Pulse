import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { CopyButton } from '@/components/LeadActions';
import { Markdown } from '@/components/Markdown';
import { PageHeader } from '@/components/ui';
import { agentLabel } from '@/lib/agentName';
import { docKindLabel, getAgent, getDoc } from '@/lib/agents';
import { requirePermission } from '@/lib/auth';
import { fmtDate, fmtDateTime } from '@/lib/format';

export const metadata = { title: 'Report' };

export default async function ReportPage({ params }: { params: { id: string } }) {
  await requirePermission('reports');
  const doc = await getDoc(decodeURIComponent(params.id));
  if (!doc) notFound();
  const agent = doc.agent ? await getAgent(doc.agent) : null;

  return (
    <>
      <Link href="/reports" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 hover:text-ink-900">
        <ArrowLeft size={15} /> All reports
      </Link>
      <PageHeader
        meta={`${docKindLabel(doc.kind)} · ${fmtDate(doc.doc_date ?? doc.created_at)}`}
        title={doc.title}
        subtitle={`${agent ? `Written by ${agentLabel(agent)}` : 'Written by an agent'} · last updated ${fmtDateTime(doc.updated_at)}`}
        actions={<CopyButton text={doc.body} label="Copy text" />}
      />
      <article className="card p-5 sm:p-8">
        <Markdown>{doc.body}</Markdown>
      </article>
    </>
  );
}
