import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';
import { liveEventsSince } from '@/lib/live';

export const dynamic = 'force-dynamic';

/** What the agents did since the office last asked. Polled every few seconds by the Overview. */
export async function GET(req: Request) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const since = Number(new URL(req.url).searchParams.get('since')) || null;
  const events = await liveEventsSince(since);
  return NextResponse.json({ events }, { headers: { 'Cache-Control': 'no-store' } });
}
