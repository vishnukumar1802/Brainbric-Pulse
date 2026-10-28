import 'server-only';
import { q } from './db';

/**
 * Live steps from the agents, for the moving office. Some come from the agents themselves (POST /api/agent-event),
 * the rest the portal records on its own: "started" when an agent checks in, and "found", "drafted", "finished"
 * when it sends its results.
 */
export const LIVE_STEPS = ['started', 'searching', 'found', 'writing', 'drafted', 'finished', 'failed', 'note'] as const;
export type LiveStep = (typeof LIVE_STEPS)[number];

export type LiveEvent = { id: number; agent: string; step: LiveStep; text: string | null; created_at: string };

export async function addLiveEvents(agent: string, events: { step: LiveStep; text?: string | null }[]): Promise<void> {
  for (const e of events.slice(0, 20)) {
    await q('INSERT INTO agent_events (agent, step, text) VALUES ($1, $2, $3)', [agent, e.step, e.text?.replace(/\s+/g, ' ').trim().slice(0, 120) || null]);
  }
  // Keep the table small: the office only needs the last few days.
  if (Math.random() < 0.05) await q("DELETE FROM agent_events WHERE created_at < now() - interval '3 days'");
}

/** Events after `sinceId`; with no id, the last 15 minutes (so a fresh page knows who is mid-run). */
export async function liveEventsSince(sinceId: number | null): Promise<LiveEvent[]> {
  return sinceId
    ? q<LiveEvent>('SELECT id, agent, step, text, created_at FROM agent_events WHERE id > $1 ORDER BY id LIMIT 200', [sinceId])
    : q<LiveEvent>("SELECT id, agent, step, text, created_at FROM agent_events WHERE created_at > now() - interval '15 minutes' ORDER BY id LIMIT 200");
}
