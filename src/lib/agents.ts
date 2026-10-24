import 'server-only';
import { one, q } from './db';

export type Agent = {
  slug: string;
  name: string;
  description: string;
  schedule: string;
  enabled: boolean;
  sort: number;
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
  return q<AgentRun>('SELECT * FROM agent_runs WHERE agent = $1 ORDER BY created_at DESC LIMIT $2', [slug, limit]);
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
