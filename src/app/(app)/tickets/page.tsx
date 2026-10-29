import Link from 'next/link';
import { setTicketStatusAction, ticketToLeadAction } from '@/app/actions';
import { Card, Empty, PageHeader } from '@/components/ui';
import { requirePermission } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { fmtAgo } from '@/lib/format';
import { CATEGORY_LABEL, listTickets, STATUS_LABEL, supportRules, ticketCounts, TICKET_STATUSES, type Ticket, type TicketStatus } from '@/lib/support';
import { RulesForm } from './RulesForm';

export const metadata = { title: 'Tickets' };

const PRIORITY: Record<string, { label: string; cls: string }> = {
  urgent: { label: 'Urgent', cls: 'bg-[#FFEDEA] text-[#831C1E]' },
  high: { label: 'High', cls: 'bg-[#FFF3D6] text-[#7A4E00]' },
  normal: { label: 'Normal', cls: 'bg-paper-active text-ink-700' },
  low: { label: 'Low', cls: 'bg-paper-active text-ink-500' },
};

function StatusButton({ id, status, children, primary = false }: { id: number; status: TicketStatus; children: React.ReactNode; primary?: boolean }) {
  return (
    <form action={setTicketStatusAction}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={status} />
      <button type="submit" className={primary ? 'btn-dark' : 'btn'}>
        {children}
      </button>
    </form>
  );
}

function TicketRow({ t, canLead }: { t: Ticket; canLead: boolean }) {
  const p = PRIORITY[t.priority] ?? PRIORITY.normal;
  const who = [t.from_name || t.from_email, t.company].filter(Boolean).join(' · ');
  return (
    <li className="px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex h-5 items-center rounded px-1.5 text-xs font-medium ${p.cls}`}>{p.label}</span>
            <span className="text-xs text-ink-500">{CATEGORY_LABEL[t.category] ?? t.category}</span>
            {t.messages > 1 && <span className="text-xs text-ink-500">· {t.messages} messages</span>}
          </div>
          <div className="mt-1 text-sm font-medium text-ink-950">{t.subject || '(no subject)'}</div>
          <div className="mt-0.5 text-xs text-ink-500">
            {who}
            {t.lead_id && (
              <>
                {' · '}
                <Link href={`/leads/${encodeURIComponent(t.lead_id)}`} className="underline-offset-2 hover:underline">
                  lead
                </Link>
              </>
            )}
            {' · '}
            {fmtAgo(t.received_at)}
          </div>
          {t.summary && <p className="mt-2 max-w-[80ch] text-sm text-ink-700">{t.summary}</p>}
          {t.draft && (
            <details className="mt-2 max-w-[80ch]">
              <summary className="cursor-pointer text-xs font-medium text-ink-500 hover:text-ink-950">Kavya&apos;s reply draft (also in your Outlook drafts)</summary>
              <div className="mt-2 whitespace-pre-wrap rounded-md border border-paper-line bg-paper/60 px-3 py-2 text-sm text-ink-800">{t.draft}</div>
            </details>
          )}
          {t.status === 'solved' && t.solved_by && <div className="mt-2 text-xs text-ink-500">Solved by {t.solved_by} {fmtAgo(t.solved_at)}</div>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {t.web_link && (
            <a href={t.web_link} target="_blank" rel="noreferrer" className="btn-outlook">
              Open in Outlook
            </a>
          )}
          {canLead && t.status !== 'solved' && (
            <form action={ticketToLeadAction}>
              <input type="hidden" name="id" value={t.id} />
              <button type="submit" className="btn" title="Make this a change request for the Team Lead">
                Send to Arvind
              </button>
            </form>
          )}
          {t.status !== 'waiting' && t.status !== 'solved' && <StatusButton id={t.id} status="waiting">Replied, waiting</StatusButton>}
          {t.status !== 'solved' ? (
            <StatusButton id={t.id} status="solved" primary>
              Solved
            </StatusButton>
          ) : (
            <StatusButton id={t.id} status="open">Reopen</StatusButton>
          )}
        </div>
      </div>
    </li>
  );
}

export default async function TicketsPage({ searchParams }: { searchParams: { status?: string } }) {
  const user = await requirePermission('support');
  const status = ((TICKET_STATUSES as readonly string[]).includes(searchParams.status ?? '') ? searchParams.status : 'open') as TicketStatus;
  const [tickets, counts, rules] = await Promise.all([listTickets(status), ticketCounts(), user.role === 'admin' ? supportRules() : Promise.resolve('')]);

  return (
    <>
      <PageHeader
        title="Tickets"
        subtitle="Client support emails, one ticket per email thread. Kavya (Support Desk) sorts them and leaves a reply draft in Outlook; you check it and send."
      />

      <div className="mb-5 flex flex-wrap gap-2">
        {TICKET_STATUSES.map((s) => (
          <Link
            key={s}
            href={s === 'open' ? '/tickets' : `/tickets?status=${s}`}
            className={`rounded-md px-2.5 py-1 text-[13px] ${status === s ? 'bg-paper-active font-medium text-ink-950' : 'text-ink-700 hover:bg-paper-active/60 hover:text-ink-950'}`}
          >
            {STATUS_LABEL[s]} <span className="ml-1 tabular-nums opacity-60">{counts[s]}</span>
          </Link>
        ))}
      </div>

      {tickets.length === 0 ? (
        <Empty title={status === 'open' ? 'No open tickets' : `Nothing ${STATUS_LABEL[status].toLowerCase()}`}>
          {status === 'open' ? 'New client support emails show up here after Kavya’s next check (every hour, 9 AM to 7 PM).' : null}
        </Empty>
      ) : (
        <ul className="card divide-y divide-paper-rule">
          {tickets.map((t) => (
            <TicketRow key={t.id} t={t} canLead={can(user, 'projects')} />
          ))}
        </ul>
      )}

      {user.role === 'admin' && (
        <Card className="mt-8" title="What counts as support" note="Kavya reads this before every check. Say which mailbox or folder, and which emails to treat as support.">
          <RulesForm rules={rules} />
        </Card>
      )}
    </>
  );
}
