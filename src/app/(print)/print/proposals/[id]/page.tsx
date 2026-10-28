import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { CollegeDoc } from '@/components/proposal/CollegeDoc';
import { SoftwareDoc } from '@/components/proposal/SoftwareDoc';
import { requireUser } from '@/lib/auth';
import { getLead } from '@/lib/leads';
import { can, homeFor } from '@/lib/permissions';
import { getProposal } from '@/lib/proposals';
import { PrintToolbar } from './PrintToolbar';

export const dynamic = 'force-dynamic';

// The browser uses the page title as the PDF file name.
export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const p = await getProposal(Number(params.id) || 0);
  const lead = p ? await getLead(p.lead_id) : null;
  const name = (lead?.company ?? 'Client').replace(/[\\/:*?"<>|]/g, '');
  return { title: { absolute: `Brainbric Proposal - ${name}` } };
}

export default async function PrintProposal({ params }: { params: { id: string } }) {
  const me = await requireUser();
  const p = await getProposal(Number(params.id) || 0);
  if (!p) notFound();
  const lead = await getLead(p.lead_id);
  if (!lead) notFound();
  if (!can(me, lead.kind === 'college' ? 'colleges' : 'leads')) redirect(homeFor(me));
  const sender = { name: me.name, email: me.email };

  return (
    <>
      <PrintToolbar backHref={`/proposals/${p.id}`} />
      {p.kind === 'college' ? <CollegeDoc p={p} lead={lead} sender={sender} /> : <SoftwareDoc p={p} lead={lead} sender={sender} />}
    </>
  );
}
