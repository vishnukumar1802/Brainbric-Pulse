import 'server-only';
import postgres from 'postgres';

export type Row = Record<string, any>;

type Driver = {
  query: (text: string, params?: unknown[]) => Promise<Row[]>;
  exec: (text: string) => Promise<void>;
};

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS agents (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  schedule TEXT NOT NULL DEFAULT '',
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  sort INT NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS leads (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL DEFAULT 'cold',
  agent TEXT,
  company TEXT,
  contact_name TEXT,
  contact_role TEXT,
  website TEXT,
  country TEXT,
  segment TEXT,
  source_platform TEXT,
  source_url TEXT,
  email TEXT,
  email_source_url TEXT,
  phone TEXT,
  whatsapp TEXT,
  linkedin_url TEXT,
  requirement TEXT,
  budget TEXT,
  pain_point TEXT,
  service_fit TEXT,
  fit_score INT,
  approach TEXT,
  email_subject TEXT,
  email_body TEXT,
  whatsapp_message TEXT,
  bid_text TEXT,
  outlook_link TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  assigned_to INT REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT,
  first_contacted DATE,
  last_touch DATE,
  followups_sent INT NOT NULL DEFAULT 0,
  extra JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS leads_status_idx ON leads(status);
CREATE INDEX IF NOT EXISTS leads_kind_idx ON leads(kind);

CREATE TABLE IF NOT EXISTS activities (
  id SERIAL PRIMARY KEY,
  lead_id TEXT REFERENCES leads(id) ON DELETE CASCADE,
  user_id INT REFERENCES users(id) ON DELETE SET NULL,
  actor TEXT,
  type TEXT NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS activities_lead_idx ON activities(lead_id);

CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  agent TEXT,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  doc_date DATE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_runs (
  id SERIAL PRIMARY KEY,
  agent TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ok',
  summary TEXT,
  stats JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS agent_runs_agent_idx ON agent_runs(agent, created_at DESC);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT INTO agents (slug, name, description, schedule, sort) VALUES
  ('lead-hunter', 'Lead Hunter', 'Finds companies with a buying signal, writes personalised cold emails and follow-ups.', 'Every hour', 10),
  ('requirement-hunter', 'Requirement Hunter', 'Finds people who posted that they need software built and writes ready-to-send bids.', 'Every 2 hours', 20),
  ('inbox-assistant', 'Inbox & Meetings', 'Sorts the inbox, drafts replies, preps meetings and writes proposals.', 'Every 2 hours', 30),
  ('daily-brief', 'Daily Brief', 'Your top actions for the day and the full pipeline report.', '9:00 AM daily', 40),
  ('social-content', 'Social Content', 'Weekly LinkedIn posts, reel scripts and carousels.', 'Monday 9:00 AM', 50),
  ('competitor-watch', 'Competitor Watch', 'Competing agencies, their pricing and where Brainbric can win.', 'Wednesday 9:00 AM', 60)
ON CONFLICT (slug) DO NOTHING;
`;

const globalForDb = globalThis as unknown as { pulseDb?: Promise<Driver> };

async function connect(): Promise<Driver> {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  let driver: Driver;
  if (url) {
    const local = /localhost|127\.0\.0\.1/.test(url);
    const sql = postgres(url, { ssl: local ? false : 'require', max: 5, prepare: false, idle_timeout: 20 });
    driver = {
      query: async (text, params = []) => (await sql.unsafe(text, params as any[])) as unknown as Row[],
      exec: async (text) => {
        await sql.unsafe(text);
      },
    };
  } else {
    // Local development without Postgres: an embedded Postgres stored in .pglite/
    const { PGlite } = await import('@electric-sql/pglite');
    const db = new PGlite(process.env.PGLITE_DIR || './.pglite');
    driver = {
      query: async (text, params = []) => (await db.query<Row>(text, params as any[])).rows,
      exec: async (text) => {
        await db.exec(text);
      },
    };
  }
  await driver.exec(SCHEMA);
  return driver;
}

function getDriver(): Promise<Driver> {
  if (!globalForDb.pulseDb) {
    globalForDb.pulseDb = connect().catch((err) => {
      globalForDb.pulseDb = undefined;
      throw err;
    });
  }
  return globalForDb.pulseDb;
}

export async function q<T = Row>(text: string, params: unknown[] = []): Promise<T[]> {
  const d = await getDriver();
  return (await d.query(text, params)) as T[];
}

export async function one<T = Row>(text: string, params: unknown[] = []): Promise<T | null> {
  const rows = await q<T>(text, params);
  return rows[0] ?? null;
}

export async function getSetting(key: string): Promise<string | null> {
  const r = await one<{ value: string }>('SELECT value FROM settings WHERE key = $1', [key]);
  return r?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await q(
    'INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value',
    [key, value],
  );
}
