import { NextResponse } from 'next/server';
import { z } from 'zod';
import { agentAuthorized } from '@/lib/agentAuth';
import { addLiveEvents, LIVE_STEPS } from '@/lib/live';

export const dynamic = 'force-dynamic';

const Body = z.object({
  agent: z.string().trim().regex(/^[a-z0-9][a-z0-9-]{1,48}$/),
  step: z.enum(LIVE_STEPS),
  text: z.string().trim().max(300).nullish(),
});

/**
 * Agents post each step of a run so the office on the Overview moves in real time:
 *   POST /api/agent-event  (Authorization: Bearer INGEST_TOKEN)
 *   {"agent":"lead-hunter","step":"searching","text":"Searching LinkedIn for clinics in Coimbatore"}
 * Steps: started, searching, found, writing, drafted, finished, failed, note.
 */
export async function POST(req: Request) {
  if (!agentAuthorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Body must be JSON.' }, { status: 400 });
  }
  const parsed = Body.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload', issues: parsed.error.issues.slice(0, 5) }, { status: 400 });
  await addLiveEvents(parsed.data.agent, [{ step: parsed.data.step, text: parsed.data.text }]);
  return NextResponse.json({ ok: true });
}
