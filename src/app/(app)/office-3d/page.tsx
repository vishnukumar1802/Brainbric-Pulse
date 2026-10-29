import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/ui';
import { Office3DLazy } from '@/components/office3d/Office3DLazy';
import { requirePermission } from '@/lib/auth';

export const metadata = { title: '3D office preview' };

export default async function Office3DPage() {
  await requirePermission('leads');
  return (
    <>
      <Link href="/" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 hover:text-ink-900">
        <ArrowLeft size={15} /> Overview
      </Link>
      <PageHeader
        title="3D office preview"
        subtitle="A first look at the Overview as a real 3D office: realistic people walking, sitting at desks and chatting. Not connected to the agents yet."
      />
      <Office3DLazy />
      <p className="mt-3 max-w-[75ch] text-xs text-ink-500">
        People are from Microsoft&apos;s open Rocketbox library (MIT licence) with motion-captured movement. In the full version every agent gets a body
        that matches their portrait and moves with their real work, as the current office does.
      </p>
    </>
  );
}
