'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { checkPassword, endSession, ensureBootstrapAdmin, hashPassword, requireAdmin, requirePermission, requireUser, startSession } from '@/lib/auth';
import { can, homeFor, parsePermissions, PERMISSIONS, USERNAME_RE } from '@/lib/permissions';
import { NICKNAME_RE } from '@/lib/agentName';
import { one, q, setSetting } from '@/lib/db';
import { saveFocus } from '@/lib/focus';
import { getLead, logActivity } from '@/lib/leads';
import { collegeTemplate, ensureShareToken, getPriceGuide, getProposal, insertProposal, softwareTemplate } from '@/lib/proposals';
import { SERVICES } from '@/lib/services';
import { STATUSES } from '@/lib/status';
import { setTicketStatus, TICKET_STATUSES, type TicketStatus } from '@/lib/support';

export type FormState = { error?: string; ok?: string; credentials?: { username: string; password: string } } | undefined;

const USERNAME = z
  .string()
  .trim()
  .toLowerCase()
  .regex(USERNAME_RE, 'User ID: 3-32 letters, numbers, dots, dashes or underscores, starting with a letter or number.');
const OPTIONAL_EMAIL = z.union([z.literal(''), z.string().trim().toLowerCase().email('Enter a valid email address or leave it empty.')]);
const PASSWORD = z.string().min(8, 'Use at least 8 characters for the password.').max(200);

// ---------- Session ----------

export async function loginAction(_: FormState, form: FormData): Promise<FormState> {
  await ensureBootstrapAdmin();
  const login = String(form.get('username') ?? '').trim().toLowerCase();
  const password = String(form.get('password') ?? '');
  if (!login || !password) return { error: 'Enter your User ID and password.' };

  const user = await one<{
    id: number;
    name: string;
    username: string;
    role: 'admin' | 'member';
    permissions: string;
    active: boolean;
    password_hash: string;
  }>('SELECT id, name, username, role, permissions, active, password_hash FROM users WHERE lower(username) = $1 OR lower(email) = $1 LIMIT 1', [login]);
  if (!user || !(await checkPassword(password, user.password_hash))) {
    return { error: 'That User ID and password do not match.' };
  }
  if (!user.active) return { error: 'This account is turned off. Ask your admin to turn it back on.' };

  await q('UPDATE users SET last_login = now() WHERE id = $1', [user.id]);
  await startSession(user);
  const next = String(form.get('next') ?? '');
  const home = homeFor({ role: user.role, permissions: parsePermissions(user.permissions) });
  redirect(next.startsWith('/') && !next.startsWith('//') && next !== '/' ? next : home);
}

export async function logoutAction(): Promise<void> {
  endSession();
  redirect('/login');
}

// ---------- Users (admin) ----------
// Only admins create people, change User IDs and set passwords. Passwords are stored hashed and can never be read back,
// so the one an admin sets is returned once in the form state for them to copy and hand over.

function permissionsFrom(form: FormData): string {
  const keys = new Set<string>(PERMISSIONS.map((p) => p.key));
  return form
    .getAll('permissions')
    .map(String)
    .filter((k) => keys.has(k))
    .join(',');
}

export async function createUserAction(_: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = z
    .object({
      name: z.string().trim().min(1, 'Enter a name.').max(100),
      username: USERNAME,
      email: OPTIONAL_EMAIL,
      password: PASSWORD,
      role: z.enum(['admin', 'member']),
      signature: z.string().trim().max(1000),
    })
    .safeParse({
      name: form.get('name'),
      username: form.get('username'),
      email: form.get('email') ?? '',
      password: form.get('password'),
      role: form.get('role'),
      signature: form.get('signature') ?? '',
    });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  if (await one('SELECT 1 FROM users WHERE lower(username) = $1', [d.username])) return { error: `The User ID "${d.username}" is taken.` };
  if (d.email && (await one('SELECT 1 FROM users WHERE lower(email) = $1', [d.email]))) return { error: 'Someone already has that email address.' };

  await q('INSERT INTO users (name, username, email, password_hash, role, permissions, signature) VALUES ($1, $2, $3, $4, $5, $6, $7)', [
    d.name,
    d.username,
    d.email || null,
    await hashPassword(d.password),
    d.role,
    permissionsFrom(form),
    d.signature || null,
  ]);
  revalidatePath('/admin/users');
  return { ok: `Created ${d.name}. Copy the sign-in details now; the password will not be shown again.`, credentials: { username: d.username, password: d.password } };
}

