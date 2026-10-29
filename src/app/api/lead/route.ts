import { NextResponse } from 'next/server';
import { z } from 'zod';
import { agentAuthorized } from '@/lib/agentAuth';
import { q } from '@/lib/db';
import { agentPaused, applyLeadUpdate, LEAD_AGENT, leadQueue, REQUEST_STATUSES } from '@/lib/lead';
import { addLiveEvents } from '@/lib/live';

export const dynamic = 'force-dynamic';

/**
 * The Team Lead's first call each run:
 *   GET /api/lead   (Authorization: Bearer INGEST_TOKEN)
 * Replies {"run": true, "requests": [...], "projects": [...]} with every request that needs the lead, or {"run": false}.
 */
export async function GET(req: Request) {
  if (!agentAuthorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (await agentPaused(LEAD_AGENT)) return NextResponse.json({ run: false, reason: 'paused' }, { headers: { 'Cache-Control': 'no-store' } });
  const queue = await leadQueue();
  if (queue.requests.length) await addLiveEvents(LEAD_AGENT, [{ step: 'started', text: null }, { step: 'searching', text: 'Reviewing requests' }]);
  return NextResponse.json({ run: queue.requests.length > 0, ...queue }, { headers: { 'Cache-Control': 'no-store' } });
}

const url = z.string().trim().url().max(1000).refine((v) => v.startsWith('https://'), 'must be https').nullish();
const Update = z.object({
  request_id: z.number().int().positive(),
  status: z.enum(REQUEST_STATUSES).optional(),
  plan: z.string().max(20000).nullish(),
  questions: z.string().max(4000).nullish(),
  summary: z.string().max(4000).nullish(),
  preview_url: url,
  pr_url: url,
  live_url: url,
  project: z
    .object({
      name: z.string().trim().min(2).max(120),
      repo: z.string().trim().regex(/^[\w.-]+\/[\w.-]+$/, 'repo must be owner/name').nullish(),
      live_url: url,
      vercel_project: z.string().trim().max(120).nullish(),
      description: z.string().trim().max(500).nullish(),
    })
    .nullish(),
  tasks: z
    .array(z.object({ title: z.string().trim().min(3).max(200), details: z.string().max(4000).nullish(), role: z.enum(['developer', 'qa', 'devops']).optional() }))
    .max(40)
    .optional(),
  start_tasks: z.boolean().optional(),
  log: z.string().max(600).nullish(),
});

/**
 * The lead posts what it did, one entry per request:
 *   POST /api/lead  {"updates": [{"request_id": 3, "status": "plan_ready", "plan": "...", "tasks": [...], "log": "..."}], "summary": "..."}
 * Agents cannot approve: "approved" and "going_live" are set by people in the portal.
 */
export async function POST(req: Request) {
  if (!agentAuthorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Body must be JSON.' }, { status: 400 });
  }
  const parsed = z.object({ updates: z.array(Update).max(10), summary: z.string().trim().max(500).nullish() }).safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload', issues: parsed.error.issues.slice(0, 5) }, { status: 400 });
  const errors: string[] = [];
  for (const u of parsed.data.updates) {
    const err = await applyLeadUpdate({ ...u, preview_url: u.preview_url ?? undefined, pr_url: u.pr_url ?? undefined, live_url: u.live_url ?? undefined });
    if (err) errors.push(err);
  }
  const summary = parsed.data.summary || `${parsed.data.updates.length - errors.length} requests updated`;
  await q('INSERT INTO agent_runs (agent, status, summary, stats) VALUES ($1, $2, $3, $4::text::jsonb)', [
    LEAD_AGENT,
    errors.length ? 'warning' : 'ok',
    summary,
    JSON.stringify({ updates: parsed.data.updates.length, errors: errors.length }),
  ]);
  await addLiveEvents(LEAD_AGENT, [{ step: 'finished', text: summary }]);
  return NextResponse.json({ ok: errors.length === 0, errors });
}
