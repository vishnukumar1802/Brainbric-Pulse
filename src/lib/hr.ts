import 'server-only';
import { one, q } from './db';
import { addLog, workerRoles } from './lead';
import { addLiveEvents } from './live';

/**
 * HR (Lakshmi): reads the Team Lead's plans, spots skills the team does not have and proposes specialist agents.
 * A person approves every hire. An approved hire joins the AI team at once; it becomes "active" when its own
 * scheduled routine checks in for the first time.
 */
export const HR_AGENT = 'hr-recruiter';

export const HIRE_STATUSES = ['proposed', 'approved', 'active', 'rejected', 'retired'] as const;
export type HireStatus = (typeof HIRE_STATUSES)[number];

export type Hire = {
  id: number;
  slug: string;
  title: string;
  name: string;
  summary: string;
  skills: string | null;
  brief: string;
  tools: string | null;
  schedule: string | null;
  est_cost: string | null;
  needs_from_owner: string | null;
  request_id: number | null;
  request_title?: string | null;
  status: HireStatus;
  decided_by: string | null;
  decided_at: string | null;
  note: string | null;
  created_at: string;
};

export type HireIn = Pick<Hire, 'slug' | 'title' | 'name' | 'summary' | 'brief'> &
  Partial<Pick<Hire, 'skills' | 'tools' | 'schedule' | 'est_cost' | 'needs_from_owner' | 'request_id'>>;

/** Agent slugs: lower-case words joined by dashes, e.g. mobile-developer. */
export const SLUG_RE = /^[a-z][a-z0-9]*(-[a-z0-9]+){0,4}$/;

export async function listHires(): Promise<Hire[]> {
  return q<Hire>(
    `SELECT h.*, r.title AS request_title FROM hires h LEFT JOIN lead_requests r ON r.id = h.request_id
      ORDER BY CASE h.status WHEN 'proposed' THEN 0 WHEN 'approved' THEN 1 WHEN 'active' THEN 2 ELSE 3 END, h.updated_at DESC LIMIT 100`,
  );
}

export async function getHire(id: number): Promise<Hire | null> {
  return one<Hire>('SELECT h.*, r.title AS request_title FROM hires h LEFT JOIN lead_requests r ON r.id = h.request_id WHERE h.id = $1', [id]);
}

export async function proposedCount(): Promise<number> {
  return (await one<{ n: number }>("SELECT COUNT(*)::int AS n FROM hires WHERE status = 'proposed'"))?.n ?? 0;
}

export async function isWorker(slug: string): Promise<boolean> {
  if (slug === 'developer') return true;
  return Boolean(await one("SELECT 1 FROM hires WHERE slug = $1 AND status IN ('approved','active')", [slug]));
}

/** A hire's routine checked in: it is working now. */
export async function markHireActive(slug: string): Promise<void> {
  await q("UPDATE hires SET status = 'active', updated_at = now() WHERE slug = $1 AND status = 'approved'", [slug]);
}

export async function proposeHires(items: HireIn[]): Promise<{ added: number; skipped: string[] }> {
  let added = 0;
  const skipped: string[] = [];
  for (const h of items.slice(0, 5)) {
    // Never reuse a slug an agent or an earlier proposal already has.
    if (await one('SELECT 1 FROM agents WHERE slug = $1', [h.slug])) {
      skipped.push(`${h.slug}: already on the team`);
      continue;
    }
    const rows = await q<{ id: number }>(
      `INSERT INTO hires (slug, title, name, summary, skills, brief, tools, schedule, est_cost, needs_from_owner, request_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) ON CONFLICT (slug) DO NOTHING RETURNING id`,
      [
        h.slug,
        h.title.slice(0, 80),
        h.name.slice(0, 40),
        h.summary.slice(0, 600),
        h.skills?.slice(0, 2000) || null,
        h.brief.slice(0, 12000),
        h.tools?.slice(0, 1000) || null,
        h.schedule?.slice(0, 120) || null,
        h.est_cost?.slice(0, 200) || null,
        h.needs_from_owner?.slice(0, 1000) || null,
        h.request_id ?? null,
      ],
    );
    if (!rows.length) {
      skipped.push(`${h.slug}: already proposed`);
      continue;
    }
    added++;
    await addLiveEvents(HR_AGENT, [{ step: 'drafted', text: `Proposed a hire: ${h.name}, ${h.title}` }]);
    if (h.request_id) await addLog(h.request_id, 'Lakshmi', `Proposed hiring ${h.name} (${h.title}) for this project. Waiting for your approval on the Hiring page.`);
  }
  return { added, skipped };
}

