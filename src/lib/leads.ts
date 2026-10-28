import 'server-only';
import { one, q } from './db';
import { HOT_STATUSES } from './status';

export type Lead = {
  id: string;
  kind: string;
  agent: string | null;
  company: string | null;
  contact_name: string | null;
  contact_role: string | null;
  website: string | null;
  country: string | null;
  segment: string | null;
  source_platform: string | null;
  source_url: string | null;
  email: string | null;
  email_source_url: string | null;
  phone: string | null;
  whatsapp: string | null;
  linkedin_url: string | null;
  requirement: string | null;
  budget: string | null;
  pain_point: string | null;
  service_fit: string | null;
  fit_score: number | null;
  approach: string | null;
  email_subject: string | null;
  email_body: string | null;
  whatsapp_message: string | null;
  bid_text: string | null;
  outlook_link: string | null;
  status: string;
  assigned_to: number | null;
  assignee_name?: string | null;
  notes: string | null;
  first_contacted: string | null;
  last_touch: string | null;
  followups_sent: number;
  institution_type: string | null;
  tier: number | null;
  tier_reason: string | null;
  state: string | null;
  district: string | null;
  university: string | null;
  accreditation: string | null;
  department: string | null;
  student_strength: number | null;
  program: string | null;
  domain: string | null;
  best_time: string | null;
  niche: string | null;
  created_at: string;
  updated_at: string;
};

export type LeadFilters = {
  kind?: string;
  status?: string;
  source?: string;
  agent?: string;
  q?: string;
  mine?: number;
  tier?: number;
  district?: string;
  institutionType?: string;
  niche?: string;
};

export async function listLeads(f: LeadFilters = {}, limit = 500): Promise<Lead[]> {
  const where: string[] = [];
  const params: unknown[] = [];
  const add = (sql: string, v: unknown) => {
    params.push(v);
    where.push(sql.replace('?', `$${params.length}`));
  };
  // Colleges are a separate service with their own page; software views never include them.
  if (f.kind) add('l.kind = ?', f.kind);
  else where.push("l.kind <> 'college'");
  if (f.niche) add('l.niche = ?', f.niche);
  if (f.status === 'hot') where.push(`l.status IN (${HOT_STATUSES.map((s) => `'${s}'`).join(',')})`);
  else if (f.status) add('l.status = ?', f.status);
  if (f.source) add('l.source_platform = ?', f.source);
  if (f.agent) add('l.agent = ?', f.agent);
  if (f.mine) add('l.assigned_to = ?', f.mine);
  if (f.tier) add('l.tier = ?', f.tier);
  if (f.district) add('l.district = ?', f.district);
  if (f.institutionType) add('l.institution_type = ?', f.institutionType);
  if (f.q) {
    params.push(`%${f.q.toLowerCase()}%`);
    const p = `$${params.length}`;
    where.push(
      `(LOWER(COALESCE(l.company,'')) LIKE ${p} OR LOWER(COALESCE(l.requirement,'')) LIKE ${p} OR LOWER(COALESCE(l.email,'')) LIKE ${p} OR LOWER(COALESCE(l.country,'')) LIKE ${p} OR LOWER(COALESCE(l.contact_name,'')) LIKE ${p} OR LOWER(COALESCE(l.pain_point,'')) LIKE ${p} OR LOWER(COALESCE(l.district,'')) LIKE ${p} OR LOWER(COALESCE(l.department,'')) LIKE ${p})`,
    );
  }
  params.push(limit);
  return q<Lead>(
    `SELECT l.*, u.name AS assignee_name FROM leads l LEFT JOIN users u ON u.id = l.assigned_to
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY CASE WHEN l.status = 'drafted' THEN 0 WHEN l.status IN ('replied','interested','call_booked','proposal') THEN 1 ELSE 2 END,
              l.updated_at DESC
     LIMIT $${params.length}`,
    params,
  );
}

export async function getLead(id: string): Promise<Lead | null> {
  return one<Lead>(
    'SELECT l.*, u.name AS assignee_name FROM leads l LEFT JOIN users u ON u.id = l.assigned_to WHERE l.id = $1',
    [id],
  );
}

export type Activity = {
  id: number;
  lead_id: string;
  actor: string | null;
  type: string;
  note: string | null;
  created_at: string;
};

export async function leadActivities(id: string): Promise<Activity[]> {
  return q<Activity>('SELECT * FROM activities WHERE lead_id = $1 ORDER BY created_at DESC LIMIT 100', [id]);
}

