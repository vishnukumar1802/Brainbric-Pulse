import Link from 'next/link';
import { AgentFace } from '@/components/AgentFace';
import { Markdown } from '@/components/Markdown';
import { Card, Empty, PageHeader } from '@/components/ui';
import { requirePermission } from '@/lib/auth';
import { fmtAgo } from '@/lib/format';
import { listHires, type Hire } from '@/lib/hr';
import { HireDecision } from './HireDecision';

export const metadata = { title: 'Hiring' };

const STATUS: Record<string, { label: string; cls: string }> = {
  proposed: { label: 'Waiting for you', cls: 'bg-flame-tint text-flame-ink' },
  approved: { label: 'Hired, setting up', cls: 'bg-[#EEF1F5] text-[#2F4058]' },
  active: { label: 'Working', cls: 'bg-[#DCFAE5] text-[#0B3D1C]' },
  rejected: { label: 'Declined', cls: 'bg-[#F0EEEB] text-ink-500' },
  retired: { label: 'Let go', cls: 'bg-[#F0EEEB] text-ink-500' },
};

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[9rem_minmax(0,1fr)]">
      <div className="text-xs font-medium text-ink-500">{label}</div>
      <div className="whitespace-pre-wrap text-sm text-ink-800">{children}</div>
    </div>
  );
}

function HireCard({ h, admin }: { h: Hire; admin: boolean }) {
  const s = STATUS[h.status];
  return (
    <section className="card px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <AgentFace slug={h.slug} name={h.name} size={40} />
          <div className="min-w-0">
            <div className="text-[15px] font-semibold text-ink-950">
              {h.name} <span className="font-normal text-ink-500">· {h.title}</span>
            </div>
            <div className="text-xs text-ink-500">
              Proposed by Lakshmi {fmtAgo(h.created_at)}
              {h.request_id && (
                <>
                  {' · for '}
                  <Link href={`/lead/${h.request_id}`} className="underline-offset-2 hover:underline">
                    {h.request_title ?? `request ${h.request_id}`}
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
        <span className={`inline-flex h-5 shrink-0 items-center rounded px-1.5 text-xs font-medium ${s.cls}`}>{s.label}</span>
      </div>

      <p className="mt-3 text-sm text-ink-800">{h.summary}</p>

      <div className="mt-3 flex flex-col gap-2">
        {h.skills && <Row label="Skills">{h.skills}</Row>}
        {h.tools && <Row label="Works with">{h.tools}</Row>}
        {h.schedule && <Row label="Schedule">{h.schedule}</Row>}
        {h.est_cost && <Row label="Estimated cost">{h.est_cost}</Row>}
        {h.needs_from_owner && <Row label="Needs from you">{h.needs_from_owner}</Row>}
      </div>

      <details className="mt-3">
        <summary className="cursor-pointer text-xs font-medium text-ink-500 hover:text-ink-950">Full role brief (how this agent works)</summary>
        <div className="mt-2 rounded-md border border-paper-line bg-paper/60 px-4 py-3 text-sm">
          <Markdown>{h.brief}</Markdown>
        </div>
      </details>

      {h.status === 'approved' && (
        <p className="mt-3 rounded-md bg-[#EEF1F5] px-3 py-2 text-sm text-[#2F4058]">
          Hired by {h.decided_by}. Last step: tell Claude <span className="font-medium">&ldquo;set up {h.name}&rdquo;</span> to give {h.name} a working schedule. The status turns to
          Working at {h.name}&apos;s first check-in.
        </p>
      )}

      {admin && (h.status === 'proposed' || h.status === 'approved' || h.status === 'active') && (
        <div className="mt-4 border-t border-paper-rule pt-3">
          <HireDecision id={h.id} mode={h.status === 'proposed' ? 'proposal' : 'hired'} />
        </div>
      )}
    </section>
  );
}

export default async function HiringPage() {
  const user = await requirePermission('agents');
  const hires = await listHires();
  const open = hires.filter((h) => h.status === 'proposed');
  const team = hires.filter((h) => h.status === 'approved' || h.status === 'active');
  const past = hires.filter((h) => h.status === 'rejected' || h.status === 'retired');
  const admin = user.role === 'admin';

  return (
    <>
      <PageHeader
        title="Hiring"
        subtitle="Lakshmi (HR) reads Arvind's plans and proposes a specialist when a project needs skills the team doesn't have. Nobody joins until you approve."
      />

      <div className="flex flex-col gap-8">
        <div>
          <h2 className="mb-3 text-[15px] font-semibold text-ink-950">Waiting for your decision</h2>
          {open.length ? (
            <div className="flex flex-col gap-4">
              {open.map((h) => (
                <HireCard key={h.id} h={h} admin={admin} />
              ))}
            </div>
          ) : (
            <Empty title="No proposals">Lakshmi proposes a hire when one of Arvind&apos;s plans needs a role nobody on the team has.</Empty>
          )}
        </div>

        {team.length > 0 && (
          <div>
            <h2 className="mb-3 text-[15px] font-semibold text-ink-950">Hired by HR</h2>
            <div className="flex flex-col gap-4">
              {team.map((h) => (
                <HireCard key={h.id} h={h} admin={admin} />
              ))}
            </div>
          </div>
        )}

        {past.length > 0 && (
          <Card flush title="Earlier proposals">
            <ul className="divide-y divide-paper-rule">
              {past.map((h) => (
                <li key={h.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                  <span className="min-w-0 truncate text-ink-900">
                    {h.name} · {h.title}
                  </span>
                  <span className="shrink-0 text-xs text-ink-500">
                    {STATUS[h.status].label}
                    {h.decided_by ? ` by ${h.decided_by}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </>
  );
}
