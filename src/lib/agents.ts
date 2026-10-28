import 'server-only';
import { one, q } from './db';

export type Agent = {
  slug: string;
  name: string;
  /** The name the admin gave this agent, e.g. Arjun. */
  nickname: string | null;
  description: string;
  schedule: string;
  enabled: boolean;
  sort: number;
  paused: boolean;
  paused_at: string | null;
  paused_by: string | null;
  last_run_at?: string | null;
  last_status?: string | null;
  last_summary?: string | null;
  runs_7d?: number;
};

export type AgentRun = {
  id: number;
  agent: string;
  status: string;
  summary: string | null;
  stats: Record<string, unknown>;
  created_at: string;
};

export type Doc = {
  id: string;
  agent: string | null;
  kind: string;
  title: string;
  doc_date: string | null;
  body: string;
  created_at: string;
  updated_at: string;
};

export async function listAgents(): Promise<Agent[]> {
  return q<Agent>(
    `SELECT a.*, r.created_at AS last_run_at, r.status AS last_status, r.summary AS last_summary,
            (SELECT COUNT(*)::int FROM agent_runs x WHERE x.agent = a.slug AND x.created_at > now() - interval '7 days') AS runs_7d
     FROM agents a
     LEFT JOIN LATERAL (SELECT created_at, status, summary FROM agent_runs WHERE agent = a.slug ORDER BY created_at DESC LIMIT 1) r ON TRUE
     WHERE a.enabled
     ORDER BY a.sort, a.name`,
  );
}

export async function getAgent(slug: string): Promise<Agent | null> {
  return one<Agent>('SELECT * FROM agents WHERE slug = $1', [slug]);
}

export async function agentRuns(slug: string, limit = 30): Promise<AgentRun[]> {
  const rows = await q<AgentRun>('SELECT * FROM agent_runs WHERE agent = $1 ORDER BY created_at DESC LIMIT $2', [slug, limit]);
  // Older rows may hold the stats as a JSON string; parse those back into an object.
  return rows.map((r) => {
    if (typeof r.stats !== 'string') return r;
    try {
      return { ...r, stats: JSON.parse(r.stats) as Record<string, unknown> };
    } catch {
      return { ...r, stats: {} };
    }
  });
}

export async function listDocs(filter: { kind?: string; agent?: string } = {}, limit = 60): Promise<Doc[]> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filter.kind) {
    params.push(filter.kind);
    where.push(`kind = $${params.length}`);
  }
  if (filter.agent) {
    params.push(filter.agent);
    where.push(`agent = $${params.length}`);
  }
  params.push(limit);
  return q<Doc>(
    `SELECT * FROM documents ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY COALESCE(doc_date, created_at::date) DESC, updated_at DESC LIMIT $${params.length}`,
    params,
  );
}

export async function getDoc(id: string): Promise<Doc | null> {
  return one<Doc>('SELECT * FROM documents WHERE id = $1', [id]);
}

export async function docKinds(): Promise<{ kind: string; n: number }[]> {
  return q<{ kind: string; n: number }>('SELECT kind, COUNT(*)::int AS n FROM documents GROUP BY kind ORDER BY kind');
}

export const DOC_KIND_LABELS: Record<string, string> = {
  brief: 'Daily brief',
  inbox: 'Inbox summary',
  meeting: 'Meeting prep',
  proposal: 'Proposal',
  social: 'Social content',
  competitors: 'Competitor watch',
  bids: 'Bids & messages',
  drafts: 'Email drafts log',
  report: 'Report',
};

export function docKindLabel(kind: string): string {
  return DOC_KIND_LABELS[kind] ?? kind.replace(/[-_]/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}

export type RunTick = { agent: string; status: string; summary: string | null; created_at: string };

/** The last `n` runs of every agent, oldest first within each agent. */
export async function recentRunsByAgent(n = 12): Promise<Record<string, RunTick[]>> {
  const rows = await q<RunTick>(
    `SELECT agent, status, summary, created_at FROM (
       SELECT agent, status, summary, created_at, row_number() OVER (PARTITION BY agent ORDER BY created_at DESC) AS rn FROM agent_runs
     ) r WHERE rn <= $1 ORDER BY agent, created_at`,
    [n],
  );
  const out: Record<string, RunTick[]> = {};
  for (const r of rows) (out[r.agent] ??= []).push(r);
  return out;
}
