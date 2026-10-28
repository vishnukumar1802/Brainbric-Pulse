import { NextResponse } from 'next/server';
import { z } from 'zod';
import { agentAuthorized } from '@/lib/agentAuth';
import { addMail, ensureMailAgent } from '@/lib/mail';

export const dynamic = 'force-dynamic';

const Mail = z.object({
  message_id: z.string().trim().min(8).max(400),
  from_name: z.string().trim().max(200).nullish(),
  from_email: z.string().trim().max(320).nullish(),
  subject: z.string().trim().max(500).nullish(),
  received_at: z.string().trim().max(40).refine((v) => !Number.isNaN(Date.parse(v)), 'received_at must be a date'),
  web_link: z
    .string()
    .trim()
    .max(2000)
    .refine((v) => /^https:\/\/outlook\.(office365|office|live)\.com\//.test(v), 'web_link must be an Outlook link')
    .nullish(),
  label: z.enum(['client', 'meeting', 'newsletter', 'notification', 'other']).nullish(),
});

/**
 * The Mail Watcher posts new outside mail here (sender, subject, time, Outlook link; never the body):
 *   POST /api/mail  {"mails": [{"message_id": "...", "from_name": "...", "from_email": "...", "subject": "...",
 *                              "received_at": "2026-10-28T10:47:39Z", "web_link": "https://outlook.office365.com/...", "label": "client"}]}
 */
export async function POST(req: Request) {
  if (!agentAuthorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Body must be JSON.' }, { status: 400 });
  }
  const parsed = z.object({ mails: z.array(Mail).max(50) }).safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload', issues: parsed.error.issues.slice(0, 5) }, { status: 400 });
  await ensureMailAgent();
  const added = await addMail(parsed.data.mails);
  return NextResponse.json({ ok: true, added });
}
