import 'server-only';
import { q } from './db';

/** Where links in Teams messages point. */
export const PORTAL_URL = 'https://brainbric-pulse.vercel.app';

/** Queue a message for the AI team channel on Teams; the Teams Desk posts it on its next round (within minutes). */
export async function postNews(agent: string, text: string): Promise<void> {
  await q('INSERT INTO chat_outbox (agent, text) VALUES ($1, $2)', [agent, text.slice(0, 3000)]);
}
