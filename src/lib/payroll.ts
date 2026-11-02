import 'server-only';
import { getSetting, one, q, setSetting } from './db';
import { postNews, PORTAL_URL } from './news';

/**
 * Payroll: what each AI agent costs, like salaries for a team. The portal clocks every agent call into shifts and
 * estimates the tokens each shift used from its length; the agents cannot see their own token counts. The estimate
 * is for comparing agents and setting budgets, not an invoice: cloud agents run on the Claude plan's fixed price.
 */
export const MODELS = ['haiku', 'sonnet', 'opus'] as const;
export type Model = (typeof MODELS)[number];
export const MODEL_LABEL: Record<Model, string> = { haiku: 'Haiku 5.5', sonnet: 'Sonnet 5.5', opus: 'Opus 5.5' };

/** Claude API list prices, US$ per million tokens (October 2026). */
const PRICE: Record<Model, { input: number; output: number; cacheRead: number; cacheWrite: number }> = {
  haiku: { input: 0.1, output: 0.5, cacheRead: 0.01, cacheWrite: 0.125 },
  sonnet: { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 },
  opus: { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 },
};

/** A typical agent turn: the conversation so far read from cache, the new part written to it, and the reply. */
const TURN = { cached: 30_000, fresh: 3_000, output: 600 };
/** Turns per shift: reading the brief and the key, then a few turns around each call to the portal. */
const TURNS_BASE = 4;
const TURNS_PER_CALL = 3;
/** A new shift starts when an agent calls after this long a gap. */
const SHIFT_GAP_MIN = 20;

export const TOKENS_PER_TURN = TURN.cached + TURN.fresh + TURN.output;
const usdPerTurn = (m: Model) => (TURN.cached * PRICE[m].cacheRead + TURN.fresh * PRICE[m].cacheWrite + TURN.output * PRICE[m].output) / 1e6;

/** Agents on the cheaper model; everyone else (and every new hire) is on Sonnet unless set on the Payroll page. */
const DEFAULT_MODELS: Record<string, Model> = { 'teams-desk': 'haiku', 'devops-watch': 'haiku', 'mail-watcher': 'haiku' };

export type PayrollConfig = { usd_inr: number; models: Record<string, Model>; budgets: Record<string, number> };

export async function payrollConfig(): Promise<PayrollConfig> {
  let saved: Partial<PayrollConfig> = {};
  try {
    saved = JSON.parse((await getSetting('payroll')) ?? '{}');
  } catch {}
  return { usd_inr: saved.usd_inr && saved.usd_inr > 0 ? saved.usd_inr : 88, models: saved.models ?? {}, budgets: saved.budgets ?? {} };
}

export const savePayrollConfig = (c: PayrollConfig) => setSetting('payroll', JSON.stringify(c));

export const modelOf = (c: PayrollConfig, slug: string): Model => c.models[slug] ?? DEFAULT_MODELS[slug] ?? 'sonnet';

/** Every authorised agent call clocks in: it extends the agent's current shift or starts a new one. Never throws. */
export async function clockIn(agent: string): Promise<void> {
  try {
    const open = await one<{ id: number }>(
      `UPDATE agent_shifts SET last_seen = now(), calls = calls + 1
        WHERE id = (SELECT id FROM agent_shifts WHERE agent = $1 AND last_seen > now() - interval '${SHIFT_GAP_MIN} minutes' ORDER BY id DESC LIMIT 1)
        RETURNING id`,
      [agent],
    );
    if (open) return;
    const cfg = await payrollConfig();
    await q('INSERT INTO agent_shifts (agent, model) VALUES ($1, $2)', [agent, modelOf(cfg, agent)]);
    await checkBudget(agent, cfg);
  } catch (e) {
    console.error('payroll clock-in failed', e);
  }
}

const monthStart = (month?: string) => (month && /^\d{4}-\d{2}$/.test(month) ? `${month}-01` : new Date().toISOString().slice(0, 7) + '-01');

export type Payslip = {
  agent: string;
  name: string;
  role: string;
  model: Model;
  paused: boolean;
  shifts: number;
  calls: number;
  hours: number;
  tokens: number;
  usd: number;
  inr: number;
  share: number;
  budget: number | null;
  work: number;
  workLabel: string;
  last: string | null;
};

