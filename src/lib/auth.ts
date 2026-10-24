import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import bcrypt from 'bcryptjs';
import { one, q } from './db';
import { SESSION_COOKIE, SESSION_DAYS, signSession, verifySession } from './session';

export type User = {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'member';
  active: boolean;
  created_at: string;
  last_login: string | null;
};

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
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password || password.length < 8) return;
  await q(
    `INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, 'admin') ON CONFLICT (email) DO NOTHING`,
    [process.env.ADMIN_NAME?.trim() || 'Admin', email, await hashPassword(password)],
  );
}

export async function startSession(user: Pick<User, 'id' | 'role' | 'name' | 'email'>): Promise<void> {
  const token = await signSession({ uid: user.id, role: user.role, name: user.name, email: user.email });
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
  const user = await one<User>(
    'SELECT id, name, email, role, active, created_at, last_login FROM users WHERE id = $1',
    [claims.uid],
  );
  if (!user || !user.active) return null;
  return user;
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