export async function logActivity(leadId: string | null, actor: { id?: number | null; name: string }, type: string, note?: string) {
  await q('INSERT INTO activities (lead_id, user_id, actor, type, note) VALUES ($1, $2, $3, $4, $5)', [
    leadId,
    actor.id ?? null,
    actor.name,
    type,
    note ?? null,
  ]);
}

export async function sourcesList(): Promise<string[]> {
  const rows = await q<{ s: string }>(
    `SELECT DISTINCT source_platform AS s FROM leads WHERE kind <> 'college' AND source_platform IS NOT NULL AND source_platform <> '' ORDER BY 1`,
  );
  return rows.map((r) => r.s);
}

export async function pipelineStats() {
  const [totals, byStatus, bySource, recent] = await Promise.all([
    one<{ total: number; cold: number; requirement: number; drafted: number; hot: number; contacted: number; won: number; week: number }>(
      `SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE kind = 'cold')::int AS cold,
              COUNT(*) FILTER (WHERE kind = 'requirement')::int AS requirement,
              COUNT(*) FILTER (WHERE status = 'drafted')::int AS drafted,
              COUNT(*) FILTER (WHERE status IN ('replied','interested','call_booked','proposal'))::int AS hot,
              COUNT(*) FILTER (WHERE status IN ('sent','followup1','followup2','replied','interested','call_booked','proposal','scheduled','delivered','won','no_response'))::int AS contacted,
              COUNT(*) FILTER (WHERE status IN ('scheduled','delivered','won'))::int AS won,
              COUNT(*) FILTER (WHERE created_at > now() - interval '7 days')::int AS week
       FROM leads WHERE kind <> 'college'`,
    ),
    q<{ status: string; n: number }>("SELECT status, COUNT(*)::int AS n FROM leads WHERE kind <> 'college' GROUP BY status"),
    q<{ source: string; n: number }>(
      `SELECT COALESCE(NULLIF(source_platform, ''), 'Other') AS source, COUNT(*)::int AS n FROM leads WHERE kind <> 'college' GROUP BY 1 ORDER BY n DESC LIMIT 8`,
    ),
    q<{ day: string; n: number }>(
      `SELECT to_char(created_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD') AS day, COUNT(*)::int AS n
       FROM leads WHERE kind <> 'college' AND created_at > now() - interval '14 days' GROUP BY 1 ORDER BY 1`,
    ),
  ]);
  return { totals, byStatus, bySource, recent };
}

export type FeedItem = Activity & { company: string | null; kind: string | null; requirement: string | null };

/** The latest things that happened across all leads, newest first. */
export async function recentActivity(limit = 8): Promise<FeedItem[]> {
  return q<FeedItem>(
    `SELECT a.*, l.company, l.kind, l.requirement FROM activities a LEFT JOIN leads l ON l.id = a.lead_id
     WHERE l.kind IS DISTINCT FROM 'college'
     ORDER BY a.created_at DESC LIMIT $1`,
    [limit],
  );
}

const CLOSED_SQL = `('lost','no_response','do_not_contact')`;

/** Open leads by country, for the India vs international split. */
export async function openByCountry(): Promise<{ country: string; n: number }[]> {
  return q<{ country: string; n: number }>(
    `SELECT COALESCE(NULLIF(TRIM(country), ''), 'Unknown') AS country, COUNT(*)::int AS n
     FROM leads WHERE kind <> 'college' AND status NOT IN ${CLOSED_SQL} GROUP BY 1 ORDER BY n DESC, 1`,
  );
}

/** The drafted lead to send first: best fit, then oldest draft. */
export async function nextUp(): Promise<Lead | null> {
  return one<Lead>(
    `SELECT l.*, u.name AS assignee_name FROM leads l LEFT JOIN users u ON u.id = l.assigned_to
     WHERE l.status = 'drafted' AND l.kind <> 'college' ORDER BY COALESCE(l.fit_score, 0) DESC, l.created_at ASC LIMIT 1`,
  );
}

/** Niches that leads have been tagged with, for the filter. */
export async function nichesList(): Promise<{ niche: string; n: number }[]> {
  return q<{ niche: string; n: number }>(
    `SELECT niche, COUNT(*)::int AS n FROM leads WHERE kind <> 'college' AND niche IS NOT NULL AND niche <> '' GROUP BY 1 ORDER BY n DESC, 1`,
  );
}
