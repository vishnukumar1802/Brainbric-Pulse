# Brainbric Pulse

The command portal for **Brainbric Innovations**: every lead, requirement post, draft and report your AI agents produce, in one place, with one click to Outlook or WhatsApp. Multi-user, with admin-managed logins.

Built with Next.js 14 (App Router), TypeScript, Tailwind CSS and Postgres.

## What's in phase 1

| Area | What it does |
|---|---|
| **Overview** | What needs you today: messages ready to send, hot leads, pipeline by stage, lead sources, AI team status, today's brief |
| **Leads** | Every cold lead and requirement post, filterable by type, status, source and owner, searchable |
| **Lead page** | Who they are · why they're a lead · how to approach them · where the lead came from · messages ready to send · status, owner, notes and full history |
| **One-click actions** | *Open draft in Outlook* (the agent's draft) · *Write email in Outlook* (new email with recipient, subject and body filled in) · *Message on WhatsApp* (opens WhatsApp with the number and message typed in) · *Send to my WhatsApp to review* · *Open the source post* · *Copy bid* |
| **Reports** | Daily briefs, inbox summaries, meeting preps, proposals, social plans and competitor reports |
| **AI team** | One module per agent with run history, its leads and its reports. A new agent becomes a new module automatically the first time it reports |
| **Team & access** | Admins add people, set passwords and roles (Admin / Team member), reset passwords, turn access off |
| **Settings** | Change your password; admins set the WhatsApp number used for "send to my WhatsApp" |

Nothing is ever sent automatically. Outlook and WhatsApp open with the message ready; you read it and press Send.

## Deploy on Vercel

1. **Push this folder to GitHub** (a private repository).
2. In **Vercel → Add New → Project**, import the repository. Framework: Next.js (detected).
3. Before the first deploy, open **Storage → Create → Neon (Postgres)** and connect it to the project. This sets `DATABASE_URL` for you.
4. In **Settings → Environment Variables**, add the values from `VERCEL-SECRETS.local.txt` (created on your computer, never committed):
   - `AUTH_SECRET`: signs logins
   - `INGEST_TOKEN`: the secret your agents send
   - `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`: your first admin login
5. **Deploy.** Open the site, sign in with the admin email and password, then change the password under Settings.
6. Add your team under **Team & access**.

The database tables are created automatically on first use.

## Run locally

```bash
npm install
npm run dev
```

Without `DATABASE_URL`, a built-in database is stored in `.pglite/`. Put `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `AUTH_SECRET` and `INGEST_TOKEN` in `.env.local` (see `.env.example`).

## The agent feed

Agents send their results with one HTTPS request:

```
POST https://<your-portal>/api/ingest
Authorization: Bearer <INGEST_TOKEN>
Content-Type: application/json
```

```json
{
  "agent": "lead-hunter",
  "run": { "status": "ok", "summary": "Checked 15 companies, 3 qualified." },
  "leads": [
    {
      "id": "cold-acme.com",
      "kind": "cold",
      "company": "Acme Pvt Ltd",
      "website": "https://acme.com",
      "country": "India",
      "segment": "Indian SMBs",
      "contact_name": "", "contact_role": "",
      "source_platform": "Funding news",
      "source_url": "https://…",
      "email": "hello@acme.com",
      "email_source_url": "https://acme.com/contact",
      "whatsapp": "+91 98xxxxxxxx",
      "linkedin_url": "",
      "pain_point": "Why they are a lead: the buying signal",
      "service_fit": "Mobile app",
      "fit_score": 4,
      "approach": "Markdown: how to approach them, step by step",
      "email_subject": "…", "email_body": "…",
      "whatsapp_message": "…",
      "bid_text": "…",
      "outlook_link": "https://outlook.office365.com/owa/?ItemID=…",
      "status": "drafted"
    }
  ],
  "documents": [
    { "kind": "brief", "title": "Daily brief – 24 Oct 2026", "date": "2026-10-24", "body": "Markdown…" }
  ]
}
```

- `kind`: `cold`, `requirement` or `inbound`.
- `status`: `new`, `drafted`, `sent`, `followup1`, `followup2`, `replied`, `interested`, `call_booked`, `proposal`, `won`, `lost`, `no_response`, `do_not_contact`. A status your team set by hand (interested, call booked, proposal, won, lost) is never overwritten by an agent, except for `do_not_contact`.
- Send the same `id` again to update a lead; fields you leave out keep their values.
- Document `kind` examples: `brief`, `inbox`, `meeting`, `proposal`, `social`, `competitors`, `bids`. One document per agent, kind and date unless you pass an `id`.
- A new `agent` slug (with optional `agent_name`, `agent_description`, `agent_schedule`) creates a new module in the portal.
