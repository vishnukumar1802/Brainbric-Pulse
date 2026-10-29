import { NextResponse } from 'next/server';
import { z } from 'zod';
import { agentAuthorized } from '@/lib/agentAuth';
import { one } from '@/lib/db';
import { addChecks, DEVOPS_AGENT, watchedSites } from '@/lib/devops';
import { takeNotes } from '@/lib/chat';
import { addLiveEvents } from '@/lib/live';

export const dynamic = 'force-dynamic';

/**
 * The DevOps Watch's first call each run:
 *   GET /api/devops   (Authorization: Bearer INGEST_TOKEN)
 * Replies {"run": true, "sites": ["https://..."]} or {"run": false, "reason": "paused"}.
 */
export async function GET(req: Request) {
  if (!agentAuthorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const row = await one<{ paused: boolean }>('SELECT paused FROM agents WHERE slug = $1', [DEVOPS_AGENT]);
  if (row?.paused) return NextResponse.json({ run: false, reason: 'paused' }, { headers: { 'Cache-Control': 'no-store' } });
  await addLiveEvents(DEVOPS_AGENT, [{ step: 'started', text: null }, { step: 'searching', text: 'Checking sites and deployments' }]);
  return NextResponse.json({ run: true, sites: await watchedSites(), instructions: await takeNotes(DEVOPS_AGENT) }, { headers: { 'Cache-Control': 'no-store' } });
}

const Check = z.object({
  kind: z.enum(['site', 'deploy']),
  target: z.string().trim().min(2).max(300),
  ok: z.boolean(),
  status_code: z.number().int().min(0).max(999).nullish(),
  ms: z.number().int().min(0).max(600_000).nullish(),
  note: z.string().trim().max(500).nullish(),
  link: z.string().trim().url().max(1000).refine((v) => v.startsWith('https://'), 'link must be https').nullish(),
});

/**
 * The DevOps Watch posts one entry per site and per Vercel project:
 *   POST /api/devops  {"checks": [{"kind": "site", "target": "https://...", "ok": true, "status_code": 200, "ms": 412},
 *                                 {"kind": "deploy", "target": "brainbric-pulse", "ok": false, "note": "Build failed: ...", "link": "https://vercel.com/..."}],
 *                      "summary": "1 failed deployment"}
 */
export async function POST(req: Request) {
  if (!agentAuthorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Body must be JSON.' }, { status: 400 });
  }
  const parsed = z.object({ checks: z.array(Check).min(1).max(60), summary: z.string().trim().max(500).nullish() }).safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload', issues: parsed.error.issues.slice(0, 5) }, { status: 400 });
  const n = await addChecks(
    parsed.data.checks.map((c) => ({ ...c, status_code: c.status_code ?? null, ms: c.ms ?? null, note: c.note ?? null, link: c.link ?? null })),
    parsed.data.summary ?? null,
  );
  return NextResponse.json({ ok: true, saved: n });
}