/** Edit a person: name, User ID, email, role, access and on/off. Admins cannot demote or turn off themselves. */
export async function updateUserAction(_: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const id = Number(form.get('id'));
  if (!id) return { error: 'Pick a user.' };
  const parsed = z
    .object({
      name: z.string().trim().min(1, 'Enter a name.').max(100),
      username: USERNAME,
      email: OPTIONAL_EMAIL,
      role: z.enum(['admin', 'member']),
      active: z.enum(['true', 'false']),
      signature: z.string().trim().max(1000),
    })
    .safeParse({
      name: form.get('name'),
      username: form.get('username'),
      email: form.get('email') ?? '',
      role: form.get('role'),
      active: form.get('active'),
      signature: form.get('signature') ?? '',
    });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const self = id === admin.id;
  if (self && (d.role !== 'admin' || d.active !== 'true')) return { error: 'You cannot remove your own admin rights or turn off your own access.' };

  if (await one('SELECT 1 FROM users WHERE lower(username) = $1 AND id <> $2', [d.username, id])) return { error: `The User ID "${d.username}" is taken.` };
  if (d.email && (await one('SELECT 1 FROM users WHERE lower(email) = $1 AND id <> $2', [d.email, id]))) {
    return { error: 'Someone else already has that email address.' };
  }

  await q('UPDATE users SET name = $1, username = $2, email = $3, role = $4, active = $5, permissions = $6, signature = $7 WHERE id = $8', [
    d.name,
    d.username,
    d.email || null,
    d.role,
    d.active === 'true',
    permissionsFrom(form),
    d.signature || null,
    id,
  ]);
  revalidatePath('/admin/users');
  revalidatePath('/', 'layout');
  return { ok: 'Saved.' };
}

export async function resetPasswordAction(_: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const id = Number(form.get('id'));
  const pw = PASSWORD.safeParse(form.get('password'));
  if (!id) return { error: 'Pick a user.' };
  if (!pw.success) return { error: pw.error.issues[0].message };
  const user = await one<{ username: string }>('SELECT username FROM users WHERE id = $1', [id]);
  if (!user) return { error: 'That user no longer exists.' };
  await q('UPDATE users SET password_hash = $1 WHERE id = $2', [await hashPassword(pw.data), id]);
  return { ok: 'Password set. Copy it now; it will not be shown again.', credentials: { username: user.username, password: pw.data } };
}

/** Admins only: team members' passwords are managed by an admin. */
export async function changeOwnPasswordAction(_: FormState, form: FormData): Promise<FormState> {
  const me = await requireAdmin();
  const current = String(form.get('current') ?? '');
  const next = PASSWORD.safeParse(form.get('next'));
  if (!next.success) return { error: next.error.issues[0].message };
  const row = await one<{ password_hash: string }>('SELECT password_hash FROM users WHERE id = $1', [me.id]);
  if (!row || !(await checkPassword(current, row.password_hash))) return { error: 'Your current password is not right.' };
  await q('UPDATE users SET password_hash = $1 WHERE id = $2', [await hashPassword(next.data), me.id]);
  return { ok: 'Your password is changed.' };
}

// ---------- Settings (admin) ----------

export async function saveSettingsAction(_: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const whatsapp = String(form.get('my_whatsapp') ?? '').trim();
  if (whatsapp && !/^\+?[\d\s-]{8,20}$/.test(whatsapp)) return { error: 'Enter the WhatsApp number with country code, like +91 98765 43210.' };
  const bcc = String(form.get('team_bcc') ?? '').trim().toLowerCase();
  if (bcc && !z.string().email().safeParse(bcc).success) return { error: 'Enter a valid email for the team copy, or leave it empty.' };
  await setSetting('my_whatsapp', whatsapp);
  await setSetting('team_bcc', bcc);
  revalidatePath('/', 'layout');
  return { ok: 'Settings saved.' };
}

