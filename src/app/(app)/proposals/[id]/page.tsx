import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, Download } from 'lucide-react';
import { markProposalSentAction } from '@/app/actions';
import { Card, PageHeader } from '@/components/ui';
import { requireUser } from '@/lib/auth';
import { fmtAgo, fmtDateTime } from '@/lib/format';
import { getLead } from '@/lib/leads';
import { can, homeFor } from '@/lib/permissions';
import { fmtRange } from '@/lib/pricing';
import { getProposal } from '@/lib/proposals';
import { ProposalForm } from './ProposalForm';

export const metadata = { title: 'Proposal' };

export default async function ProposalPage({ params }: { params: { id: string } }) {
  const me = await requireUser();
  const proposal = await getProposal(Number(params.id) || 0);
  if (!proposal) notFound();
  const lead = await getLead(proposal.lead_id);
  if (!lead) notFound();
  if (!can(me, lead.kind === 'college' ? 'colleges' : 'leads')) redirect(homeFor(me));

  return (
    <>
      <Link href={`/leads/${encodeURIComponent(lead.id)}`} className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 hover:text-ink-900">
        <ArrowLeft size={15} /> {lead.company ?? 'Back to the lead'}
      </Link>
      <PageHeader
        title={proposal.title}
        subtitle={`${proposal.kind === 'college' ? 'College proposal' : 'Client proposal'} · ${proposal.source === 'agent' ? 'written by the agent' : `prepared by ${proposal.prepared_by ?? 'the team'}`} · updated ${fmtAgo(proposal.updated_at)}`}
        actions={
          <a href={`/print/proposals/${proposal.id}`} target="_blank" rel="noopener noreferrer" className="btn-primary">
            <Download size={15} /> Download PDF
          </a>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] xl:items-start">
        <Card title="Edit the proposal" note="Changes appear in the PDF as soon as you save.">
          <ProposalForm
            proposal={{
              id: proposal.id,
              kind: proposal.kind,
              title: proposal.title,
              sections: proposal.sections,
              currency: proposal.currency,
              price_min: proposal.price_min,
              price_max: proposal.price_max,
              monthly_min: proposal.monthly_min,
              monthly_max: proposal.monthly_max,
            }}
          />
        </Card>

        <div className="flex min-w-0 flex-col gap-4">
          <Card title="Status">
            <div className="text-sm text-ink-900">
              {proposal.status === 'sent' ? (
                <span className="inline-flex h-5 items-center rounded bg-[#DCFAE5] px-1.5 text-xs font-medium text-[#0B3D1C]">Sent to the client</span>
              ) : (
                <span className="inline-flex h-5 items-center rounded bg-flame-tint px-1.5 text-xs font-medium text-flame-ink">Draft</span>
              )}
              <p className="mt-2 text-ink-700">
                {proposal.kind === 'college' ? 'Fee' : 'Range'}: <span className="num font-medium">{fmtRange(proposal.price_min, proposal.price_max, proposal.currency)}</span>
              </p>
              <p className="mt-1 text-xs text-ink-500">Created {fmtDateTime(proposal.created_at)}</p>
            </div>
            <ol className="mt-4 list-decimal space-y-1 pl-5 text-sm text-ink-700">
              <li>Check and edit the text, then Save.</li>
              <li>Click Download PDF and choose &ldquo;Save as PDF&rdquo;.</li>
              <li>Attach it to your email from the lead page.</li>
              <li>Click Mark proposal sent.</li>
            </ol>
            {proposal.status !== 'sent' && (
              <form action={markProposalSentAction} className="mt-4">
                <input type="hidden" name="id" value={proposal.id} />
                <button type="submit" className="btn-ghost">
                  Mark proposal sent
                </button>
              </form>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