/** What each agent did that counts as output this month, for cost per piece of work. */
const WORK: Record<string, { label: string; sql: string }> = {
  'support-desk': { label: 'tickets', sql: 'SELECT COUNT(*)::int n FROM tickets WHERE created_at >= $1 AND created_at < $2' },
  'devops-watch': { label: 'site checks', sql: 'SELECT COUNT(*)::int n FROM site_checks WHERE checked_at >= $1 AND checked_at < $2' },
  'business-analyst': { label: 'documents', sql: 'SELECT COUNT(*)::int n FROM project_docs WHERE created_at >= $1 AND created_at < $2' },
  'hr-recruiter': { label: 'hire proposals', sql: 'SELECT COUNT(*)::int n FROM hires WHERE created_at >= $1 AND created_at < $2' },
  'teams-desk': { label: 'messages handled', sql: 'SELECT COUNT(*)::int n FROM chat_inbox WHERE created_at >= $1 AND created_at < $2' },
  'team-lead': { label: 'requests handled', sql: 'SELECT COUNT(DISTINCT request_id)::int n FROM lead_log WHERE who = \'Arvind\' AND created_at >= $1 AND created_at < $2' },
};

const LEAD_AGENTS = ['lead-hunter', 'college-outreach', 'requirement-hunter'];

/** The month's payslips, most expensive first. */
export async function payroll(month?: string): Promise<{ month: string; slips: Payslip[]; totalInr: number; totalUsd: number; totalTokens: number }> {
  const from = monthStart(month);
  const to = new Date(new Date(from + 'T00:00:00Z').setUTCMonth(new Date(from + 'T00:00:00Z').getUTCMonth() + 1)).toISOString().slice(0, 10);
  const cfg = await payrollConfig();
  const [agents, shifts, leads, tasks, builders, runs] = await Promise.all([
    q<{ slug: string; name: string; nickname: string | null; paused: boolean }>('SELECT slug, name, nickname, paused FROM agents WHERE enabled ORDER BY sort, slug'),
    q<{ agent: string; model: Model; shifts: number; calls: number; secs: number; last: string }>(
      `SELECT agent, model, COUNT(*)::int shifts, SUM(calls)::int calls, SUM(EXTRACT(EPOCH FROM last_seen - started_at))::float secs, MAX(last_seen) last
         FROM agent_shifts WHERE started_at >= $1 AND started_at < $2 GROUP BY agent, model`,
      [from, to],
    ),
    q<{ agent: string; n: number }>('SELECT agent, COUNT(*)::int n FROM leads WHERE created_at >= $1 AND created_at < $2 GROUP BY agent', [from, to]),
    q<{ role: string; n: number }>("SELECT role, COUNT(*)::int n FROM dev_tasks WHERE status IN ('passed', 'done') AND updated_at >= $1 AND updated_at < $2 GROUP BY role", [from, to]),
    // Builders: the developer and every specialist HR hired.
    q<{ slug: string }>("SELECT 'developer' AS slug UNION SELECT slug FROM hires WHERE status IN ('approved', 'active')"),
    q<{ agent: string; n: number }>('SELECT agent, COUNT(*)::int n FROM agent_runs WHERE created_at >= $1 AND created_at < $2 GROUP BY agent', [from, to]),
  ]);
  const workOf = async (slug: string): Promise<[number, string]> => {
    if (WORK[slug]) return [(await one<{ n: number }>(WORK[slug].sql, [from, to]))?.n ?? 0, WORK[slug].label];
    if (slug === 'qa-tester') return [tasks.reduce((s, t) => s + t.n, 0), 'tasks passed'];
    if (builders.some((b) => b.slug === slug)) return [tasks.find((x) => x.role === slug)?.n ?? 0, 'tasks done'];
    if (LEAD_AGENTS.includes(slug)) return [leads.find((l) => l.agent === slug)?.n ?? 0, 'leads'];
    return [runs.find((r) => r.agent === slug)?.n ?? 0, 'reports'];
  };

  const slips: Payslip[] = [];
  for (const a of agents) {
    const mine = shifts.filter((s) => s.agent === a.slug);
    let usd = 0;
    let turns = 0;
    for (const s of mine) {
      const t = s.shifts * TURNS_BASE + s.calls * TURNS_PER_CALL;
      turns += t;
      usd += t * usdPerTurn(s.model);
    }
    const [work, workLabel] = await workOf(a.slug);
    slips.push({
      agent: a.slug,
      name: a.nickname ?? a.name,
      role: a.name,
      model: modelOf(cfg, a.slug),
      paused: a.paused,
      shifts: mine.reduce((n, s) => n + s.shifts, 0),
      calls: mine.reduce((n, s) => n + s.calls, 0),
      hours: mine.reduce((n, s) => n + s.secs + s.shifts * 60, 0) / 3600,
      tokens: turns * TOKENS_PER_TURN,
      usd,
      inr: usd * cfg.usd_inr,
      share: 0,
      budget: cfg.budgets[a.slug] ?? null,
      work,
      workLabel,
      last: mine.map((s) => s.last).sort().pop() ?? null,
    });
  }
  const totalInr = slips.reduce((n, s) => n + s.inr, 0);
  for (const s of slips) s.share = totalInr ? s.inr / totalInr : 0;
  slips.sort((x, y) => y.inr - x.inr || x.name.localeCompare(y.name));
  return {
    month: from.slice(0, 7),
    slips,
    totalInr,
    totalUsd: slips.reduce((n, s) => n + s.usd, 0),
    totalTokens: slips.reduce((n, s) => n + s.tokens, 0),
  };
}

