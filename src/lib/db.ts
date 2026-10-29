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

-- Sign-in is by User ID. Email is optional contact info. Permissions are a comma list (see lib/permissions.ts).
ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS permissions TEXT NOT NULL DEFAULT 'leads,reports';
-- Appended to emails a team member sends from their own Outlook.
ALTER TABLE users ADD COLUMN IF NOT EXISTS signature TEXT;
ALTER TABLE users ALTER COLUMN email DROP NOT NULL;
UPDATE users SET username = 'admin'
  WHERE username IS NULL
    AND id = (SELECT MIN(id) FROM users WHERE role = 'admin')
    AND NOT EXISTS (SELECT 1 FROM users WHERE lower(username) = 'admin');
UPDATE users SET username = lower(regexp_replace(split_part(COALESCE(email, 'user'), '@', 1), '[^a-zA-Z0-9._-]', '', 'g')) || '-' || id
  WHERE username IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS users_username_idx ON users (lower(username));

CREATE TABLE IF NOT EXISTS agents (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  schedule TEXT NOT NULL DEFAULT '',
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  sort INT NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE agents ADD COLUMN IF NOT EXISTS paused BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS paused_at TIMESTAMPTZ;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS paused_by TEXT;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS nickname TEXT;

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

-- College outreach: the institution's profile, its tier and what to pitch.
ALTER TABLE leads ADD COLUMN IF NOT EXISTS institution_type TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS tier INT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS tier_reason TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS state TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS district TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS university TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS accreditation TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS department TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS student_strength INT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS program TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS domain TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS best_time TEXT;

-- The service focus a lead was found under, e.g. "App development" or "SaaS: Facility Management".
ALTER TABLE leads ADD COLUMN IF NOT EXISTS niche TEXT;
CREATE INDEX IF NOT EXISTS leads_niche_idx ON leads(niche);

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

CREATE TABLE IF NOT EXISTS proposals (
  id SERIAL PRIMARY KEY,
  lead_id TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'software',
  title TEXT NOT NULL,
  sections JSONB NOT NULL DEFAULT '[]'::jsonb,
  price_min INT,
  price_max INT,
  monthly_min INT,
  monthly_max INT,
  currency TEXT NOT NULL DEFAULT 'INR',
  status TEXT NOT NULL DEFAULT 'draft',
  source TEXT NOT NULL DEFAULT 'portal',
  prepared_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS proposals_lead_idx ON proposals(lead_id, created_at DESC);
-- A long random code makes /p/<code> a private link the client can open without signing in.
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS share_token TEXT;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS share_enabled BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS views INT NOT NULL DEFAULT 0;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS last_viewed_at TIMESTAMPTZ;
CREATE UNIQUE INDEX IF NOT EXISTS proposals_share_idx ON proposals(share_token);

-- New mail in the admin's mailbox, posted by the Mail Watcher agent. Sender, subject and link only, never the body.
CREATE TABLE IF NOT EXISTS mail_alerts (
  id SERIAL PRIMARY KEY,
  message_id TEXT NOT NULL UNIQUE,
  from_name TEXT,
  from_email TEXT,
  subject TEXT,
  received_at TIMESTAMPTZ NOT NULL,
  web_link TEXT,
  label TEXT,
  lead_id TEXT,
  seen BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mail_alerts_received_idx ON mail_alerts(received_at);

-- Live steps for the moving office (see lib/live.ts). Kept for a few days only.
CREATE TABLE IF NOT EXISTS agent_events (
  id SERIAL PRIMARY KEY,
  agent TEXT NOT NULL,
  step TEXT NOT NULL,
  text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS agent_events_created_idx ON agent_events(created_at);

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
  ('competitor-watch', 'Competitor Watch', 'Competing agencies, their pricing and where Brainbric can win.', 'Wednesday 9:00 AM', 60),
  ('college-outreach', 'College Outreach', 'Finds Tamil Nadu colleges, sorts them into tiers and drafts workshop proposals for the right department.', 'Weekdays 10:00 AM', 15)
ON CONFLICT (slug) DO NOTHING;

-- Once: give the agents the names that go with their portraits (lib/avatars.ts). Names set by the admin are kept,
-- and a name cleared later is not put back, because this runs only until the flag is written.
UPDATE agents SET nickname = v.name
  FROM (VALUES ('lead-hunter','Arjun'), ('requirement-hunter','Priya'), ('inbox-assistant','Karthik'), ('college-outreach','Meena'),
               ('daily-brief','Divya'), ('social-content','Rahul'), ('competitor-watch','Sneha'), ('mail-watcher','Vikram')) AS v(slug, name)
  WHERE agents.slug = v.slug AND agents.nickname IS NULL
    AND NOT EXISTS (SELECT 1 FROM settings WHERE key = 'agent_names_v1');
INSERT INTO settings (key, value) VALUES ('agent_names_v1', 'done') ON CONFLICT (key) DO NOTHING;

-- Support & DevOps team (step 1 of the delivery side).
INSERT INTO agents (slug, name, nickname, description, schedule, sort) VALUES
  ('support-desk', 'Support Desk', 'Kavya', 'Turns client support emails into tickets and drafts a reply in Outlook for the team to send.', 'Every hour, 9 AM to 7 PM', 70),
  ('devops-watch', 'DevOps Watch', 'Aditya', 'Checks the live websites and Vercel deployments and flags anything down or failing. Changes nothing.', '9 AM, 1 PM and 6 PM', 80)
ON CONFLICT (slug) DO NOTHING;
UPDATE agents SET schedule = 'Every hour, 9 AM to 7 PM' WHERE slug = 'support-desk' AND schedule = 'Every 30 min, 9 AM to 7 PM';

-- Client support tickets, posted by the Support Desk agent. One per email thread; a reply on the same thread reopens it.
CREATE TABLE IF NOT EXISTS tickets (
  id SERIAL PRIMARY KEY,
  thread_id TEXT NOT NULL UNIQUE,
  message_id TEXT,
  from_name TEXT,
  from_email TEXT,
  company TEXT,
  subject TEXT,
  summary TEXT,
  category TEXT NOT NULL DEFAULT 'question',
  priority TEXT NOT NULL DEFAULT 'normal',
  status TEXT NOT NULL DEFAULT 'open',
  draft TEXT,
  web_link TEXT,
  lead_id TEXT,
  messages INT NOT NULL DEFAULT 1,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  solved_at TIMESTAMPTZ,
  solved_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tickets_status_idx ON tickets(status, updated_at);

-- Website and deployment checks, posted by the DevOps Watch agent.
CREATE TABLE IF NOT EXISTS site_checks (
  id SERIAL PRIMARY KEY,
  kind TEXT NOT NULL DEFAULT 'site',
  target TEXT NOT NULL,
  ok BOOLEAN NOT NULL,
  status_code INT,
  ms INT,
  note TEXT,
  link TEXT,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS site_checks_target_idx ON site_checks(target, checked_at);

-- Delivery team (step 2): a Team Lead who plans requests and runs a Developer and a QA Tester.
INSERT INTO agents (slug, name, nickname, description, schedule, sort) VALUES
  ('team-lead', 'Team Lead', 'Arvind', 'Takes your change and new-project requests, plans them, assigns the team and reports back. Waits for your OK on the plan and before going live.', 'Every hour, 9 AM to 7 PM', 90),
  ('developer', 'Developer', 'Nikhil', 'Builds the planned tasks on a separate GitHub branch and opens a pull request. Never touches the live site.', 'Every hour, 9 AM to 7 PM', 91),
  ('qa-tester', 'QA Tester', 'Pooja', 'Tests every pull request and its preview site and reports passed or changes needed.', 'Every hour, 9 AM to 7 PM', 92)
ON CONFLICT (slug) DO NOTHING;

-- Projects the team works on: a GitHub repository and where it is hosted.
CREATE TABLE IF NOT EXISTS projects (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  repo TEXT,
  live_url TEXT,
  vercel_project TEXT,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO projects (name, repo, live_url, vercel_project, description) VALUES
  ('Brainbric Pulse', 'vishnukumar1802/Brainbric-Pulse', 'https://brainbric-pulse.vercel.app', 'brainbric-pulse', 'This portal: leads, AI team, office.'),
  ('BBI HR Management System', 'vishnukumar1802/BBI_HR_MANAGEMENT_SYSTEM', NULL, 'bbi-hr-management-system', 'HR management system.'),
  ('Insuvai Restaurant', 'vishnukumar1802/Insuvai_Restaurant', NULL, NULL, 'Restaurant ordering: customer site, admin, kitchen and server apps.')
ON CONFLICT (name) DO NOTHING;

-- Requests to the Team Lead. Status: new -> planning -> plan_ready (checkpoint 1) -> approved -> building -> ready (checkpoint 2)
-- -> going_live -> live. Also: questions (the lead asks you something), cancelled.
CREATE TABLE IF NOT EXISTS lead_requests (
  id SERIAL PRIMARY KEY,
  kind TEXT NOT NULL,
  project_id INT,
  title TEXT NOT NULL,
  brief TEXT NOT NULL,
  deadline DATE,
  status TEXT NOT NULL DEFAULT 'new',
  plan TEXT,
  questions TEXT,
  reply TEXT,
  preview_url TEXT,
  pr_url TEXT,
  live_url TEXT,
  summary TEXT,
  ticket_id INT,
  created_by TEXT,
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  live_approved_by TEXT,
  live_approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS lead_requests_status_idx ON lead_requests(status, updated_at);

-- The plan's tasks. Status: planned -> todo -> in_progress -> testing -> passed | changes_needed -> done.
CREATE TABLE IF NOT EXISTS dev_tasks (
  id SERIAL PRIMARY KEY,
  request_id INT NOT NULL,
  seq INT NOT NULL DEFAULT 0,
  title TEXT NOT NULL,
  details TEXT,
  role TEXT NOT NULL DEFAULT 'developer',
  status TEXT NOT NULL DEFAULT 'planned',
  report TEXT,
  attempts INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS dev_tasks_request_idx ON dev_tasks(request_id, seq);

-- What happened on a request, for its timeline.
CREATE TABLE IF NOT EXISTS lead_log (
  id SERIAL PRIMARY KEY,
  request_id INT NOT NULL,
  who TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS lead_log_request_idx ON lead_log(request_id, created_at);
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
