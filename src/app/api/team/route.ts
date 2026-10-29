import { NextResponse } from 'next/server';
import { z } from 'zod';
import { agentAuthorized } from '@/lib/agentAuth';
import { q } from '@/lib/db';
import { agentPaused, applyTaskUpdate, DEV_AGENT, devQueue, QA_AGENT, qaQueue, TASK_STATUSES } from '@/lib/lead';
import { addLiveEvents } from '@/lib/live';

export const dynamic = 'force-dynamic';

const ROLE = z.enum([DEV_AGENT, QA_AGENT]);

/**
 * The Developer's and the QA Tester's first call each run:
 *   GET /api/team?agent=developer   or   ?agent=qa-tester   (Authorization: Bearer INGEST_TOKEN)
 * Replies {"run": true, "tasks": [...]} (each with its request, project, repo and branch) or {"run": false}.
 */
export async function GET(req: Request) {
  if (!agentAuthorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const agent = ROLE.safeParse(new URL(req.url).searchParams.get('agent'));
  if (!agent.success) return NextResponse.json({ error: 'Pass ?agent=developer or ?agent=qa-tester' }, { status: 400 });
  if (await agentPaused(agent.data)) return NextResponse.json({ run: false, reason: 'paused' }, { headers: { 'Cache-Control': 'no-store' } });
  const tasks = agent.data === DEV_AGENT ? await devQueue() : await qaQueue();
  if (tasks.length) await addLiveEvents(agent.data, [{ step: 'started', text: null }]);
  return NextResponse.json({ run: tasks.length > 0, tasks }, { headers: { 'Cache-Control': 'no-store' } });
}

const url = z.string().trim().url().max(1000).refine((v) => v.startsWith('https://'), 'must be https').nullish();

/**
 * Post task progress:
 *   POST /api/team  {"agent": "developer", "updates": [{"task_id": 7, "status": "testing", "pr_url": "https://github.com/...", "report": "..."}], "summary": "..."}
 * Developer: todo/changes_needed -> in_progress -> testing. QA: testing -> passed | changes_needed (report says why).
 */
export async function POST(req: Request) {
  if (!agentAuthorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Body must be JSON.' }, { status: 400 });
  }
  const parsed = z
    .object({
      agent: ROLE,
      updates: z
        .array(
          z.object({
            task_id: z.number().int().positive(),
            status: z.enum(TASK_STATUSES),
            report: z.string().max(6000).nullish(),
            pr_url: url,
            preview_url: url,
            log: z.string().max(600).nullish(),
          }),
        )
        .max(20),
      summary: z.string().trim().max(500).nullish(),
    })
    .safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload', issues: parsed.error.issues.slice(0, 5) }, { status: 400 });
  const { agent, updates } = parsed.data;
  const errors: string[] = [];
  for (const u of updates) {
    const err = await applyTaskUpdate(agent, u);
    if (err) errors.push(err);
  }
  const summary = parsed.data.summary || `${updates.length - errors.length} tasks updated`;
  await q('INSERT INTO agent_runs (agent, status, summary, stats) VALUES ($1, $2, $3, $4::text::jsonb)', [
    agent,
    errors.length ? 'warning' : 'ok',
    summary,
    JSON.stringify({ updates: updates.length, errors: errors.length }),
  ]);
  await addLiveEvents(agent, [{ step: 'finished', text: summary }]);
  return NextResponse.json({ ok: errors.length === 0, errors });
}