// ---------- Agents (admin) ----------

/** Pause or start one agent, or every agent when slug is "*". Agents check this before each run. */
export async function setAgentPausedAction(form: FormData): Promise<void> {
  const admin = await requirePermission('agents');
  const slug = String(form.get('slug') ?? '');
  const paused = form.get('paused') === 'true';
  if (slug !== '*' && !/^[a-z0-9][a-z0-9-]{1,48}$/.test(slug)) return;
  const set = paused
    ? 'paused = TRUE, paused_at = now(), paused_by = $1'
    : 'paused = FALSE, paused_at = NULL, paused_by = NULL';
  if (slug === '*') {
    await q(`UPDATE agents SET ${set} WHERE enabled`, paused ? [admin.name] : []);
  } else {
    await q(`UPDATE agents SET ${set} WHERE slug = $${paused ? 2 : 1}`, paused ? [admin.name, slug] : [slug]);
  }
  revalidatePath('/', 'layout');
}

/** Give an agent a name (admin only). An empty name removes it. */
export async function renameAgentAction(_prev: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const slug = String(form.get('slug') ?? '');
  const nickname = String(form.get('nickname') ?? '').trim().replace(/\s+/g, ' ');
  if (!/^[a-z0-9][a-z0-9-]{1,48}$/.test(slug)) return { error: 'Unknown agent.' };
  if (nickname && !NICKNAME_RE.test(nickname)) return { error: 'Use letters only, up to 24 characters.' };
  if (nickname) {
    const taken = await one<{ slug: string }>('SELECT slug FROM agents WHERE lower(nickname) = lower($1) AND slug <> $2', [nickname, slug]);
    if (taken) return { error: `Another agent is already called ${nickname}.` };
  }
  await q('UPDATE agents SET nickname = $1 WHERE slug = $2', [nickname || null, slug]);
  revalidatePath('/', 'layout');
  return { ok: nickname ? `Saved. This agent is now ${nickname}.` : 'Name removed.' };
}

// ---------- Leads ----------

const VALID_STATUS = new Set<string>(STATUSES.map((s) => s.value));

export async function updateLeadAction(form: FormData): Promise<void> {
  const me = await requireUser();
  const id = String(form.get('id') ?? '');
  if (!id) return;
  const lead = await one<{ status: string; assigned_to: number | null }>('SELECT status, assigned_to FROM leads WHERE id = $1', [id]);
  if (!lead) return;

  const status = form.get('status');
  if (typeof status === 'string' && VALID_STATUS.has(status) && status !== lead.status) {
    const touched = ['sent', 'followup1', 'followup2', 'replied', 'interested', 'call_booked', 'proposal', 'won'].includes(status);
    await q(
      `UPDATE leads SET status = $1, updated_at = now(),
         last_touch = CASE WHEN $3 THEN CURRENT_DATE ELSE last_touch END,
         first_contacted = CASE WHEN $3 AND first_contacted IS NULL THEN CURRENT_DATE ELSE first_contacted END
       WHERE id = $2`,
      [status, id, touched],
    );
    await logActivity(id, me, 'status', `Status changed to ${STATUSES.find((s) => s.value === status)?.label ?? status}`);
  }

  const assignee = form.get('assigned_to');
  if (typeof assignee === 'string') {
    const uid = assignee ? Number(assignee) : null;
    if (uid !== lead.assigned_to) {
      await q('UPDATE leads SET assigned_to = $1, updated_at = now() WHERE id = $2', [uid, id]);
      const who = uid ? await one<{ name: string }>('SELECT name FROM users WHERE id = $1', [uid]) : null;
      await logActivity(id, me, 'assign', who ? `Assigned to ${who.name}` : 'Unassigned');
    }
  }
  revalidatePath(`/leads/${encodeURIComponent(id)}`);
  revalidatePath('/leads');
  revalidatePath('/');
}

