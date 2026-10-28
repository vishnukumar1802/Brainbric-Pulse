import { NextResponse } from 'next/server';
import { agentAuthorized } from '@/lib/agentAuth';
import { one } from '@/lib/db';
import { ensureMailAgent, istHour, MAIL_AGENT, MAIL_HOURS, mailCursor } from '@/lib/mail';

export const dynamic = 'force-dynamic';

/**
 * The Mail Watcher's first call each run:
 *   GET /api/mail/check   (Authorization: Bearer INGEST_TOKEN)
 * Replies {"watch": true, "since": "<ISO time>"} when it should look for mail received after `since`,
 * or {"watch": false, "reason": "paused" | "outside hours"} when it should stop at once.
 */
export async function GET(req: Request) {
  if (!agentAuthorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  await ensureMailAgent();
  const row = await one<{ paused: boolean }>('SELECT paused FROM agents WHERE slug = $1', [MAIL_AGENT]);
  const hour = istHour();
  const body = row?.paused
    ? { watch: false, reason: 'paused' }
    : hour < MAIL_HOURS.from || hour >= MAIL_HOURS.to
      ? { watch: false, reason: 'outside hours' }
      : { watch: true, since: await mailCursor() };
  return NextResponse.json(body, { headers: { 'Cache-Control': 'no-store' } });
}