/** Estimated team cost per day of the month (India time), for the trend chart. */
export async function dailyCost(month?: string): Promise<{ day: string; inr: number }[]> {
  const from = monthStart(month);
  const cfg = await payrollConfig();
  const rows = await q<{ day: string; model: Model; shifts: number; calls: number }>(
    `SELECT to_char(started_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD') AS day, model, COUNT(*)::int shifts, SUM(calls)::int calls
       FROM agent_shifts WHERE started_at >= $1::date AND started_at < ($1::date + interval '1 month') GROUP BY 1, 2`,
    [from],
  );
  const days = new Map<string, number>();
  for (const r of rows) days.set(r.day, (days.get(r.day) ?? 0) + (r.shifts * TURNS_BASE + r.calls * TURNS_PER_CALL) * usdPerTurn(r.model) * cfg.usd_inr);
  const out: { day: string; inr: number }[] = [];
  const d = new Date(from + 'T00:00:00Z');
  for (const m = d.getUTCMonth(); d.getUTCMonth() === m; d.setUTCDate(d.getUTCDate() + 1)) {
    const k = d.toISOString().slice(0, 10);
    out.push({ day: k, inr: days.get(k) ?? 0 });
  }
  return out;
}

export const inr = (n: number) => `₹${n < 100 ? n.toFixed(2) : Math.round(n).toLocaleString('en-IN')}`;
/** Claude usage credits are counted in US dollars: 1 credit = US$1 of usage at list prices. */
export const credits = (usd: number) => `${usd < 10 ? usd.toFixed(2) : Math.round(usd).toLocaleString('en-IN')} credits`;
export const perRun = (n: number, runs: number) => (runs ? n / runs : 0);
export const tokensText = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}K` : String(n));

/** At a new shift: warn in Teams at 80% of the monthly budget, and pause the agent at 100%. */
async function checkBudget(agent: string, cfg: PayrollConfig): Promise<void> {
  const budget = cfg.budgets[agent];
  if (!budget) return;
  const { month, slips } = await payroll();
  const slip = slips.find((s) => s.agent === agent);
  if (!slip) return;
  let warned: Record<string, string> = {};
  try {
    warned = JSON.parse((await getSetting('payroll_warned')) ?? '{}');
  } catch {}
  const key = `${month}:${agent}`;
  if (slip.inr >= budget && warned[key] !== 'stop') {
    await q("UPDATE agents SET paused = TRUE, paused_at = now(), paused_by = 'Payroll (budget reached)' WHERE slug = $1", [agent]);
    await postNews('hr-recruiter', `💰 ${slip.name} used this month's budget (${inr(slip.inr)} of ${inr(budget)}) and is paused. Raise the budget or start ${slip.name} again: ${PORTAL_URL}/payroll`);
    warned[key] = 'stop';
  } else if (slip.inr >= budget * 0.8 && !warned[key]) {
    await postNews('hr-recruiter', `💰 ${slip.name} has used ${Math.round((slip.inr / budget) * 100)}% of this month's budget (${inr(slip.inr)} of ${inr(budget)}). ${PORTAL_URL}/payroll`);
    warned[key] = 'warn';
  } else return;
  await setSetting('payroll_warned', JSON.stringify(warned));
}

/** One-message summary for Teams ("@Lakshmi payroll"). */
export async function payrollSummary(): Promise<string> {
  const p = await payroll();
  const label = new Date(p.month + '-01T00:00:00Z').toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const top = p.slips.filter((s) => s.shifts > 0).slice(0, 8);
  if (!top.length) return `No shifts recorded yet for ${label}.`;
  const lines = top.map(
    (s) =>
      `• ${s.name}: ${inr(s.inr)} · ${credits(s.usd)} · ${tokensText(s.tokens)} tokens (${s.shifts} run${s.shifts === 1 ? '' : 's'}, about ${tokensText(perRun(s.tokens, s.shifts))} tokens and ${inr(perRun(s.inr, s.shifts))} per run)${s.budget ? `, budget ${inr(s.budget)}` : ''}`,
  );
  return `Payroll for ${label} so far (estimated): ${inr(p.totalInr)} · ${credits(p.totalUsd)} · ${tokensText(p.totalTokens)} tokens.\n${lines.join('\n')}\nFull payslips: ${PORTAL_URL}/payroll`;
}
