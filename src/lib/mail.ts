import 'server-only';
import { one, q } from './db';
import { addLiveEvents } from './live';

/** The Mail Watcher agent: checks the admin's Outlook every 2 minutes and posts new outside mail here. */
export const MAIL_AGENT = 'mail-watcher';
/** Watching hours, India time: 9 AM to 9 PM. */
export const MAIL_HOURS = { from: 9, to: 21 };

export type MailAlert = {
  id: number;
  message_id: string;
  from_name: string | null;
  from_email: string | null;
  subject: string | null;
  received_at: string;
  web_link: string | null;
  label: string | null;
  lead_id: string | null;
  seen: boolean;
};

export type MailIn = {
  message_id: string;
  from_name?: string | null;
  from_email?: string | null;
  subject?: string | null;
  received_at: string;
  web_link?: string | null;
  label?: string | null;
};

const FREE_MAIL = /@(gmail|googlemail|yahoo|ymail|outlook|hotmail|live|msn|icloud|me|aol|proton|protonmail|rediffmail|zoho)\./i;

export function istHour(d = new Date()): number {
  return Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', hourCycle: 'h23' }).format(d));
}

export async function ensureMailAgent(): Promise<void> {
  await q(
    `INSERT INTO agents (slug, name, description, schedule, sort) VALUES ($1, 'Mail Watcher', $2, 'Every 2 min, 9 AM to 9 PM', 35)
     ON CONFLICT (slug) DO NOTHING`,
    [MAIL_AGENT, 'Watches your Outlook inbox and tells you the moment outside mail arrives. Reads sender and subject only.'],
  );
}

/** Where the watcher should look from: just after the newest mail it already posted (or the last 10 minutes). */
export async function mailCursor(): Promise<string> {
  const row = await one<{ last: string | null }>('SELECT MAX(received_at) AS last FROM mail_alerts');
  const fallback = new Date(Date.now() - 10 * 60_000);
  const last = row?.last ? new Date(row.last) : null;
  return (last && last > new Date(Date.now() - 6 * 3600_000) ? last : fallback).toISOString();
}

/** Save new mail (ignoring any already saved), tie lead replies to their lead, and send the office a "mail" step. */
export async function addMail(items: MailIn[]): Promise<number> {
  let added = 0;
  for (const m of items.slice(0, 50)) {
    const email = m.from_email?.trim().toLowerCase() || null;
    // A reply from someone the agents already found is a lead reply.
    let lead: { id: string } | null = null;
    if (email) {
      lead = await one<{ id: string }>('SELECT id FROM leads WHERE lower(email) = $1 ORDER BY updated_at DESC LIMIT 1', [email]);
      if (!lead && !FREE_MAIL.test(email)) {
        const domain = email.split('@')[1];
        if (domain) lead = await one<{ id: string }>("SELECT id FROM leads WHERE lower(email) LIKE $1 ORDER BY updated_at DESC LIMIT 1", [`%@${domain}`]);
      }
    }
    const rows = await q<{ id: number }>(
      `INSERT INTO mail_alerts (message_id, from_name, from_email, subject, received_at, web_link, label, lead_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (message_id) DO NOTHING RETURNING id`,
      [m.message_id, m.from_name?.slice(0, 120) || null, email, m.subject?.slice(0, 300) || null, m.received_at, m.web_link || null, lead ? 'lead' : m.label || 'other', lead?.id ?? null],
    );
    if (rows.length) {
      added++;
      await addLiveEvents(MAIL_AGENT, [{ step: 'mail', text: `${m.from_name || email || 'Someone'}: ${m.subject || '(no subject)'}` }]);
    }
  }
  if (added) {
    await q('INSERT INTO agent_runs (agent, status, summary, stats) VALUES ($1, $2, $3, $4::text::jsonb)', [
      MAIL_AGENT,
      'ok',
      `${added} new ${added === 1 ? 'mail' : 'mails'} in the inbox`,
      JSON.stringify({ mails: added }),
    ]);
  }
  // Keep a month of alerts.
  if (Math.random() < 0.05) await q("DELETE FROM mail_alerts WHERE received_at < now() - interval '30 days'");
  return added;
}

export async function mailAlerts(limit = 25): Promise<{ items: MailAlert[]; unseen: number }> {
  const [items, count] = await Promise.all([
    q<MailAlert>('SELECT * FROM mail_alerts ORDER BY received_at DESC, id DESC LIMIT $1', [limit]),
    one<{ n: number }>('SELECT COUNT(*)::int AS n FROM mail_alerts WHERE NOT seen'),
  ]);
  return { items, unseen: count?.n ?? 0 };
}