export async function addNoteAction(_: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser();
  const id = String(form.get('id') ?? '');
  const note = String(form.get('note') ?? '').trim();
  if (!id || !note) return { error: 'Write a note first.' };
  await logActivity(id, me, 'note', note.slice(0, 4000));
  revalidatePath(`/leads/${encodeURIComponent(id)}`);
  return { ok: 'Note added.' };
}

/** Records a click on Outlook, WhatsApp, the source post or a copied bid, so the team sees who did what. */
export async function trackActionAction(id: string, type: string): Promise<void> {
  const me = await requireUser();
  const labels: Record<string, string> = {
    outlook_draft: 'Opened the drafted email in Outlook',
    outlook_compose: 'Opened a new email in Outlook',
    outlook_member: 'Opened the email in their own Outlook',
    outlook_app: 'Opened the email in the Outlook app',
    whatsapp: 'Opened WhatsApp to message the lead',
    whatsapp_self: 'Sent the WhatsApp message to own number to review',
    source: 'Opened the source post',
    copy_bid: 'Copied the bid text',
    copy_email: 'Copied the email text',
  };
  if (!labels[type]) return;
  await logActivity(id, me, type, labels[type]);
  revalidatePath(`/leads/${encodeURIComponent(id)}`);
}

// ---------- Focus ----------

const FocusIn = z.object({
  service: z.enum(SERVICES.map((x) => x.slug) as [string, ...string[]]),
  product: z.string().trim().max(120).optional(),
  product_details: z.string().trim().max(2000).optional(),
  regions: z.string().trim().max(300).optional(),
  notes: z.string().trim().max(1000).optional(),
});

export async function setFocusAction(_: FormState, form: FormData): Promise<FormState> {
  const admin = await requirePermission('focus');
  const parsed = FocusIn.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: 'Choose a service.' };
  const f = parsed.data;
  const service = SERVICES.find((x) => x.slug === f.service)!;
  if (service.needsProduct && !f.product) return { error: 'Name the SaaS product or industry, for example Facility Management.' };
  await saveFocus({
    service: f.service,
    product: service.needsProduct ? f.product ?? null : null,
    product_details: service.needsProduct ? f.product_details || null : null,
    regions: f.regions || null,
    notes: f.notes || null,
    set_by: admin.name,
    set_at: new Date().toISOString(),
  });
  revalidatePath('/', 'layout');
  return { ok: 'Focus saved. The agents use it from their next run.' };
}

// ---------- Sending (team) ----------

const NEXT_AFTER_SEND: Record<string, { status: string; label: string; followup: boolean }> = {
  new: { status: 'sent', label: 'First email sent', followup: false },
  drafted: { status: 'sent', label: 'First email sent', followup: false },
  sent: { status: 'followup1', label: 'Follow-up 1 sent', followup: true },
  followup1: { status: 'followup2', label: 'Follow-up 2 sent', followup: true },
};

/**
 * One click after a team member sends from their own mailbox: moves the lead to the next stage, stamps the dates,
 * and makes the sender its owner if it has none, so follow-ups land with them.
 */
export async function markSentAction(form: FormData): Promise<void> {
  const me = await requireUser();
  const id = String(form.get('id') ?? '');
  const lead = await one<{ status: string; kind: string }>('SELECT status, kind FROM leads WHERE id = $1', [id]);
  if (!lead) return;
  if (!can(me, lead.kind === 'college' ? 'colleges' : 'leads')) return;
  const next = NEXT_AFTER_SEND[lead.status];
  if (!next) return;
  await q(
    `UPDATE leads SET status = $2,
       first_contacted = COALESCE(first_contacted, CURRENT_DATE),
       last_touch = CURRENT_DATE,
       followups_sent = followups_sent + $3,
       assigned_to = COALESCE(assigned_to, $4),
       updated_at = now()
     WHERE id = $1`,
    [id, next.status, next.followup ? 1 : 0, me.id],
  );
  await logActivity(id, me, 'sent', `${next.label} by ${me.name}`);
  revalidatePath(`/leads/${encodeURIComponent(id)}`);
  revalidatePath('/', 'layout');
}

