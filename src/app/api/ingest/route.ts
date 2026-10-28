import { createHash } from 'crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { agentAuthorized } from '@/lib/agentAuth';
import { one, q } from '@/lib/db';
import { newShareToken } from '@/lib/proposals';

export const dynamic = 'force-dynamic';

const str = z.string().trim().max(20000).nullish();

const LeadIn = z.object({
  id: z.string().trim().max(200).optional(),
  kind: z.enum(['cold', 'requirement', 'inbound', 'college']).default('cold'),
  company: str,
  contact_name: str,
  contact_role: str,
  website: str,
  country: str,
  segment: str,
  source_platform: str,
  source_url: str,
  email: str,
  email_source_url: str,
  phone: str,
  whatsapp: str,
  linkedin_url: str,
  requirement: str,
  budget: str,
  pain_point: str,
  service_fit: str,
  fit_score: z.coerce.number().int().min(0).max(5).nullish(),
  approach: str,
  email_subject: str,
  email_body: str,
  whatsapp_message: str,
  bid_text: str,
  outlook_link: str,
  status: z.string().trim().max(40).nullish(),
  notes: str,
  first_contacted: z.string().trim().max(40).nullish(),
  last_touch: z.string().trim().max(40).nullish(),
  followups_sent: z.coerce.number().int().min(0).max(20).nullish(),
  institution_type: z.enum(['engineering', 'polytechnic', 'arts_science', 'other']).nullish(),
  tier: z.coerce.number().int().min(1).max(3).nullish(),
  tier_reason: str,
  state: str,
  district: str,
  university: str,
  accreditation: str,
  department: str,
  student_strength: z.coerce.number().int().min(0).max(100000).nullish(),
  program: str,
  domain: str,
  best_time: str,
  niche: z.string().trim().max(120).nullish(),
});

const DocIn = z.object({
  id: z.string().trim().max(200).optional(),
  kind: z.string().trim().min(1).max(40),
  title: z.string().trim().min(1).max(300),
  date: z.string().trim().max(40).nullish(),
  body: z.string().max(400000),
});

const ProposalIn = z.object({
  /** The lead it belongs to: its id, or its source_url / email when the agent does not know the id. */
  lead_id: z.string().trim().max(200).optional(),
  source_url: z.string().trim().max(2000).optional(),
  email: z.string().trim().max(320).optional(),
  title: z.string().trim().min(1).max(200),
  sections: z
    .array(z.object({ heading: z.string().trim().min(1).max(120), body: z.string().max(8000) }))
    .min(1)
    .max(12),
  currency: z.enum(['INR', 'USD']).default('INR'),
  price_min: z.coerce.number().int().min(0).nullish(),
  price_max: z.coerce.number().int().min(0).nullish(),
  monthly_min: z.coerce.number().int().min(0).nullish(),
  monthly_max: z.coerce.number().int().min(0).nullish(),
});

const Payload = z.object({
  agent: z.string().trim().regex(/^[a-z0-9][a-z0-9-]{1,48}$/, 'agent must be a lowercase slug like lead-hunter'),
  agent_name: z.string().trim().max(80).optional(),
  agent_description: z.string().trim().max(400).optional(),
  agent_schedule: z.string().trim().max(80).optional(),
  run: z
    .object({
      status: z.enum(['ok', 'warning', 'error']).default('ok'),
      summary: z.string().max(8000).optional(),
      stats: z.record(z.unknown()).optional(),
    })
    .optional(),
  leads: z.array(LeadIn).max(200).default([]),
  documents: z.array(DocIn).max(50).default([]),
  proposals: z.array(ProposalIn).max(20).default([]),
  // Only change leads that already exist (matched by id, email or source_url): status, plus a note added on top.
  update_only: z.boolean().default(false),
});

