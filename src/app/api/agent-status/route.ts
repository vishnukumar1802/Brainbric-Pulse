import { NextResponse } from 'next/server';
import { agentAuthorized } from '@/lib/agentAuth';
import { one } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * Agents call this before doing any work:
 *   GET /api/agent-status?agent=lead-hunter   (Authorization: Bearer INGEST_TOKEN)
 * and stop at once when "paused" is true. An agent the portal hasn't seen yet is not paused.
 */
export async function GET(req: Request) {
  if (!agentAuthorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const slug = new URL(req.url).searchParams.get('agent')?.trim() ?? '';
  if (!/^[a-z0-9][a-z0-9-]{1,48}$/.test(slug)) {
    return NextResponse.json({ error: 'Pass ?agent=<slug>, for example ?agent=lead-hunter' }, { status: 400 });
  }
  const row = await one<{ paused: boolean; paused_at: string | null; paused_by: string | null }>(
    'SELECT paused, paused_at, paused_by FROM agents WHERE slug = $1',
    [slug],
  );
  return NextResponse.json(
    { agent: slug, paused: Boolean(row?.paused), paused_at: row?.paused_at ?? null, paused_by: row?.paused_by ?? null },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
