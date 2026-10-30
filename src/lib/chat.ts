import 'server-only';
import { getSetting, one, q } from './db';
import { devopsSummary } from './devops';
import { decideHire } from './hr';
import { createRequest, decide, listProjects, REQUEST_STATUS, type RequestStatus } from './lead';
import { PORTAL_URL } from './news';
import { ticketCounts } from './support';
import { docName, DOC_KINDS, queueDoc, type DocKind } from './docs';

/**
 * The AI team channel on Microsoft Teams. The Teams Desk agent reads the owner's messages there, works out who is
 * meant and what they want, and posts it here; the portal does the work and returns the reply to post. Everything
 * the agents write in the channel starts with the robot sign, so the desk never treats it as the owner's words.
 */
export const DESK_AGENT = 'teams-desk';
export const BOT_MARK = '🤖';

export const CHAT_INTENTS = ['request', 'approve_plan', 'change_plan', 'answer', 'approve_live', 'cancel', 'approve_hire', 'reject_hire', 'note', 'status', 'document', 'help'] as const;
export type ChatIntent = (typeof CHAT_INTENTS)[number];

export type ChatIn = {
  message_id: string;
  sender_id: string;
  sender_name?: string | null;
  text: string;
  agent: string;
  intent: ChatIntent;
  request_id?: number | null;
  hire_id?: number | null;
  kind?: 'change' | 'new' | null;
  project?: string | null;
  title?: string | null;
  brief?: string | null;
  note?: string | null;
  /** For "document": srs | plan | progress | test | final. */
  doc_kind?: DocKind | null;
};

type Member = { slug: string; name: string; nickname: string | null; description: string; schedule: string; paused: boolean };

export async function roster(): Promise<Member[]> {
  return q<Member>("SELECT slug, name, nickname, description, schedule, paused FROM agents WHERE slug <> $1 ORDER BY sort, slug", [DESK_AGENT]);
}

