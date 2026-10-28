import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';
import { q } from '@/lib/db';

export const dynamic = 'force-dynamic';

/** Mark one alert ({"id": 12}) or all of them ({"all": true}) as seen. */
export async function POST(req: Request) {
  const me = await currentUser();
  if (!me || me.role !== 'admin') return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { id?: unknown; all?: unknown };
  if (body.all === true) await q('UPDATE mail_alerts SET seen = TRUE WHERE NOT seen');
  else if (Number.isInteger(body.id)) await q('UPDATE mail_alerts SET seen = TRUE WHERE id = $1', [body.id]);
  else return NextResponse.json({ error: 'Pass id or all' }, { status: 400 });
  return NextResponse.json({ ok: true });
}