// ---------- Proposals ----------

async function leadForUser(leadId: string) {
  const me = await requireUser();
  const lead = await getLead(leadId);
  if (!lead || !can(me, lead.kind === 'college' ? 'colleges' : 'leads')) return null;
  return { me, lead };
}

/** Anyone who can open the lead creates a proposal from the template, then edits it. */
export async function createProposalAction(form: FormData): Promise<void> {
  const ctx = await leadForUser(String(form.get('lead_id') ?? ''));
  if (!ctx) return;
  const { me, lead } = ctx;
  const draft = lead.kind === 'college' ? collegeTemplate(lead, me.name) : softwareTemplate(lead, await getPriceGuide(), me.name);
  const id = await insertProposal(draft);
  await logActivity(lead.id, me, 'proposal', `Proposal created by ${me.name}`);
  redirect(`/proposals/${id}`);
}

const ProposalIn = z.object({
  id: z.coerce.number().int().positive(),
  title: z.string().trim().min(1, 'Give the proposal a title.').max(200),
  currency: z.enum(['INR', 'USD']),
  price_min: z.union([z.literal(''), z.coerce.number().int().min(0)]),
  price_max: z.union([z.literal(''), z.coerce.number().int().min(0)]),
  monthly_min: z.union([z.literal(''), z.coerce.number().int().min(0)]),
  monthly_max: z.union([z.literal(''), z.coerce.number().int().min(0)]),
});

