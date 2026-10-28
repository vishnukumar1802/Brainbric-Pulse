'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { checkPassword, endSession, ensureBootstrapAdmin, hashPassword, requireAdmin, requirePermission, requireUser, startSession } from '@/lib/auth';
import { homeFor, parsePermissions, PERMISSIONS, USERNAME_RE } from '@/lib/permissions';
import { one, q, setSetting } from '@/lib/db';
import { saveFocus } from '@/lib/focus';
import { logActivity } from '@/lib/leads';
import { SERVICES } from '@/lib/services';
import { STATUSES } from '@/lib/status';

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
    })
    .safeParse({
      name: form.get('name'),
      username: form.get('username'),
      email: form.get('email') ?? '',
      password: form.get('password'),
      role: form.get('role'),
    });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  if (await one('SELECT 1 FROM users WHERE lower(username) = $1', [d.username])) return { error: `The User ID "${d.username}" is taken.` };
  if (d.email && (await one('SELECT 1 FROM users WHERE lower(email) = $1', [d.email]))) return { error: 'Someone already has that email address.' };

  await q('INSERT INTO users (name, username, email, password_hash, role, permissions) VALUES ($1, $2, $3, $4, $5, $6)', [
    d.name,
    d.username,
    d.email || null,
    await hashPassword(d.password),
    d.role,
    permissionsFrom(form),
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
    })
    .safeParse({
      name: form.get('name'),
      username: form.get('username'),
      email: form.get('email') ?? '',
      role: form.get('role'),
      active: form.get('active'),
    });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const self = id === admin.id;
  if (self && (d.role !== 'admin' || d.active !== 'true')) return { error: 'You cannot remove your own admin rights or turn off your own access.' };

  if (await one('SELECT 1 FROM users WHERE lower(username) = $1 AND id <> $2', [d.username, id])) return { error: `The User ID "${d.username}" is taken.` };
  if (d.email && (await one('SELECT 1 FROM users WHERE lower(email) = $1 AND id <> $2', [d.email, id]))) {
    return { error: 'Someone else already has that email address.' };
  }

  await q('UPDATE users SET name = $1, username = $2, email = $3, role = $4, active = $5, permissions = $6 WHERE id = $7', [
    d.name,
    d.username,
    d.email || null,
    d.role,
    d.active === 'true',
    permissionsFrom(form),
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
  await setSetting('my_whatsapp', whatsapp);
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
