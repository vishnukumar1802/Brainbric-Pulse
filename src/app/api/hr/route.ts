import { NextResponse } from 'next/server';
import { z } from 'zod';
import { agentAuthorized } from '@/lib/agentAuth';
import { q } from '@/lib/db';
import { HR_AGENT, hrQueue, proposeHires, SLUG_RE } from '@/lib/hr';
import { agentPaused } from '@/lib/lead';
import { takeNotes } from '@/lib/chat';
import { addLiveEvents } from '@/lib/live';

export const dynamic = 'force-dynamic';

/**
 * HR's first call each run:
 *   GET /api/hr   (Authorization: Bearer INGEST_TOKEN)
 * Replies {"run": true, "team": [...], "hires": [...], "unfilled_roles": [...], "requests": [...]} or {"run": false}.
 * It runs only when there is something to look at: a role nobody fills, or open requests with a plan.
 */
export async function GET(req: Request) {
  if (!agentAuthorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (await agentPaused(HR_AGENT)) return NextResponse.json({ run: false, reason: 'paused' }, { headers: { 'Cache-Control': 'no-store' } });
  const queue = await hrQueue();
  const instructions = await takeNotes(HR_AGENT);
  const run = instructions.length > 0 || queue.unfilled_roles.length > 0 || queue.requests.some((r) => r.status === 'plan_ready');
  if (run) await addLiveEvents(HR_AGENT, [{ step: 'started', text: null }, { step: 'searching', text: 'Checking the team against the plans' }]);
  return NextResponse.json({ run, instructions, ...queue }, { headers: { 'Cache-Control': 'no-store' } });
}

const Hire = z.object({
  slug: z.string().trim().regex(SLUG_RE, 'slug: lower-case words joined by dashes, e.g. mobile-developer'),
  title: z.string().trim().min(3).max(80),
  name: z.string().trim().min(2).max(40),
  summary: z.string().trim().min(10).max(600),
  skills: z.string().max(2000).nullish(),
  brief: z.string().trim().min(200).max(12000),
  tools: z.string().max(1000).nullish(),
  schedule: z.string().max(120).nullish(),
  est_cost: z.string().max(200).nullish(),
  needs_from_owner: z.string().max(1000).nullish(),
  request_id: z.number().int().positive().nullish(),
});

/**
 * HR posts hiring proposals (each waits for a person to approve it on the Hiring page):
 *   POST /api/hr  {"proposals": [{"slug": "mobile-developer", "title": "Mobile App Developer", "name": "Rohan", "summary": "...",
 *                  "skills": "...", "brief": "<the full role brief>", "tools": "...", "schedule": "...", "est_cost": "...",
 *                  "needs_from_owner": "...", "request_id": 4}], "summary": "..."}
 */
export async function POST(req: Request) {
  if (!agentAuthorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Body must be JSON.' }, { status: 400 });
  }
  const parsed = z.object({ proposals: z.array(Hire).max(5), summary: z.string().trim().max(500).nullish() }).safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload', issues: parsed.error.issues.slice(0, 5) }, { status: 400 });
  const { added, skipped } = await proposeHires(parsed.data.proposals);
  const summary = parsed.data.summary || (added ? `${added} hiring ${added === 1 ? 'proposal' : 'proposals'}` : 'The team covers every plan');
  await q('INSERT INTO agent_runs (agent, status, summary, stats) VALUES ($1, $2, $3, $4::text::jsonb)', [HR_AGENT, 'ok', summary, JSON.stringify({ proposals: added })]);
  await addLiveEvents(HR_AGENT, [{ step: 'finished', text: summary }]);
  return NextResponse.json({ ok: true, added, skipped });
}