export async function saveProposalAction(_: FormState, form: FormData): Promise<FormState> {
  const parsed = ProposalIn.safeParse({
    id: form.get('id'),
    title: form.get('title'),
    currency: form.get('currency'),
    price_min: form.get('price_min') ?? '',
    price_max: form.get('price_max') ?? '',
    monthly_min: form.get('monthly_min') ?? '',
    monthly_max: form.get('monthly_max') ?? '',
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const existing = await getProposal(d.id);
  if (!existing || !(await leadForUser(existing.lead_id))) return { error: 'You cannot edit this proposal.' };
  const num = (v: number | '') => (v === '' ? null : v);
  if (num(d.price_min) != null && num(d.price_max) != null && (d.price_min as number) > (d.price_max as number)) {
    return { error: 'The lowest price is higher than the highest price.' };
  }
  const sections = existing.sections.map((s) => ({ ...s, body: String(form.get(`section_${s.key}`) ?? s.body).trim() }));
  await q(
    `UPDATE proposals SET title = $2, sections = $3::text::jsonb, currency = $4, price_min = $5, price_max = $6, monthly_min = $7, monthly_max = $8, updated_at = now()
     WHERE id = $1`,
    [d.id, d.title, JSON.stringify(sections), d.currency, num(d.price_min), num(d.price_max), num(d.monthly_min), num(d.monthly_max)],
  );
  await ensureShareToken(d.id);
  revalidatePath(`/proposals/${d.id}`);
  revalidatePath(`/leads/${encodeURIComponent(existing.lead_id)}`);
  return { ok: 'Saved. The client link in your emails now shows this version.' };
}

/** Records that the proposal went to the client and moves the lead to "Proposal sent". */
export async function markProposalSentAction(form: FormData): Promise<void> {
  const id = Number(form.get('id'));
  const p = await getProposal(id);
  if (!p) return;
  const ctx = await leadForUser(p.lead_id);
  if (!ctx) return;
  await q("UPDATE proposals SET status = 'sent', updated_at = now() WHERE id = $1", [id]);
  await q(
    `UPDATE leads SET status = CASE WHEN status IN ('won','lost','scheduled','delivered','do_not_contact') THEN status ELSE 'proposal' END,
       last_touch = CURRENT_DATE, assigned_to = COALESCE(assigned_to, $2), updated_at = now() WHERE id = $1`,
    [p.lead_id, ctx.me.id],
  );
  await logActivity(p.lead_id, ctx.me, 'proposal_sent', `Proposal sent by ${ctx.me.name}`);
  revalidatePath(`/proposals/${id}`);
  revalidatePath(`/leads/${encodeURIComponent(p.lead_id)}`);
}

/** Admins edit the price guide used by new proposals and by the agents. */
export async function savePriceGuideAction(_: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const { rows } = await getPriceGuide();
  const n = (k: string) => {
    const v = Number(String(form.get(k) ?? '').replace(/[^\d]/g, ''));
    return Number.isFinite(v) ? v : 0;
  };
  const next = rows.map((r) => {
    const out = {
      ...r,
      inr: [n(`${r.slug}.inr0`), n(`${r.slug}.inr1`)] as [number, number],
      usd: [n(`${r.slug}.usd0`), n(`${r.slug}.usd1`)] as [number, number],
      timeline: String(form.get(`${r.slug}.timeline`) ?? r.timeline).trim() || r.timeline,
    };
    if (r.monthly_inr) out.monthly_inr = [n(`${r.slug}.minr0`), n(`${r.slug}.minr1`)];
    if (r.monthly_usd) out.monthly_usd = [n(`${r.slug}.musd0`), n(`${r.slug}.musd1`)];
    return out;
  });
  const bad = next.find((r) => r.inr[0] > r.inr[1] || r.usd[0] > r.usd[1]);
  if (bad) return { error: `Check "${bad.label}": the lowest price is higher than the highest.` };
  await setSetting('price_guide', JSON.stringify(next));
  await setSetting('price_terms', String(form.get('terms') ?? '').trim());
  revalidatePath('/settings');
  return { ok: 'Price guide saved. New proposals and the agents use it from now on.' };
}

/** Switches a proposal's client link off (the link stops working) or back on. */
export async function setProposalLinkAction(form: FormData): Promise<void> {
  const id = Number(form.get('id'));
  const on = form.get('on') === 'true';
  const p = await getProposal(id);
  if (!p) return;
  const ctx = await leadForUser(p.lead_id);
  if (!ctx) return;
  await q('UPDATE proposals SET share_enabled = $2, updated_at = now() WHERE id = $1', [id, on]);
  await logActivity(p.lead_id, ctx.me, 'proposal_link', on ? `Client link turned on by ${ctx.me.name}` : `Client link turned off by ${ctx.me.name}`);
  revalidatePath(`/proposals/${id}`);
  revalidatePath(`/leads/${encodeURIComponent(p.lead_id)}`);
}

// ---------- Support & DevOps ----------

export async function setTicketStatusAction(form: FormData): Promise<void> {
  const user = await requirePermission('support');
  const id = Number(form.get('id'));
  const status = String(form.get('status') ?? '');
  if (!Number.isInteger(id) || !(TICKET_STATUSES as readonly string[]).includes(status)) return;
  await setTicketStatus(id, status as TicketStatus, user.name);
  revalidatePath('/tickets');
  revalidatePath('/', 'layout');
}

/** What counts as support mail, in the admin's words. The Support Desk reads it on every run. */
export async function saveSupportRulesAction(_: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const rules = String(form.get('rules') ?? '').trim();
  if (rules.length > 2000) return { error: 'Keep it under 2,000 characters.' };
  await setSetting('support_rules', rules);
  revalidatePath('/tickets');
  return { ok: rules ? 'Saved. The Support Desk follows this from its next run.' : 'Cleared. The Support Desk uses the default rule.' };
}

/** The websites the DevOps Watch checks, one per line. */
export async function saveDevopsSitesAction(_: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const lines = String(form.get('sites') ?? '')
    .split(/\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const bad = lines.find((s) => !/^https?:\/\/[^\s/]+\.[^\s/]+/.test(s));
  if (bad) return { error: `"${bad}" is not a web address. Start each one with https://` };
  if (lines.length > 30) return { error: 'Up to 30 sites.' };
  await setSetting('devops_sites', [...new Set(lines)].join('\n'));
  revalidatePath('/devops');
  return { ok: `Saved ${lines.length} ${lines.length === 1 ? 'site' : 'sites'}. Checked from the next run.` };
}
