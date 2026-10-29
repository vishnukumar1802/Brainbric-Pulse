import 'server-only';
import type { User } from './auth';
import { q } from './db';
import { can, parsePermissions } from './permissions';

/** Everything the 3D office on the Overview draws. Plain data, so it can go to the client component. */
export type FloorKey = 'g' | 'f';

export type OfficePerson = {
  id: string;
  name: string;
  role: string;
  kind: 'agent' | 'member' | 'admin';
  floor: FloorKey;
  /** working: at the desk; walking: carrying new drafts to the mail room; paused: in the pantry; away: not in today. */
  state: 'working' | 'walking' | 'paused' | 'failed' | 'away';
  bubble: string | null;
  detail: string;
  href: string | null;
  isYou: boolean;
  /** Agents only: used by the Pause and Start buttons. */
  slug: string | null;
  paused: boolean;
};

export type OfficeFloor = {
  key: FloorKey;
  name: string;
  ready: number;
  readyHref: string;
  talks: number;
  talksHref: string;
};

export type OfficeData = {
  floors: OfficeFloor[];
  people: OfficePerson[];
  xp: { total: number; level: number; inLevel: number; perLevel: number };
  goal: { done: number; target: number };
  streak: number;
  scores: { id: number; name: string; xp: number; isYou: boolean }[];
  /** Whether this person may pause and start agents. */
  canControl: boolean;
  /** May open Tickets and DevOps. */
  canSupport: boolean;
};

/** Agents that work on the college programs floor. Everything else sits on the ground floor. */
const COLLEGE_AGENTS = new Set(['college-outreach']);
const PER_LEVEL = 1000;
export const DAILY_GOAL = 10;

const TODAY = `(date_trunc('day', now() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata')`;
const TALKS = `('replied','interested','call_booked','proposal','scheduled')`;

// Points: +10 an email, +20 a follow-up, +30 a proposal sent, +50 a client opening a proposal, +200 a win.
const XP_SQL = `CASE
  WHEN a.type = 'sent' AND a.note ILIKE 'Follow-up%' THEN 20
  WHEN a.type = 'sent' THEN 10
  WHEN a.type = 'proposal_sent' THEN 30
  WHEN a.type = 'proposal_viewed' THEN 50
  WHEN a.type = 'status' AND a.note = 'Status changed to Won' THEN 200
  ELSE 0 END`;

function shortSummary(s: string | null): string | null {
  if (!s) return null;
  const first = s.replace(/\s+/g, ' ').split(/(?<=[.!?])\s/)[0].replace(/[.!?]$/, '');
  return first.length > 34 ? `${first.slice(0, 32).trimEnd()}…` : first;
}

