import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CollegeDoc } from '@/components/proposal/CollegeDoc';
import { SoftwareDoc } from '@/components/proposal/SoftwareDoc';
import { currentUser } from '@/lib/auth';
import { one } from '@/lib/db';
import { getLead } from '@/lib/leads';
import { proposalByToken, recordClientView } from '@/lib/proposals';
import { PrintToolbar } from '../../print/proposals/[id]/PrintToolbar';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: { token: string } }): Promise<Metadata> {
  const p = await proposalByToken(params.token);
  const lead = p ? await getLead(p.lead_id) : null;
  const name = (lead?.company ?? 'Client').replace(/[\\/:*?"<>|]/g, '');
  return {
    title: { absolute: p ? `Brainbric Proposal - ${name}` : 'Proposal not available' },
    robots: { index: false, follow: false },
  };
}

/** The client's view of a proposal: no sign-in, only for a live link. Views by signed-in team members are not counted. */
export default async function ClientProposal({ params }: { params: { token: string } }) {
  const p = await proposalByToken(params.token);
  if (!p) notFound();
  const lead = await getLead(p.lead_id);
  if (!lead) notFound();

  const viewer = await currentUser();
  if (!viewer) await recordClientView(p);

  // Contact on the document: the team member who prepared it, or the company inbox.
  const author =
    p.source === 'portal' && p.prepared_by
      ? await one<{ name: string; email: string | null }>('SELECT name, email FROM users WHERE name = $1 LIMIT 1', [p.prepared_by])
      : null;
  const sender = { name: author?.name ?? 'Brainbric Innovations', email: author?.email ?? 'contact@brainbric.com' };

  return (
    <>
      <PrintToolbar />
      {p.kind === 'college' ? <CollegeDoc p={p} lead={lead} sender={sender} /> : <SoftwareDoc p={p} lead={lead} sender={sender} />}
    </>
  );
}
