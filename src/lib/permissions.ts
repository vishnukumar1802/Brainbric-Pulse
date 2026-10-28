// What a team member may open. Admins have everything. Plain constants so the admin forms can render them.

export const PERMISSIONS = [
  { key: 'leads', label: 'Software leads', hint: 'Overview, Ready to send, All leads and each lead page' },
  { key: 'colleges', label: 'College programs', hint: 'The Colleges page and college leads' },
  { key: 'reports', label: 'Reports', hint: 'Daily briefs and agent reports' },
  { key: 'focus', label: 'Change the focus', hint: 'Pick the service the agents hunt for' },
  { key: 'agents', label: 'AI team', hint: 'See the agents and pause or start them' },
] as const;

export type Permission = (typeof PERMISSIONS)[number]['key'];

export const DEFAULT_PERMISSIONS: Permission[] = ['leads', 'reports'];

export function parsePermissions(raw: string | null | undefined): Permission[] {
  const keys = new Set<string>(PERMISSIONS.map((p) => p.key));
  return (raw ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((s): s is Permission => keys.has(s));
}

type WithAccess = { role: 'admin' | 'member'; permissions: Permission[] };

export function can(user: WithAccess, perm: Permission): boolean {
  return user.role === 'admin' || user.permissions.includes(perm);
}

/** Where a user lands after signing in or when they open a page they may not see. */
export function homeFor(user: WithAccess): string {
  if (can(user, 'leads')) return '/';
  if (can(user, 'colleges')) return '/colleges';
  if (can(user, 'reports')) return '/reports';
  if (can(user, 'agents')) return '/agents';
  return '/settings';
}

/** User IDs: 3-32 characters, letters, numbers, dots, dashes and underscores. Stored lower-case. */
export const USERNAME_RE = /^[a-z0-9][a-z0-9._-]{2,31}$/;
