/** How an agent is shown: its given name with its job ("Arjun · Lead Hunter"), or just the job when it has no name yet. */
export function agentLabel(a: { name: string; nickname?: string | null }): string {
  return a.nickname ? `${a.nickname} · ${a.name}` : a.name;
}

/** Letters, spaces, dots and hyphens; up to 24 characters. */
export const NICKNAME_RE = /^[\p{L}][\p{L} .'-]{0,23}$/u;