const LEAD_COLUMNS = [
  'kind', 'company', 'contact_name', 'contact_role', 'website', 'country', 'segment', 'source_platform', 'source_url',
  'email', 'email_source_url', 'phone', 'whatsapp', 'linkedin_url', 'requirement', 'budget', 'pain_point', 'service_fit',
  'fit_score', 'approach', 'email_subject', 'email_body', 'whatsapp_message', 'bid_text', 'outlook_link', 'status', 'notes',
  'first_contacted', 'last_touch', 'followups_sent',
  'institution_type', 'tier', 'tier_reason', 'state', 'district', 'university', 'accreditation', 'department',
  'student_strength', 'program', 'domain', 'best_time', 'niche',
] as const;

const DATE_COLUMNS = new Set(['first_contacted', 'last_touch']);
const STICKY = `('won','lost','call_booked','proposal','interested','scheduled','delivered')`;

function leadId(l: z.infer<typeof LeadIn>): string {
  if (l.id) return l.id.toLowerCase().replace(/[^a-z0-9.:_-]/g, '-').slice(0, 120);
  const key = (l.source_url || l.email || l.website || l.company || JSON.stringify(l)).trim().toLowerCase();
  return `${l.kind}-${createHash('sha1').update(key).digest('hex').slice(0, 12)}`;
}

