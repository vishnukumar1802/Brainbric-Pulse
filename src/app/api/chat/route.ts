import { NextResponse } from 'next/server';
import { z } from 'zod';
import { agentAuthorized } from '@/lib/agentAuth';
import { getSetting, one, setSetting } from '@/lib/db';
import { CHAT_INTENTS, DESK_AGENT, handleChat, markSent, outbox, roster } from '@/lib/chat';
import { istHour } from '@/lib/mail';

export const dynamic = 'force-dynamic';

/** Desk hours, India time. */
const HOURS = { from: 9, to: 21 };

/**
 * The Teams Desk's call every round:
 *   GET /api/chat   (Authorization: Bearer INGEST_TOKEN)
 * Replies {"run": true, "since": "<ISO>", "team": [{slug, name, nickname, role}], "outbox": [{id, agent, text}]}
 * or {"run": false, "reason": "paused" | "outside hours"}.
 */
export async function GET(req: Request) {
  if (!agentAuthorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const paused = Boolean((await one<{ paused: boolean }>('SELECT paused FROM agents WHERE slug = $1', [DESK_AGENT]))?.paused);
  const h = istHour();
  if (paused || h < HOURS.from || h >= HOURS.to) {
    return NextResponse.json({ run: false, reason: paused ? 'paused' : 'outside hours' }, { headers: { 'Cache-Control': 'no-store' } });
  }
  const [team, news, since] = await Promise.all([roster(), outbox(), getSetting('chat_cursor')]);
  return NextResponse.json(
    {
      run: true,
      since: since || new Date(Date.now() - 15 * 60_000).toISOString(),
      team: team.map((m) => ({ slug: m.slug, name: m.nickname ?? m.name, role: m.name, does: m.description, paused: m.paused })),
      outbox: news,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

const Message = z.object({
  message_id: z.string().trim().min(3).max(300),
  sender_id: z.string().trim().min(3).max(200),
  sender_name: z.string().trim().max(200).nullish(),
  text: z.string().trim().min(1).max(4000),
  agent: z.string().trim().max(60),
  intent: z.enum(CHAT_INTENTS),
  request_id: z.number().int().positive().nullish(),
  hire_id: z.number().int().positive().nullish(),
  kind: z.enum(['change', 'new']).nullish(),
  project: z.string().max(200).nullish(),
  title: z.string().max(200).nullish(),
  brief: z.string().max(6000).nullish(),
  note: z.string().max(4000).nullish(),
});

/**
 * The Teams Desk posts what it read and what it sent:
 *   POST /api/chat  {"messages": [...owner messages, each with the agent meant and the intent...],
 *                    "sent": [outbox ids it posted], "cursor": "<ISO time of the newest message it read>"}
 * Replies {"replies": [{"message_id", "reply"}]}: post each reply in that message's thread.
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
      messages: z.array(Message).max(20).default([]),
      sent: z.array(z.number().int().positive()).max(50).default([]),
      cursor: z.string().max(40).refine((v) => !Number.isNaN(Date.parse(v)), 'cursor must be a date').nullish(),
    })
    .safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload', issues: parsed.error.issues.slice(0, 5) }, { status: 400 });
  const replies: { message_id: string; reply: string }[] = [];
  for (const m of parsed.data.messages) {
    const r = await handleChat(m);
    if (r) replies.push({ message_id: m.message_id, reply: r.reply });
  }
  await markSent(parsed.data.sent);
  if (parsed.data.cursor) await setSetting('chat_cursor', new Date(parsed.data.cursor).toISOString());
  return NextResponse.json({ ok: true, replies });
}
