import 'server-only';
import { one, q } from './db';
import { addLiveEvents, type LiveStep } from './live';
import { REQUEST_STATUS, type RequestStatus, type TaskStatus } from './lead-status';

export * from './lead-status';

/**
 * The delivery team: the Team Lead (Arvind) plans each request and runs the Developer (Nikhil) and the QA Tester
 * (Pooja). Two checkpoints belong to people only: approving the plan and approving going live. Agents can never set
 * those statuses themselves.
 */
export const LEAD_AGENT = 'team-lead';
export const DEV_AGENT = 'developer';
export const QA_AGENT = 'qa-tester';
export const TEAM_AGENTS = [LEAD_AGENT, DEV_AGENT, QA_AGENT] as const;

/** Statuses an agent may set (the checkpoints approved / going_live are set by people only). */
const AGENT_SETTABLE: Partial<Record<RequestStatus, RequestStatus[]>> = {
  new: ['planning', 'questions', 'plan_ready'],
  planning: ['questions', 'plan_ready'],
  approved: ['building'],
  building: ['ready', 'building'],
  going_live: ['live'],
};

export type Project = { id: number; name: string; repo: string | null; live_url: string | null; vercel_project: string | null; description: string | null };
export type LeadRequest = {
  id: number;
  kind: 'change' | 'new';
  project_id: number | null;
  project_name?: string | null;
  title: string;
  brief: string;
  deadline: string | null;
  status: RequestStatus;
  plan: string | null;
  questions: string | null;
  reply: string | null;
  preview_url: string | null;
  pr_url: string | null;
  live_url: string | null;
  summary: string | null;
  ticket_id: number | null;
  created_by: string | null;
  approved_by: string | null;
  live_approved_by: string | null;
  created_at: string;
  updated_at: string;
};
export type DevTask = { id: number; request_id: number; seq: number; title: string; details: string | null; role: string; status: TaskStatus; report: string | null; attempts: number; updated_at: string };
export type LogEntry = { id: number; request_id: number; who: string; text: string; created_at: string };

// ---------- Projects and requests (people) ----------

export async function listProjects(): Promise<Project[]> {
  return q<Project>('SELECT * FROM projects ORDER BY name');
}

export async function saveProject(p: { name: string; repo?: string | null; live_url?: string | null; vercel_project?: string | null; description?: string | null }): Promise<number> {
  const row = await one<{ id: number }>(
    `INSERT INTO projects (name, repo, live_url, vercel_project, description) VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (name) DO UPDATE SET repo = COALESCE(EXCLUDED.repo, projects.repo), live_url = COALESCE(EXCLUDED.live_url, projects.live_url),
       vercel_project = COALESCE(EXCLUDED.vercel_project, projects.vercel_project), description = COALESCE(EXCLUDED.description, projects.description)
     RETURNING id`,
    [p.name.trim().slice(0, 120), p.repo?.trim() || null, p.live_url?.trim() || null, p.vercel_project?.trim() || null, p.description?.trim().slice(0, 500) || null],
  );
  return row!.id;
}

export async function addLog(requestId: number, who: string, text: string): Promise<void> {
  await q('INSERT INTO lead_log (request_id, who, text) VALUES ($1, $2, $3)', [requestId, who.slice(0, 60), text.replace(/\s+/g, ' ').trim().slice(0, 600)]);
}