/** Approve, reject or retire a hire (admins). Approving adds the agent to the AI team. */
export async function decideHire(id: number, action: 'approve' | 'reject' | 'retire', by: string, note: string): Promise<string | null> {
  const h = await getHire(id);
  if (!h) return 'Hire not found.';
  if (action === 'approve') {
    if (h.status !== 'proposed') return 'This proposal is not waiting for a decision.';
    await q(`INSERT INTO agents (slug, name, nickname, description, schedule, sort) VALUES ($1, $2, $3, $4, $5, 100) ON CONFLICT (slug) DO NOTHING`, [
      h.slug,
      h.title,
      h.name,
      h.summary,
      h.schedule ?? 'Every hour, 9 AM to 7 PM',
    ]);
    await q("UPDATE hires SET status = 'approved', decided_by = $2, decided_at = now(), note = $3, updated_at = now() WHERE id = $1", [id, by, note || null]);
    if (h.request_id) await addLog(h.request_id, by, `Approved hiring ${h.name} (${h.title}).`);
    await addLiveEvents(HR_AGENT, [{ step: 'finished', text: `${h.name} hired as ${h.title}` }]);
    return null;
  }
  if (action === 'reject') {
    if (h.status !== 'proposed') return 'This proposal is not waiting for a decision.';
    await q("UPDATE hires SET status = 'rejected', decided_by = $2, decided_at = now(), note = $3, updated_at = now() WHERE id = $1", [id, by, note || null]);
    return null;
  }
  if (!['approved', 'active'].includes(h.status)) return 'Only a hired agent can be let go.';
  await q("UPDATE hires SET status = 'retired', decided_by = $2, decided_at = now(), note = $3, updated_at = now() WHERE id = $1", [id, by, note || null]);
  await q('UPDATE agents SET paused = TRUE, paused_at = now(), paused_by = $2 WHERE slug = $1', [h.slug, by]);
  return null;
}

/** Lakshmi's view: the team, every hire so far, and the open requests with their plans and tasks. */
export async function hrQueue() {
  const [team, hires, requests] = await Promise.all([
    q<{ slug: string; name: string; nickname: string | null; description: string; paused: boolean }>('SELECT slug, name, nickname, description, paused FROM agents ORDER BY sort, slug'),
    q<Pick<Hire, 'slug' | 'title' | 'name' | 'status' | 'request_id'>>('SELECT slug, title, name, status, request_id FROM hires ORDER BY id'),
    q<{ id: number; kind: string; title: string; status: string; brief: string; plan: string | null }>(
      "SELECT id, kind, title, status, brief, plan FROM lead_requests WHERE status IN ('plan_ready','approved','building') ORDER BY created_at LIMIT 10",
    ),
  ]);
  const tasks = requests.length
    ? await q<{ request_id: number; title: string; role: string; status: string }>(
        `SELECT request_id, title, role, status FROM dev_tasks WHERE request_id IN (${requests.map((r) => r.id).join(',')}) ORDER BY request_id, seq`,
      )
    : [];
  // Roles the Team Lead gave tasks to that nobody fills yet (no builder and no open proposal): what to hire for.
  const filled = new Set([...(await workerRoles()).map((w) => w.slug), 'qa-tester', ...hires.filter((h) => h.status === 'proposed').map((h) => h.slug)]);
  const unfilled = [...new Set(tasks.filter((t) => t.status !== 'done' && !filled.has(t.role)).map((t) => t.role))].map((role) => ({
    role,
    requests: [...new Set(tasks.filter((t) => t.role === role).map((t) => t.request_id))],
  }));
  return {
    team,
    hires,
    unfilled_roles: unfilled,
    requests: requests.map((r) => ({ ...r, tasks: tasks.filter((t) => t.request_id === r.id) })),
  };
}
