import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import bcrypt from 'bcryptjs';
import { one, q } from './db';
import { can, homeFor, parsePermissions, type Permission } from './permissions';
import { SESSION_COOKIE, SESSION_DAYS, signSession, verifySession } from './session';

export type User = {
  id: number;
  name: string;
  username: string;
  email: string | null;
  role: 'admin' | 'member';
  permissions: Permission[];
  active: boolean;
  created_at: string;
  last_login: string | null;
};

type UserRow = Omit<User, 'permissions'> & { permissions: string };

export const USER_COLUMNS = 'id, name, username, email, role, permissions, active, created_at, last_login';

export function toUser(row: UserRow): User {
  return { ...row, permissions: parsePermissions(row.permissions) };
}

export async function hashPassword(pw: string): Promise<string> {
  return bcrypt.hash(pw, 12);
}

export async function checkPassword(pw: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pw, hash);
}

/** Creates the first admin from ADMIN_* env vars when the database has no users yet. */
export async function ensureBootstrapAdmin(): Promise<void> {
  const existing = await one<{ n: number }>('SELECT COUNT(*)::int AS n FROM users');
  if ((existing?.n ?? 0) > 0) return;
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase() || null;
  const username = process.env.ADMIN_USERNAME?.trim().toLowerCase() || 'admin';
  const password = process.env.ADMIN_PASSWORD;
  if (!password || password.length < 8) return;
  await q(
    `INSERT INTO users (name, username, email, password_hash, role) VALUES ($1, $2, $3, $4, 'admin') ON CONFLICT DO NOTHING`,
    [process.env.ADMIN_NAME?.trim() || 'Admin', username, email, await hashPassword(password)],
  );
}

export async function startSession(user: Pick<User, 'id' | 'role' | 'name' | 'username'>): Promise<void> {
  const token = await signSession({ uid: user.id, role: user.role, name: user.name, username: user.username });
  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export function endSession(): void {
  cookies().delete(SESSION_COOKIE);
}

/** The signed-in user, re-read from the database so a deactivated account loses access at once. */
export async function currentUser(): Promise<User | null> {
  const claims = await verifySession(cookies().get(SESSION_COOKIE)?.value);
  if (!claims) return null;
  const row = await one<UserRow>(`SELECT ${USER_COLUMNS} FROM users WHERE id = $1`, [claims.uid]);
  if (!row || !row.active) return null;
  return toUser(row);
}

export async function requireUser(): Promise<User> {
  const user = await currentUser();
  if (!user) redirect('/login');
  return user;
}

export async function requireAdmin(): Promise<User> {
  const user = await requireUser();
  if (user.role !== 'admin') redirect('/');
  return user;
}

/** The signed-in user, sent to their own start page when they lack this permission. */
export async function requirePermission(perm: Permission): Promise<User> {
  const user = await requireUser();
  if (!can(user, perm)) redirect(homeFor(user));
  return user;
}