export async function getOffice(me: User): Promise<OfficeData> {
  const [agents, users, counts, xpRows, days] = await Promise.all([
    q<{
      slug: string;
      name: string;
      nickname: string | null;
      paused: boolean;
      schedule: string;
      last_status: string | null;
      last_summary: string | null;
      last_run_at: string | null;
      found_today: number;
      fresh_drafts: number;
    }>(
      `SELECT a.slug, a.name, a.nickname, a.paused, a.schedule, r.status AS last_status, r.summary AS last_summary, r.created_at AS last_run_at,
         (SELECT COUNT(*)::int FROM leads l WHERE l.agent = a.slug AND l.created_at >= ${TODAY}) AS found_today,
         (SELECT COUNT(*)::int FROM leads l WHERE l.agent = a.slug AND l.status = 'drafted' AND l.created_at > now() - interval '3 hours') AS fresh_drafts
       FROM agents a
       LEFT JOIN LATERAL (SELECT status, summary, created_at FROM agent_runs WHERE agent = a.slug ORDER BY created_at DESC LIMIT 1) r ON TRUE
       WHERE a.enabled ORDER BY a.sort, a.name`,
    ),
    q<{ id: number; name: string; role: string; permissions: string; here: boolean; sent_today: number }>(
      `SELECT u.id, u.name, u.role, u.permissions,
         (u.last_login > now() - interval '12 hours' OR EXISTS (SELECT 1 FROM activities a WHERE a.user_id = u.id AND a.created_at >= ${TODAY})) AS here,
         (SELECT COUNT(*)::int FROM activities a WHERE a.user_id = u.id AND a.type = 'sent' AND a.created_at >= ${TODAY}) AS sent_today
       FROM users u WHERE u.active ORDER BY u.role DESC, u.id`,
    ),
    q<{ ready_g: number; ready_f: number; talks_g: number; talks_f: number; sent_today: number }>(
      `SELECT COUNT(*) FILTER (WHERE status = 'drafted' AND kind <> 'college')::int AS ready_g,
              COUNT(*) FILTER (WHERE status = 'drafted' AND kind = 'college')::int AS ready_f,
              COUNT(*) FILTER (WHERE status IN ${TALKS} AND kind <> 'college')::int AS talks_g,
              COUNT(*) FILTER (WHERE status IN ${TALKS} AND kind = 'college')::int AS talks_f,
              (SELECT COUNT(*)::int FROM activities WHERE type = 'sent' AND created_at >= ${TODAY}) AS sent_today
       FROM leads`,
    ),
    q<{ user_id: number | null; total: number; week: number }>(
      `SELECT a.user_id, SUM(${XP_SQL})::int AS total, SUM(CASE WHEN a.created_at > now() - interval '7 days' THEN ${XP_SQL} ELSE 0 END)::int AS week
       FROM activities a GROUP BY a.user_id`,
    ),
    q<{ day: string }>(
      `SELECT DISTINCT to_char(created_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD') AS day FROM activities
       WHERE type = 'sent' AND created_at > now() - interval '120 days' ORDER BY day DESC`,
    ),
  ]);
  const c = counts[0] ?? { ready_g: 0, ready_f: 0, talks_g: 0, talks_f: 0, sent_today: 0 };

  const floors: OfficeFloor[] = [
    { key: 'g', name: 'Software services', ready: c.ready_g, readyHref: '/leads?status=drafted', talks: c.talks_g, talksHref: '/leads?status=hot' },
  ];
  if (can(me, 'colleges')) {
    floors.push({ key: 'f', name: 'College programs', ready: c.ready_f, readyHref: '/colleges?status=drafted', talks: c.talks_f, talksHref: '/colleges' });
  }

  const recent = (iso: string | null, minutes: number) => Boolean(iso && Date.now() - new Date(iso).getTime() < minutes * 60_000);
  const people: OfficePerson[] = agents.map((a) => {
    const floor: FloorKey = COLLEGE_AGENTS.has(a.slug) ? 'f' : 'g';
    const base = { id: `agent:${a.slug}`, name: a.nickname ?? a.name, role: a.name, kind: 'agent' as const, floor, href: `/agents/${a.slug}`, isYou: false, slug: a.slug, paused: a.paused };
    if (a.paused) return { ...base, state: 'paused', bubble: 'Paused', detail: 'Paused, in the pantry' };
    if (a.last_status === 'error') return { ...base, state: 'failed', bubble: 'Last run failed', detail: 'Last run failed' };
    const found = a.found_today ? `${a.found_today} found today` : a.schedule || 'On demand';
    if (a.fresh_drafts && recent(a.last_run_at, 90)) {
      return { ...base, state: 'walking', bubble: `+${a.fresh_drafts} ${a.fresh_drafts === 1 ? 'draft' : 'drafts'} ready`, detail: `Delivering ${a.fresh_drafts} drafts` };
    }
    return { ...base, state: 'working', bubble: shortSummary(a.last_summary) ?? 'Waiting for the next run', detail: found };
  });

  for (const u of users) {
    const perms = parsePermissions(u.permissions);
    const floor: FloorKey | null = u.role === 'admin' || perms.includes('leads') ? 'g' : perms.includes('colleges') ? 'f' : null;
    if (!floor || (floor === 'f' && !can(me, 'colleges'))) continue;
    const isYou = u.id === me.id;
    people.push({
      id: `user:${u.id}`,
      name: isYou ? 'You' : u.name.split(' ')[0],
      role: u.role === 'admin' ? 'Admin' : 'Team member',
      kind: u.role === 'admin' ? 'admin' : 'member',
      floor,
      state: u.here || isYou ? 'working' : 'away',
      bubble: u.sent_today ? `Sent ${u.sent_today} today` : null,
      detail: u.here || isYou ? (u.sent_today ? `${u.sent_today} sent today` : 'In today') : 'Away',
      href: u.role === 'admin' ? null : `/leads?assigned=${u.id}`,
      isYou,
      slug: null,
      paused: false,
    });
  }

  const total = xpRows.reduce((s, r) => s + (r.total ?? 0), 0);
  const weekByUser = new Map(xpRows.filter((r) => r.user_id != null).map((r) => [r.user_id as number, r.week ?? 0]));
  const scores = users
    .filter((u) => u.role === 'admin' || parsePermissions(u.permissions).some((p) => p === 'leads' || p === 'colleges'))
    .map((u) => ({ id: u.id, name: u.id === me.id ? 'You' : u.name, xp: weekByUser.get(u.id) ?? 0, isYou: u.id === me.id }))
    .sort((a, b) => b.xp - a.xp);

  // Streak: days in a row (IST) with at least one email sent, counting back from today, or from yesterday if today has none yet.
  const set = new Set(days.map((d) => d.day));
  const ist = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d);
  let streak = 0;
  const cursor = new Date();
  if (!set.has(ist(cursor))) cursor.setUTCDate(cursor.getUTCDate() - 1);
  while (set.has(ist(cursor))) {
    streak++;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  return {
    floors,
    people,
    xp: { total, level: Math.floor(total / PER_LEVEL) + 1, inLevel: total % PER_LEVEL, perLevel: PER_LEVEL },
    goal: { done: c.sent_today, target: DAILY_GOAL },
    streak,
    scores,
    canControl: can(me, 'agents'),
    canSupport: can(me, 'support'),
  };
}