function toDateOrNull(v: string | null | undefined): string | null {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

export async function POST(req: Request) {
  if (!agentAuthorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Body must be JSON.' }, { status: 400 });
  }
  const parsed = Payload.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload', issues: parsed.error.issues.slice(0, 10) }, { status: 400 });
  }
  const p = parsed.data;

  // A new agent slug becomes a new module in the portal automatically.
  await q(
    `INSERT INTO agents (slug, name, description, schedule) VALUES ($1, $2, $3, $4)
     ON CONFLICT (slug) DO UPDATE SET
       name = CASE WHEN $5 THEN EXCLUDED.name ELSE agents.name END,
       description = CASE WHEN $6 THEN EXCLUDED.description ELSE agents.description END,
       schedule = CASE WHEN $7 THEN EXCLUDED.schedule ELSE agents.schedule END`,
    [
      p.agent,
      p.agent_name || p.agent.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      p.agent_description || '',
      p.agent_schedule || '',
      Boolean(p.agent_name),
      Boolean(p.agent_description),
      Boolean(p.agent_schedule),
    ],
  );

  let created = 0;
  let updated = 0;
  const notFound: string[] = [];
  for (const lead of p.leads) {
    const id = leadId(lead);
    if (p.update_only) {
      const rows = await q<{ id: string }>(
        `UPDATE leads SET
           status = COALESCE($2::text, status),
           notes = CASE WHEN $3::text IS NULL THEN notes ELSE concat_ws(E'\\n', $3::text, notes) END,
           updated_at = now()
         WHERE id = $1
            OR ($4::text IS NOT NULL AND lower(email) = lower($4::text))
            OR ($5::text IS NOT NULL AND source_url = $5::text)
         RETURNING id`,
        [id, lead.status || null, lead.notes || null, lead.email || null, lead.source_url || null],
      );
      if (!rows.length) notFound.push(lead.company || lead.email || lead.source_url || id);
      for (const r of rows) {
        updated++;
        await q('INSERT INTO activities (lead_id, actor, type, note) VALUES ($1, $2, $3, $4)', [
          r.id,
          p.agent_name || p.agent,
          'agent_update',
          lead.notes || (lead.status ? `Status set to ${lead.status}` : 'Updated'),
        ]);
      }
      continue;
    }
    const cols: string[] = [];
    const vals: unknown[] = [id, p.agent];
    for (const c of LEAD_COLUMNS) {
      const v = (lead as Record<string, unknown>)[c];
      if (v === undefined || v === null || v === '') continue;
      cols.push(c);
      vals.push(DATE_COLUMNS.has(c) ? toDateOrNull(v as string) : v);
    }
    const placeholders = cols.map((_, i) => `$${i + 3}`);
    const updates = cols.map((c) =>
      c === 'status'
        ? `status = CASE WHEN leads.status IN ${STICKY} AND EXCLUDED.status <> 'do_not_contact' THEN leads.status
                         WHEN leads.status IN ('sent','followup1','followup2') AND EXCLUDED.status IN ('new','drafted') THEN leads.status
                         ELSE EXCLUDED.status END`
        : `${c} = EXCLUDED.${c}`,
    );
    const rows = await q<{ inserted: boolean }>(
      `INSERT INTO leads (id, agent${cols.length ? ', ' + cols.join(', ') : ''})
       VALUES ($1, $2${placeholders.length ? ', ' + placeholders.join(', ') : ''})
       ON CONFLICT (id) DO UPDATE SET ${[...updates, 'updated_at = now()'].join(', ')}
       RETURNING (xmax = 0) AS inserted`,
      vals,
    );
    const isNew = Boolean(rows[0]?.inserted);
    if (isNew) created++;
    else updated++;
    await q('INSERT INTO activities (lead_id, actor, type, note) VALUES ($1, $2, $3, $4)', [
      id,
      p.agent_name || p.agent,
      isNew ? 'found' : 'agent_update',
      isNew
        ? `Found via ${lead.source_platform || 'web research'}`
        : lead.status
          ? `Agent set status to ${lead.status}`
          : 'Agent updated details',
    ]);
  }

  for (const d of p.documents) {
    const date = toDateOrNull(d.date) ?? new Date().toISOString().slice(0, 10);
    const id = (d.id || `${p.agent}-${d.kind}-${date}`).toLowerCase().replace(/[^a-z0-9:_-]/g, '-').slice(0, 160);
    await q(
      `INSERT INTO documents (id, agent, kind, title, doc_date, body) VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, body = EXCLUDED.body, doc_date = EXCLUDED.doc_date, kind = EXCLUDED.kind, updated_at = now()`,
      [id, p.agent, d.kind, d.title, date, d.body],
    );
  }

  // Proposals the agent wrote for leads (usually when a lead turns interested). Each is a new version on that lead.
  let proposals = 0;
  const proposalsNotFound: string[] = [];
  for (const pr of p.proposals) {
    const lead = await one<{ id: string; kind: string }>(
      `SELECT id, kind FROM leads
       WHERE ($1::text IS NOT NULL AND id = $1) OR ($2::text IS NOT NULL AND source_url = $2) OR ($3::text IS NOT NULL AND lower(email) = lower($3))
       LIMIT 1`,
      [pr.lead_id || null, pr.source_url || null, pr.email || null],
    );
    if (!lead) {
      proposalsNotFound.push(pr.lead_id || pr.source_url || pr.email || pr.title);
      continue;
    }
    const sections = pr.sections.map((s, i) => ({
      key: s.heading.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `section-${i + 1}`,
      heading: s.heading,
      body: s.body,
    }));
    await q(
      `INSERT INTO proposals (lead_id, kind, title, sections, price_min, price_max, monthly_min, monthly_max, currency, source, prepared_by, share_token)
       VALUES ($1, $2, $3, $4::text::jsonb, $5, $6, $7, $8, $9, 'agent', $10, $11)`,
      [
        lead.id,
        lead.kind === 'college' ? 'college' : 'software',
        pr.title,
        JSON.stringify(sections),
        pr.price_min ?? null,
        pr.price_max ?? null,
        pr.monthly_min ?? null,
        pr.monthly_max ?? null,
        pr.currency,
        p.agent_name || p.agent,
        newShareToken(),
      ],
    );
    await q('INSERT INTO activities (lead_id, actor, type, note) VALUES ($1, $2, $3, $4)', [lead.id, p.agent_name || p.agent, 'proposal', 'Proposal drafted by the agent']);
    proposals++;
  }

  if (p.run) {
    await q('INSERT INTO agent_runs (agent, status, summary, stats) VALUES ($1, $2, $3, $4::text::jsonb)', [
      p.agent,
      p.run.status,
      p.run.summary ?? null,
      JSON.stringify({ ...(p.run.stats ?? {}), leads_created: created, leads_updated: updated, documents: p.documents.length, proposals }),
    ]);
  }

  return NextResponse.json({
    ok: true,
    leads_created: created,
    leads_updated: updated,
    documents: p.documents.length,
    proposals,
    ...(proposalsNotFound.length ? { proposals_not_found: proposalsNotFound } : {}),
    ...(p.update_only ? { not_found: notFound } : {}),
  });
}
