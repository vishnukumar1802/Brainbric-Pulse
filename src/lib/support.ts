import 'server-only';
import { getSetting, one, q } from './db';
import { addLiveEvents } from './live';
import { istHour } from './mail';

/**
 * The Support Desk agent (Kavya): reads client support mail, keeps one ticket per email thread here and leaves a
 * reply draft in Outlook for the team to send. It never sends anything itself.
 */
export const SUPPORT_AGENT = 'support-desk';
/** Working hours, India time. */
export const SUPPORT_HOURS = { from: 9, to: 19 };

export const TICKET_CATEGORIES = ['bug', 'question', 'change', 'billing', 'other'] as const;
export const TICKET_PRIORITIES = ['urgent', 'high', 'normal', 'low'] as const;
export const TICKET_STATUSES = ['open', 'waiting', 'solved'] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const CATEGORY_LABEL: Record<string, string> = { bug: 'Bug', question: 'Question', change: 'Change request', billing: 'Billing', other: 'Other' };
export const STATUS_LABEL: Record<string, string> = { open: 'Open', waiting: 'Waiting on client', solved: 'Solved' };

export type Ticket = {
  id: number;
  thread_id: string;
  from_name: string | null;
  from_email: string | null;
  company: string | null;
  subject: string | null;
  summary: string | null;
  category: string;
  priority: string;
  status: TicketStatus;
  draft: string | null;
  web_link: string | null;
  lead_id: string | null;
  messages: number;
  received_at: string;
  solved_at: string | null;
  solved_by: string | null;
  updated_at: string;
};

export type TicketIn = {
  thread_id: string;
  message_id: string;
  from_name?: string | null;
  from_email?: string | null;
  company?: string | null;
  subject?: string | null;
  summary: string;
  category: (typeof TICKET_CATEGORIES)[number];
  priority: (typeof TICKET_PRIORITIES)[number];
  received_at: string;
  web_link?: string | null;
  draft?: string | null;
};

/** Which mail counts as support, in the admin's words (Settings). The agent reads this on every run. */
export const DEFAULT_SUPPORT_RULES =
  "Support requests from existing clients in the main Outlook inbox: problems with a website, app or software we built, questions about it, change requests and billing questions. Not sales enquiries, newsletters, notifications or anything from inside Brainbric.";

export async function supportRules(): Promise<string> {
  return (await getSetting('support_rules'))?.trim() || DEFAULT_SUPPORT_RULES;
}

/** Look for mail after the newest ticket message already posted (the first run looks back two days). */
export async function supportCursor(): Promise<string> {
  const row = await one<{ last: string | null }>('SELECT MAX(received_at) AS last FROM tickets');
  const fallback = new Date(Date.now() - 2 * 86400_000);
  const last = row?.last ? new Date(row.last) : null;
  return (last && last > fallback ? last : fallback).toISOString();
}

export function supportShouldRun(paused: boolean): { run: false; reason: string } | { run: true } {
  if (paused) return { run: false, reason: 'paused' };
  const h = istHour();
  if (h < SUPPORT_HOURS.from || h >= SUPPORT_HOURS.to) return { run: false, reason: 'outside hours' };
  return { run: true };
}

/** Save tickets: a new thread opens a ticket; a new message on a known thread updates it and opens it again. */
export async function addTickets(items: TicketIn[]): Promise<{ added: number; updated: number }> {
  let added = 0;
  let updated = 0;
  for (const t of items.slice(0, 30)) {
    const email = t.from_email?.trim().toLowerCase() || null;
    const lead = email ? await one<{ id: string }>('SELECT id FROM leads WHERE lower(email) = $1 ORDER BY updated_at DESC LIMIT 1', [email]) : null;
    const rows = await q<{ inserted: boolean }>(
      `INSERT INTO tickets (thread_id, message_id, from_name, from_email, company, subject, summary, category, priority, draft, web_link, lead_id, received_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       ON CONFLICT (thread_id) DO UPDATE SET
         message_id = EXCLUDED.message_id, summary = EXCLUDED.summary, priority = EXCLUDED.priority,
         draft = COALESCE(EXCLUDED.draft, tickets.draft), web_link = COALESCE(EXCLUDED.web_link, tickets.web_link),
         received_at = EXCLUDED.received_at, messages = tickets.messages + 1, status = 'open', solved_at = NULL, solved_by = NULL,
         updated_at = now()
       WHERE tickets.message_id IS DISTINCT FROM EXCLUDED.message_id
       RETURNING (xmax = 0) AS inserted`,
      [
        t.thread_id,
        t.message_id,
        t.from_name?.slice(0, 120) || null,
        email,
        t.company?.slice(0, 120) || null,
        t.subject?.slice(0, 300) || null,
        t.summary.slice(0, 1200),
        t.category,
        t.priority,
        t.draft?.slice(0, 6000) || null,
        t.web_link || null,
        lead?.id ?? null,
        t.received_at,
      ],
    );
    if (!rows.length) continue;
    if (rows[0].inserted) added++;
    else updated++;
    await addLiveEvents(SUPPORT_AGENT, [{ step: 'drafted', text: `Reply drafted: ${t.subject || t.from_name || 'ticket'}` }]);
  }
  return { added, updated };
}

export async function listTickets(status: TicketStatus | 'all', limit = 100): Promise<Ticket[]> {
  const order = `ORDER BY CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END, updated_at DESC`;
  return status === 'all'
    ? q<Ticket>(`SELECT * FROM tickets ORDER BY updated_at DESC LIMIT $1`, [limit])
    : q<Ticket>(`SELECT * FROM tickets WHERE status = $1 ${status === 'solved' ? 'ORDER BY solved_at DESC NULLS LAST' : order} LIMIT $2`, [status, limit]);
}

export async function ticketCounts(): Promise<Record<TicketStatus, number> & { urgent: number }> {
  const r = await one<{ open: number; waiting: number; solved: number; urgent: number }>(
    `SELECT COUNT(*) FILTER (WHERE status = 'open')::int AS open,
            COUNT(*) FILTER (WHERE status = 'waiting')::int AS waiting,
            COUNT(*) FILTER (WHERE status = 'solved')::int AS solved,
            COUNT(*) FILTER (WHERE status = 'open' AND priority IN ('urgent','high'))::int AS urgent
       FROM tickets`,
  );
  return r ?? { open: 0, waiting: 0, solved: 0, urgent: 0 };
}

export async function setTicketStatus(id: number, status: TicketStatus, by: string): Promise<void> {
  await q(
    `UPDATE tickets SET status = $2, solved_at = CASE WHEN $2 = 'solved' THEN now() ELSE NULL END,
            solved_by = CASE WHEN $2 = 'solved' THEN $3 ELSE NULL END, updated_at = now()
      WHERE id = $1`,
    [id, status, by],
  );
}