/** Teams user ids allowed to give the team work and pass checkpoints from the channel (Settings key chat_allowed_ids). */
export async function allowedSenders(): Promise<string[]> {
  return ((await getSetting('chat_allowed_ids')) ?? '')
    .split(/[\s,]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

const who = (m: Member | undefined, slug: string) => (m ? `${m.nickname ?? m.name} (${m.name})` : slug);
const sign = (m: Member | undefined, slug: string, text: string) => `${BOT_MARK} ${who(m, slug)}: ${text}`;

/** Notes the owner left for an agent in the channel; they are handed over once, at the agent's next check-in. */
export async function takeNotes(agent: string): Promise<string[]> {
  const rows = await q<{ text: string; from_name: string | null }>(
    'UPDATE agent_notes SET picked_at = now() WHERE agent = $1 AND picked_at IS NULL RETURNING text, from_name',
    [agent],
  );
  return rows.map((r) => (r.from_name ? `${r.from_name}: ${r.text}` : r.text));
}

export async function outbox(limit = 10) {
  return q<{ id: number; agent: string; text: string }>('SELECT id, agent, text FROM chat_outbox WHERE sent_at IS NULL ORDER BY id LIMIT $1', [limit]);
}

export async function markSent(ids: number[]): Promise<void> {
  if (ids.length) await q(`UPDATE chat_outbox SET sent_at = now() WHERE id = ANY($1::int[])`, [ids]);
  if (Math.random() < 0.05) await q("DELETE FROM chat_outbox WHERE sent_at < now() - interval '30 days'");
}

async function statusOf(slug: string, m: Member | undefined): Promise<string> {
  const run = await one<{ summary: string | null; created_at: string }>('SELECT summary, created_at FROM agent_runs WHERE agent = $1 ORDER BY created_at DESC LIMIT 1', [slug]);
  const last = run ? `Last run ${new Date(run.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' })}: ${run.summary ?? 'done'}.` : 'No runs yet.';
  const when = m?.schedule ? m.schedule.charAt(0).toLowerCase() + m.schedule.slice(1) : 'on schedule';
  const parts = [m?.paused ? 'I am paused.' : `I work ${when}.`, last];
  if (slug === 'team-lead') {
    const open = await q<{ id: number; title: string; status: RequestStatus }>("SELECT id, title, status FROM lead_requests WHERE status NOT IN ('live','cancelled') ORDER BY updated_at DESC LIMIT 6");
    parts.push(open.length ? `Open requests: ${open.map((r) => `#${r.id} ${r.title} (${REQUEST_STATUS[r.status].label})`).join('; ')}.` : 'No open requests.');
  } else if (slug === 'support-desk') {
    const t = await ticketCounts();
    parts.push(`Tickets: ${t.open} open (${t.urgent} urgent or high), ${t.waiting} waiting on the client.`);
  } else if (slug === 'devops-watch') {
    const d = await devopsSummary();
    parts.push(d.total ? (d.down ? `${d.down} of ${d.total} checks show a problem.` : `All ${d.total} sites and projects OK.`) : 'No checks yet.');
  } else if (slug === 'hr-recruiter') {
    const n = (await one<{ n: number }>("SELECT COUNT(*)::int AS n FROM hires WHERE status = 'proposed'"))?.n ?? 0;
    parts.push(n ? `${n} hiring ${n === 1 ? 'proposal waits' : 'proposals wait'} for you: ${PORTAL_URL}/hiring` : 'No hiring proposals waiting.');
  }
  return parts.join(' ');
}

const HELP = [
  'Mention someone and say what you need. Examples:',
  '- @Arvind add a leave balance report to the HR system  (a change request)',
  '- @Arvind new project: booking website for a beauty parlour ...',
  '- approve plan 12  /  approve live 12  /  change plan 12: use green buttons',
  '- approve hire 3  /  decline hire 3',
  '- @Kavya status   @Aditya status   @Lakshmi status',
  '- @Ananya SRS for 12  /  project plan for 12  /  progress report for 12  /  test report  /  final report',
  '- @Meena focus on engineering colleges in Coimbatore this week  (a note for her next run)',
].join('\n');

/** Handle one owner message from the channel and return the reply to post (or null when it was already handled). */
export async function handleChat(m: ChatIn): Promise<{ reply: string } | null> {
  const fresh = await q<{ id: number }>(
    'INSERT INTO chat_inbox (message_id, sender, text, agent, intent) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (message_id) DO NOTHING RETURNING id',
    [m.message_id, m.sender_name ?? m.sender_id, m.text.slice(0, 4000), m.agent, m.intent],
  );
  if (!fresh.length) return null;
  const members = await roster();
  const member = members.find((x) => x.slug === m.agent);
  const by = m.sender_name?.trim() || 'Owner';
  const reply = async (text: string) => {
    const full = sign(member, m.agent, text);
    await q('UPDATE chat_inbox SET reply = $2 WHERE id = $1', [fresh[0].id, full.slice(0, 4000)]);
    return { reply: full };
  };

  // Only people on the allowed list can give work or pass checkpoints from the channel.
  if (!(await allowedSenders()).includes(m.sender_id.toLowerCase())) {
    return reply('Sorry, only the owner can give the AI team work in this channel.');
  }
  if (!member && m.intent !== 'help') return reply(`I don't know who that is. The team: ${members.map((x) => x.nickname ?? x.name).join(', ')}.`);

  switch (m.intent) {
    case 'help':
      return reply(HELP);
    case 'status':
      return reply(await statusOf(m.agent, member));
    case 'request': {
      if (m.agent !== 'team-lead') return reply('Arvind (Team Lead) takes project work. Mention @Arvind with what you need.');
      const brief = (m.brief || m.text).trim();
      const kind = m.kind === 'new' ? 'new' : 'change';
      let projectId: number | null = null;
      if (kind === 'change' && m.project) {
        const want = m.project.toLowerCase();
        const p = (await listProjects()).find((x) => x.name.toLowerCase().includes(want) || want.includes(x.name.toLowerCase()) || x.repo?.toLowerCase().includes(want));
        projectId = p?.id ?? null;
      }
      const title = (m.title || brief.split(/[.\n]/)[0]).slice(0, 120);
      const id = await createRequest({ kind, project_id: projectId, title, brief: `${brief}\n\n(Sent from Teams by ${by})`, deadline: null, by });
      return reply(`Got it, request #${id} "${title}". I'll post the plan here for your OK within the hour. ${PORTAL_URL}/lead/${id}`);
    }
    case 'approve_plan':
    case 'change_plan':
    case 'answer':
    case 'approve_live':
    case 'cancel': {
      if (!m.request_id) return reply('Which request? For example: approve plan 12.');
      const err = await decide(m.request_id, m.intent, `${by} (Teams)`, m.note ?? '');
      if (err) return reply(`Request #${m.request_id}: ${err}`);
      const done: Record<string, string> = {
        approve_plan: 'Plan approved. The team starts on the next run.',
        change_plan: 'Noted. I will update the plan on my next check.',
        answer: 'Thanks. I will continue planning on my next check.',
        approve_live: 'Approved. I will take it live on my next check.',
        cancel: 'Request cancelled.',
      };
      return reply(`#${m.request_id}: ${done[m.intent]} ${PORTAL_URL}/lead/${m.request_id}`);
    }
    case 'approve_hire':
    case 'reject_hire': {
      if (!m.hire_id) return reply('Which hire? For example: approve hire 3.');
      const err = await decideHire(m.hire_id, m.intent === 'approve_hire' ? 'approve' : 'reject', `${by} (Teams)`, m.note ?? '');
      if (err) return reply(err);
      return reply(m.intent === 'approve_hire' ? 'Hired. Ask Claude to set up their schedule and they start working.' : 'Proposal declined.');
    }
    case 'document': {
      if (!m.request_id) return reply('Which request? For example: progress report for 12.');
      const kind = m.doc_kind && (DOC_KINDS as readonly string[]).includes(m.doc_kind) ? m.doc_kind : null;
      if (!kind) return reply('Which document? SRS, project plan, progress report, test report or final report.');
      const exists = await one('SELECT 1 FROM lead_requests WHERE id = $1', [m.request_id]);
      if (!exists) return reply(`I can't find request #${m.request_id}.`);
      const r = await queueDoc(m.request_id, kind, `${by} (Teams)`, m.note ?? null);
      const ba = members.find((x) => x.slug === 'business-analyst');
      const text = r.queued
        ? `On it: the ${docName(kind)} for #${m.request_id}. I'll post the link here when it's ready, usually within the hour.`
        : `The ${docName(kind)} for #${m.request_id} is already on my list. I'll post the link here when it's ready.`;
      const full = sign(ba, 'business-analyst', text);
      await q('UPDATE chat_inbox SET reply = $2 WHERE id = $1', [fresh[0].id, full]);
      return { reply: full };
    }
    case 'note': {
      const text = (m.note || m.text).trim();
      if (m.agent === 'developer' || m.agent === 'qa-tester') return reply('I take my work from Arvind (Team Lead). Mention @Arvind with what you need and he will plan it.');
      await q('INSERT INTO agent_notes (agent, text, from_name) VALUES ($1, $2, $3)', [m.agent, text.slice(0, 2000), by]);
      return reply(`Noted. I'll follow it from my next run (${member?.schedule ?? 'on schedule'}).`);
    }
  }
}
