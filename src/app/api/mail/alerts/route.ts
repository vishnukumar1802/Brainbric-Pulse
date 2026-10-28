import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';
import { mailAlerts } from '@/lib/mail';

export const dynamic = 'force-dynamic';

/** The admin's new-mail alerts, polled by the bell. It is the admin's own mailbox, so only admins see it. */
export async function GET() {
  const me = await currentUser();
  if (!me || me.role !== 'admin') return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  return NextResponse.json(await mailAlerts(), { headers: { 'Cache-Control': 'no-store' } });
}
