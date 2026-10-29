import { NextResponse } from 'next/server';
import { z } from 'zod';
import { agentAuthorized } from '@/lib/agentAuth';
import { one, q } from '@/lib/db';
import { takeNotes } from '@/lib/chat';
import { addLiveEvents } from '@/lib/live';
import { addTickets, finishSupportRun, startSupportRun, SUPPORT_AGENT, supportCursor, supportRules, supportShouldRun, TICKET_CATEGORIES, TICKET_PRIORITIES } from '@/lib/support';

export const dynamic = 'force-dynamic';

/**
 * The Support Desk's first call each run:
 *   GET /api/support   (Authorization: Bearer INGEST_TOKEN)
 * Replies {"run": true, "since": "<ISO time>", "rules": "<which mail is support>"} or {"run": false, "reason": "..."}.
 */
export async function GET(req: Request) {
  if (!agentAuthorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const row = await one<{ paused: boolean }>('SELECT paused FROM agents WHERE slug = $1', [SUPPORT_AGENT]);
  const go = supportShouldRun(Boolean(row?.paused));
  if (!go.run) return NextResponse.json(go, { headers: { 'Cache-Control': 'no-store' } });
  const since = await supportCursor();
  await startSupportRun();
  await addLiveEvents(SUPPORT_AGENT, [{ step: 'started', text: null }, { step: 'searching', text: 'Reading support mail' }]);
  const body = { run: true, since, rules: await supportRules(), instructions: await takeNotes(SUPPORT_AGENT) };
  return NextResponse.json(body, { headers: { 'Cache-Control': 'no-store' } });
}

const Ticket = z.object({
  thread_id: z.string().trim().min(4).max(400),
  message_id: z.string().trim().min(4).max(400),
  from_name: z.string().trim().max(200).nullish(),
  from_email: z.string().trim().max(320).nullish(),
  company: z.string().trim().max(200).nullish(),
  subject: z.string().trim().max(500).nullish(),
  summary: z.string().trim().min(3).max(2000),
  category: z.enum(TICKET_CATEGORIES),
  priority: z.enum(TICKET_PRIORITIES),
  received_at: z.string().trim().max(40).refine((v) => !Number.isNaN(Date.parse(v)), 'received_at must be a date'),
  web_link: z
    .string()
    .trim()
    .max(2000)
    .refine((v) => /^https:\/\/outlook\.(office365|office|live)\.com\//.test(v), 'web_link must be an Outlook link')
    .nullish(),
  draft: z.string().trim().max(8000).nullish(),
});

/**
 * The Support Desk posts what it found (one entry per support email; the reply draft is already in Outlook):
 *   POST /api/support  {"tickets": [...], "summary": "2 new tickets, 1 update"}
 * An empty list still records the run.
 */
export async function POST(req: Request) {
  if (!agentAuthorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Body must be JSON.' }, { status: 400 });
  }
  const parsed = z.object({ tickets: z.array(Ticket).max(30), summary: z.string().trim().max(500).nullish() }).safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload', issues: parsed.error.issues.slice(0, 5) }, { status: 400 });
  const { added, updated } = await addTickets(parsed.data.tickets);
  await finishSupportRun();
  const summary = parsed.data.summary || (added || updated ? `${added} new, ${updated} updated tickets` : 'No new support mail');
  await q('INSERT INTO agent_runs (agent, status, summary, stats) VALUES ($1, $2, $3, $4::text::jsonb)', [
    SUPPORT_AGENT,
    'ok',
    summary,
    JSON.stringify({ new_tickets: added, updated_tickets: updated }),
  ]);
  await addLiveEvents(SUPPORT_AGENT, [{ step: 'finished', text: summary }]);
  return NextResponse.json({ ok: true, added, updated });
}
