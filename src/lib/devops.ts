import 'server-only';
import { getSetting, q } from './db';
import { addLiveEvents } from './live';

/**
 * The DevOps Watch agent (Aditya): checks the websites listed in Settings and the latest Vercel deployments a few
 * times a day and posts what it found here. It only reads; fixing is for the team.
 */
export const DEVOPS_AGENT = 'devops-watch';

export const DEFAULT_SITES = ['https://brainbric-pulse.vercel.app'];

export type SiteCheck = {
  id: number;
  kind: 'site' | 'deploy';
  target: string;
  ok: boolean;
  status_code: number | null;
  ms: number | null;
  note: string | null;
  link: string | null;
  checked_at: string;
};

export type CheckIn = Omit<SiteCheck, 'id' | 'checked_at'>;

/** The websites to watch, one per line in Settings. */
export async function watchedSites(): Promise<string[]> {
  const raw = await getSetting('devops_sites');
  const list = (raw ?? '')
    .split(/\s+/)
    .map((s) => s.trim())
    .filter((s) => /^https?:\/\/[^\s/]+/.test(s));
  return raw == null ? DEFAULT_SITES : list;
}

export async function addChecks(items: CheckIn[], summary: string | null): Promise<number> {
  for (const c of items.slice(0, 60)) {
    await q('INSERT INTO site_checks (kind, target, ok, status_code, ms, note, link) VALUES ($1, $2, $3, $4, $5, $6, $7)', [
      c.kind,
      c.target.slice(0, 300),
      c.ok,
      c.status_code ?? null,
      c.ms ?? null,
      c.note?.slice(0, 500) || null,
      c.link || null,
    ]);
  }
  const down = items.filter((c) => !c.ok);
  await q('INSERT INTO agent_runs (agent, status, summary, stats) VALUES ($1, $2, $3, $4::text::jsonb)', [
    DEVOPS_AGENT,
    down.length ? 'warning' : 'ok',
    summary?.slice(0, 500) || (down.length ? `${down.length} ${down.length === 1 ? 'problem' : 'problems'} found` : 'All sites and deployments OK'),
    JSON.stringify({ checks: items.length, problems: down.length }),
  ]);
  await addLiveEvents(
    DEVOPS_AGENT,
    down.length
      ? [{ step: 'note', text: `Problem: ${down[0].target}${down[0].note ? ` (${down[0].note})` : ''}` }, { step: 'finished', text: `${down.length} to fix` }]
      : [{ step: 'finished', text: 'All systems OK' }],
  );
  // Keep a month of checks.
  if (Math.random() < 0.1) await q("DELETE FROM site_checks WHERE checked_at < now() - interval '30 days'");
  return items.length;
}

/** The newest check of every site and project. */
export async function latestChecks(): Promise<SiteCheck[]> {
  return q<SiteCheck>(
    `SELECT DISTINCT ON (kind, target) * FROM site_checks
      WHERE checked_at > now() - interval '7 days'
      ORDER BY kind, target, checked_at DESC`,
  );
}

/** Problems in the last few days, newest first. */
export async function recentProblems(limit = 20): Promise<SiteCheck[]> {
  return q<SiteCheck>("SELECT * FROM site_checks WHERE NOT ok AND checked_at > now() - interval '7 days' ORDER BY checked_at DESC LIMIT $1", [limit]);
}

export async function devopsSummary(): Promise<{ total: number; down: number; lastAt: string | null }> {
  const latest = await latestChecks();
  const lastAt = latest.reduce<string | null>((m, c) => (!m || c.checked_at > m ? c.checked_at : m), null);
  return { total: latest.length, down: latest.filter((c) => !c.ok).length, lastAt };
}