export async function createRequest(r: { kind: 'change' | 'new'; project_id: number | null; title: string; brief: string; deadline: string | null; by: string; ticket_id?: number | null }): Promise<number> {
  const row = await one<{ id: number }>(
    `INSERT INTO lead_requests (kind, project_id, title, brief, deadline, created_by, ticket_id) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [r.kind, r.project_id, r.title.slice(0, 160), r.brief.slice(0, 8000), r.deadline, r.by, r.ticket_id ?? null],
  );
  await addLog(row!.id, r.by, r.kind === 'new' ? 'Asked for a new project.' : 'Asked for a change.');
  await addLiveEvents(LEAD_AGENT, [{ step: 'mail', text: `New request: ${r.title}` }]);
  return row!.id;
}

const REQUEST_SELECT = `SELECT r.*, p.name AS project_name FROM lead_requests r LEFT JOIN projects p ON p.id = r.project_id`;

export async function listRequests(filter: 'open' | 'done' | 'all' = 'open'): Promise<LeadRequest[]> {
  const where = filter === 'open' ? "WHERE r.status NOT IN ('live','cancelled')" : filter === 'done' ? "WHERE r.status IN ('live','cancelled')" : '';
  return q<LeadRequest>(`${REQUEST_SELECT} ${where} ORDER BY r.updated_at DESC LIMIT 100`);
}

export async function getRequest(id: number): Promise<{ request: LeadRequest; tasks: DevTask[]; log: LogEntry[]; project: Project | null } | null> {
  const request = await one<LeadRequest>(`${REQUEST_SELECT} WHERE r.id = $1`, [id]);
  if (!request) return null;
  const [tasks, log, project] = await Promise.all([
    q<DevTask>('SELECT * FROM dev_tasks WHERE request_id = $1 ORDER BY seq, id', [id]),
    q<LogEntry>('SELECT * FROM lead_log WHERE request_id = $1 ORDER BY created_at DESC, id DESC LIMIT 80', [id]),
    request.project_id ? one<Project>('SELECT * FROM projects WHERE id = $1', [request.project_id]) : Promise.resolve(null),
  ]);
  return { request, tasks, log, project };
}

export async function requestCounts(): Promise<{ open: number; waiting: number }> {
  const r = await one<{ open: number; waiting: number }>(
    `SELECT COUNT(*) FILTER (WHERE status NOT IN ('live','cancelled'))::int AS open,
            COUNT(*) FILTER (WHERE status IN ('questions','plan_ready','ready'))::int AS waiting FROM lead_requests`,
  );
  return r ?? { open: 0, waiting: 0 };
}

/** The checkpoints and replies, by people. */
export async function decide(id: number, action: 'approve_plan' | 'change_plan' | 'answer' | 'approve_live' | 'cancel', by: string, note: string): Promise<string | null> {
  const r = await one<{ status: RequestStatus }>('SELECT status FROM lead_requests WHERE id = $1', [id]);
  if (!r) return 'Request not found.';
  const set = async (status: RequestStatus, extra = '', params: unknown[] = []) =>
    q(`UPDATE lead_requests SET status = $2, updated_at = now() ${extra} WHERE id = $1`, [id, status, ...params]);
  switch (action) {
    case 'approve_plan':
      if (r.status !== 'plan_ready') return 'There is no plan waiting for approval.';
      await set('approved', ', approved_by = $3, approved_at = now(), reply = $4', [by, note.trim().slice(0, 4000) || null]);
      await addLog(id, by, note.trim() ? `Approved the plan, with a note: ${note.trim()}` : 'Approved the plan.');
      return null;
    case 'change_plan':
    case 'answer':
      if (!['plan_ready', 'questions'].includes(r.status)) return 'Nothing is waiting for your answer.';
      if (!note.trim()) return 'Write what to change, or your answer.';
      await set('new', ', reply = $3', [note.trim().slice(0, 4000)]);
      await addLog(id, by, action === 'answer' ? `Answered: ${note}` : `Asked for plan changes: ${note}`);
      return null;
    case 'approve_live':
      if (r.status !== 'ready') return 'This request is not ready to go live yet.';
      await set('going_live', ', live_approved_by = $3, live_approved_at = now()', [by]);
      await addLog(id, by, 'Approved going live.');
      return null;
    case 'cancel':
      if (['live', 'cancelled'].includes(r.status)) return 'This request is already finished.';
      await set('cancelled');
      await q("UPDATE dev_tasks SET status = 'done', updated_at = now() WHERE request_id = $1 AND status <> 'done'", [id]);
      await addLog(id, by, `Cancelled.${note.trim() ? ` ${note.trim()}` : ''}`);
      return null;
  }
}

// ---------- Agents ----------

export async function agentPaused(slug: string): Promise<boolean> {
  return Boolean((await one<{ paused: boolean }>('SELECT paused FROM agents WHERE slug = $1', [slug]))?.paused);
}

/** The lead's work: requests to plan or replan, approved ones to set up, builds to follow, approved go-lives. */
export async function leadQueue() {
  const requests = await q<LeadRequest>(`${REQUEST_SELECT} WHERE r.status IN ('new','planning','approved','building','going_live') ORDER BY r.created_at LIMIT 10`);
  const out = [];
  for (const r of requests) {
    const full = await getRequest(r.id);
    out.push({ ...r, project: full?.project ?? null, tasks: full?.tasks ?? [], recent_log: (full?.log ?? []).slice(0, 10) });
  }
  return { requests: out, projects: await listProjects() };
}

/** The branch every task of a request is built on, and so the one pull request people review. */
export const branchFor = (requestId: number) => `ai/request-${requestId}`;

/** Developer: tasks to build (and ones QA sent back), in plan order, for requests that are building. */
export async function devQueue() {
  const tasks = await q<DevTask & { request_title: string; kind: string; project_id: number | null; pr_url: string | null; preview_url: string | null }>(
    `SELECT t.*, r.title AS request_title, r.kind, r.project_id, r.pr_url, r.preview_url FROM dev_tasks t JOIN lead_requests r ON r.id = t.request_id
      WHERE r.status = 'building' AND t.role = 'developer' AND t.status IN ('todo','changes_needed','in_progress')
      ORDER BY r.created_at, t.seq, t.id LIMIT 6`,
  );
  return withProjects(tasks);
}

/** QA: tasks waiting for a test. */
export async function qaQueue() {
  const tasks = await q<DevTask & { request_title: string; kind: string; project_id: number | null; pr_url: string | null; preview_url: string | null }>(
    `SELECT t.*, r.title AS request_title, r.kind, r.project_id, r.pr_url, r.preview_url FROM dev_tasks t JOIN lead_requests r ON r.id = t.request_id
      WHERE r.status = 'building' AND t.status = 'testing' ORDER BY r.created_at, t.seq, t.id LIMIT 8`,
  );
  return withProjects(tasks);
}

async function withProjects<T extends { project_id: number | null; request_id: number }>(tasks: T[]) {
  const projects = new Map((await listProjects()).map((p) => [p.id, p]));
  return tasks.map((t) => ({ ...t, project: t.project_id ? projects.get(t.project_id) ?? null : null, branch: branchFor(t.request_id) }));
}

const STEP: Record<string, LiveStep> = { planning: 'writing', plan_ready: 'drafted', questions: 'note', building: 'note', ready: 'finished', live: 'finished' };

export type LeadUpdate = {
  request_id: number;
  status?: RequestStatus;
  plan?: string | null;
  questions?: string | null;
  summary?: string | null;
  preview_url?: string | null;
  pr_url?: string | null;
  live_url?: string | null;
  project?: { name: string; repo?: string | null; live_url?: string | null; vercel_project?: string | null; description?: string | null } | null;
  /** The plan's tasks; replaces the planned ones (only while planning). */
  tasks?: { title: string; details?: string | null; role?: 'developer' | 'qa' | 'devops' }[];
  /** Move every planned task to "to do" (after the plan is approved). */
  start_tasks?: boolean;
  log?: string | null;
};

export async function applyLeadUpdate(u: LeadUpdate): Promise<string | null> {
  const r = await one<{ status: RequestStatus; title: string }>('SELECT status, title FROM lead_requests WHERE id = $1', [u.request_id]);
  if (!r) return `request ${u.request_id} not found`;
  if (u.status && u.status !== r.status && !(AGENT_SETTABLE[r.status] ?? []).includes(u.status)) {
    return `request ${u.request_id}: cannot go from ${r.status} to ${u.status}${u.status === 'approved' || u.status === 'going_live' ? ' (only a person can approve)' : ''}`;
  }
  if (u.tasks && !['new', 'planning'].includes(r.status)) return `request ${u.request_id}: tasks can only be replaced while planning`;
  if (u.start_tasks && r.status !== 'approved' && r.status !== 'building') return `request ${u.request_id}: tasks start only after the plan is approved`;

  let projectId: number | null = null;
  if (u.project?.name) projectId = await saveProject(u.project);
  const fields: string[] = ['updated_at = now()'];
  const params: unknown[] = [u.request_id];
  const put = (col: string, v: unknown) => {
    params.push(v);
    fields.push(`${col} = $${params.length}`);
  };
  if (u.status) put('status', u.status);
  if (u.plan !== undefined) put('plan', u.plan?.slice(0, 20000) ?? null);
  if (u.questions !== undefined) put('questions', u.questions?.slice(0, 4000) ?? null);
  if (u.summary !== undefined) put('summary', u.summary?.slice(0, 4000) ?? null);
  if (u.preview_url !== undefined) put('preview_url', u.preview_url);
  if (u.pr_url !== undefined) put('pr_url', u.pr_url);
  if (u.live_url !== undefined) put('live_url', u.live_url);
  if (projectId) put('project_id', projectId);
  if (u.status === 'plan_ready' || u.status === 'questions') put('reply', null);
  await q(`UPDATE lead_requests SET ${fields.join(', ')} WHERE id = $1`, params);

  if (u.tasks) {
    await q("DELETE FROM dev_tasks WHERE request_id = $1 AND status = 'planned'", [u.request_id]);
    let seq = 0;
    for (const t of u.tasks.slice(0, 40)) {
      await q('INSERT INTO dev_tasks (request_id, seq, title, details, role) VALUES ($1, $2, $3, $4, $5)', [u.request_id, ++seq, t.title.slice(0, 200), t.details?.slice(0, 4000) || null, t.role ?? 'developer']);
    }
  }
  if (u.start_tasks) await q("UPDATE dev_tasks SET status = 'todo', updated_at = now() WHERE request_id = $1 AND status = 'planned'", [u.request_id]);
  if (u.status === 'live') await q("UPDATE dev_tasks SET status = 'done', updated_at = now() WHERE request_id = $1", [u.request_id]);
  if (u.log) await addLog(u.request_id, 'Arvind', u.log);
  if (u.status && STEP[u.status]) await addLiveEvents(LEAD_AGENT, [{ step: STEP[u.status], text: `${REQUEST_STATUS[u.status].label}: ${r.title}` }]);
  return null;
}

export type TaskUpdate = { task_id: number; status: TaskStatus; report?: string | null; pr_url?: string | null; preview_url?: string | null; log?: string | null };

const ROLE_MOVES: Record<string, Partial<Record<TaskStatus, TaskStatus[]>>> = {
  [DEV_AGENT]: { todo: ['in_progress', 'testing'], changes_needed: ['in_progress', 'testing'], in_progress: ['testing', 'in_progress'] },
  [QA_AGENT]: { testing: ['passed', 'changes_needed'] },
};

export async function applyTaskUpdate(agent: typeof DEV_AGENT | typeof QA_AGENT, u: TaskUpdate): Promise<string | null> {
  const t = await one<{ status: TaskStatus; request_id: number; title: string; req_status: string }>(
    'SELECT t.status, t.request_id, t.title, r.status AS req_status FROM dev_tasks t JOIN lead_requests r ON r.id = t.request_id WHERE t.id = $1',
    [u.task_id],
  );
  if (!t) return `task ${u.task_id} not found`;
  if (t.req_status !== 'building') return `task ${u.task_id}: its request is not building`;
  if (!(ROLE_MOVES[agent][t.status] ?? []).includes(u.status)) return `task ${u.task_id}: ${agent} cannot go from ${t.status} to ${u.status}`;
  await q(
    `UPDATE dev_tasks SET status = $2, report = COALESCE($3, report), attempts = attempts + CASE WHEN $2 = 'testing' THEN 1 ELSE 0 END, updated_at = now() WHERE id = $1`,
    [u.task_id, u.status, u.report?.slice(0, 6000) ?? null],
  );
  if (u.pr_url || u.preview_url) {
    await q('UPDATE lead_requests SET pr_url = COALESCE($2, pr_url), preview_url = COALESCE($3, preview_url), updated_at = now() WHERE id = $1', [t.request_id, u.pr_url ?? null, u.preview_url ?? null]);
  }
  const who = agent === DEV_AGENT ? 'Nikhil' : 'Pooja';
  const what: Partial<Record<TaskStatus, string>> = {
    in_progress: `Started "${t.title}".`,
    testing: `Built "${t.title}", sent to testing.`,
    passed: `Tested "${t.title}": passed.`,
    changes_needed: `Tested "${t.title}": changes needed.`,
  };
  await addLog(t.request_id, who, u.log || what[u.status] || `${t.title}: ${u.status}`);
  const step: LiveStep = u.status === 'in_progress' ? 'writing' : u.status === 'testing' ? 'drafted' : u.status === 'passed' ? 'finished' : 'note';
  await addLiveEvents(agent, [{ step, text: what[u.status]?.replace(/\.$/, '') ?? t.title }]);
  return null;
}
