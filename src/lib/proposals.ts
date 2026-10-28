import 'server-only';
import { estValue, programInfo, TIERS } from './colleges';
import { getSetting, one, q } from './db';
import type { Lead } from './leads';
import { currencyFor, DEFAULT_PRICE_TERMS, DEFAULT_PRICES, priceRowFor, type PriceRow } from './pricing';

export type Section = { key: string; heading: string; body: string };

export type Proposal = {
  id: number;
  lead_id: string;
  kind: 'software' | 'college';
  title: string;
  sections: Section[];
  price_min: number | null;
  price_max: number | null;
  monthly_min: number | null;
  monthly_max: number | null;
  currency: 'INR' | 'USD';
  status: 'draft' | 'sent';
  source: 'portal' | 'agent';
  prepared_by: string | null;
  created_at: string;
  updated_at: string;
};

export async function getPriceGuide(): Promise<{ rows: PriceRow[]; terms: string }> {
  const [raw, terms] = await Promise.all([getSetting('price_guide'), getSetting('price_terms')]);
  let rows = DEFAULT_PRICES;
  if (raw) {
    try {
      const saved = JSON.parse(raw) as PriceRow[];
      // Keep every default row; saved values override by slug.
      rows = DEFAULT_PRICES.map((d) => ({ ...d, ...(saved.find((s) => s.slug === d.slug) ?? {}) }));
    } catch {
      /* fall back to defaults */
    }
  }
  return { rows, terms: terms ?? DEFAULT_PRICE_TERMS };
}

/** Some early rows were saved as a JSON string instead of an array; read both. */
function normalize(p: Proposal): Proposal {
  let sections: unknown = p.sections;
  for (let i = 0; i < 2 && typeof sections === 'string'; i++) {
    try {
      sections = JSON.parse(sections);
    } catch {
      sections = [];
    }
  }
  return { ...p, sections: Array.isArray(sections) ? (sections as Section[]) : [] };
}

export async function listProposals(leadId: string): Promise<Proposal[]> {
  return (await q<Proposal>('SELECT * FROM proposals WHERE lead_id = $1 ORDER BY created_at DESC', [leadId])).map(normalize);
}

export async function getProposal(id: number): Promise<Proposal | null> {
  const p = await one<Proposal>('SELECT * FROM proposals WHERE id = $1', [id]);
  return p ? normalize(p) : null;
}

export async function insertProposal(p: Omit<Proposal, 'id' | 'status' | 'created_at' | 'updated_at'>): Promise<number> {
  const row = await one<{ id: number }>(
    `INSERT INTO proposals (lead_id, kind, title, sections, price_min, price_max, monthly_min, monthly_max, currency, source, prepared_by)
     VALUES ($1, $2, $3, $4::text::jsonb, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
    [p.lead_id, p.kind, p.title, JSON.stringify(p.sections), p.price_min, p.price_max, p.monthly_min, p.monthly_max, p.currency, p.source, p.prepared_by],
  );
  return row!.id;
}

// ---------- Software template ----------

const SCOPE: Record<string, string[]> = {
  'saas-subscription': ['Account setup and configuration for your team', 'Import of your existing data (sites, staff, assets, customers)', 'Training session for admins and staff', 'Mobile and web access for your team', 'Ongoing updates and support under the subscription'],
  'saas-mvp': ['User sign-up, login and roles', 'Core workflow screens for your business process', 'Admin dashboard with reports', 'Subscription billing and payments', 'Cloud hosting, backups and security', 'Launch support and handover documentation'],
  'app-mvp': ['Android and iOS app from one codebase', 'Sign-up / login, profile and notifications', 'The core features your customers need (booking, ordering or tracking)', 'Online payments where required', 'Admin panel to manage content, users and orders', 'Play Store and App Store publishing'],
  'website-basic': ['Modern, mobile-friendly design in your brand', 'Up to 10 pages with your content', 'Enquiry form and WhatsApp click-to-chat', 'Basic SEO and Google Business link-up', 'Fast hosting set-up with SSL'],
  'website-dynamic': ['Modern, mobile-friendly design in your brand', 'Content management so your team can update pages', 'Booking, enquiry or e-commerce with online payments', 'SEO set-up and analytics', 'Hosting, SSL and backups'],
  'ai-chatbot': ['AI assistant trained on your business information', 'Website and/or WhatsApp channel', 'Lead capture and hand-over to your team', 'Admin view of conversations', 'Monthly improvement of answers'],
  'ai-automation': ['Mapping of the manual steps to automate', 'AI agents / workflows connected to your tools (email, sheets, CRM, WhatsApp)', 'Human approval steps where needed', 'Dashboard of what the automation did', 'Training and hand-over'],
  'erp-crm': ['Modules for your sales, inventory, production and billing', 'Role-based access for each team', 'Reports and dashboards', 'Data migration from spreadsheets', 'Training and go-live support'],
};

// How each kind of project reads in a sentence ("Brainbric will design and build ...").
const NOUN: Record<string, string> = {
  'saas-subscription': 'a ready-to-use software subscription',
  'saas-mvp': 'your SaaS platform',
  'saas-full': 'your SaaS platform',
  'app-mvp': 'a mobile app for Android and iOS',
  'app-advanced': 'a full-featured mobile app',
  'website-basic': 'a modern business website',
  'website-dynamic': 'a web portal with online booking, payments or e-commerce',
  'ai-chatbot': 'an AI chatbot for your website and WhatsApp',
  'ai-automation': 'AI agents that automate your manual work',
  'erp-crm': 'a custom ERP / CRM system',
  maintenance: 'ongoing support and maintenance',
};

const TECH: Record<string, string> = {
  'saas-subscription': 'Cloud-hosted SaaS, accessible on web and mobile; your data is backed up daily.',
  'saas-mvp': 'React / Next.js front end, Node.js back end, PostgreSQL database, cloud hosting (AWS / Vercel), Stripe or Razorpay for billing.',
  'app-mvp': 'Flutter or React Native for Android and iOS, Node.js API, PostgreSQL or Firebase, push notifications, Razorpay / Stripe.',
  'website-basic': 'Next.js or WordPress, depending on how you want to edit content; hosted on a fast CDN with SSL.',
  'website-dynamic': 'Next.js or WordPress / WooCommerce, headless CMS, Razorpay / Stripe, fast CDN hosting.',
  'ai-chatbot': 'Large language model (Claude / GPT class), your knowledge base, WhatsApp Business API or website widget.',
  'ai-automation': 'AI agents with Claude / GPT class models, automation workflows, integrations with your existing tools.',
  'erp-crm': 'Web application (React / Node.js / PostgreSQL) or customisation of an open-source ERP, hosted in the cloud.',
};

export function softwareTemplate(lead: Lead, guide: { rows: PriceRow[]; terms: string }, preparedBy: string): Omit<Proposal, 'id' | 'status' | 'created_at' | 'updated_at'> {
  const row = priceRowFor(lead.niche?.startsWith('SaaS:') ? 'saas-product' : `${lead.niche ?? ''} ${lead.service_fit ?? ''} ${lead.requirement ?? ''}`, guide.rows);
  const currency = currencyFor(lead.country);
  const range = currency === 'INR' ? row.inr : row.usd;
  const monthly = currency === 'INR' ? row.monthly_inr : row.monthly_usd;
  const company = lead.company || 'your team';
  const need = lead.requirement || lead.pain_point || 'Describe the requirement you discussed with the client.';
  const product = lead.niche?.startsWith('SaaS:') ? lead.niche.slice(5).trim() : null;
  const scope = (SCOPE[row.slug] ?? SCOPE['website-dynamic']).map((s) => `- ${s}`).join('\n');

  const sections: Section[] = [
    { key: 'understanding', heading: 'Understanding your needs', body: need },
    {
      key: 'solution',
      heading: 'Our proposed solution',
      body: product
        ? `Brainbric's ${product} software, set up for ${company}. It replaces manual registers, spreadsheets and WhatsApp follow-ups with one system your team uses every day, so work is tracked, nothing is missed and you get clear reports.`
        : `Brainbric will design and build ${NOUN[row.slug] ?? 'the software you need'} for ${company}${lead.service_fit ? ` (${lead.service_fit.replace(/\.$/, '')})` : ''}. We start with the features that matter most to your business, launch quickly, and improve it with you after launch.`,
    },
    { key: 'scope', heading: 'Scope and key features', body: scope },
    { key: 'technology', heading: 'Technology', body: TECH[row.slug] ?? TECH['website-dynamic'] },
    {
      key: 'timeline',
      heading: 'Timeline and milestones',
      body: [
        `Estimated timeline: ${row.timeline}.`,
        '',
        '1. Discovery: confirm requirements and sign off the scope',
        '2. Design: screens and user flow for your approval',
        '3. Build: development with a weekly progress demo',
        '4. Test: your team tests a beta version',
        '5. Launch: go live, training and hand-over',
      ].join('\n'),
    },
    { key: 'terms', heading: 'Investment terms', body: guide.terms },
    {
      key: 'next',
      heading: 'Next steps',
      body: `1. A 20-minute call to confirm scope and priorities\n2. A fixed quote within this range and a project plan within 48 hours\n3. Kick-off once the first milestone payment is received`,
    },
  ];

  return {
    lead_id: lead.id,
    kind: 'software',
    title: product
      ? `${product} software for ${company}`
      : lead.service_fit && lead.service_fit.length <= 70
        ? `${lead.service_fit.replace(/\.$/, '')} for ${company}`
        : `${row.label} for ${company}`,
    sections,
    price_min: range[0],
    price_max: range[1],
    monthly_min: monthly?.[0] ?? null,
    monthly_max: monthly?.[1] ?? null,
    currency,
    source: 'portal',
    prepared_by: preparedBy,
  };
}

// ---------- College template ----------

export function collegeTemplate(lead: Lead, preparedBy: string): Omit<Proposal, 'id' | 'status' | 'created_at' | 'updated_at'> {
  const program = programInfo(lead.program);
  const tier = lead.tier ? TIERS[lead.tier] : null;
  const value = estValue(lead);
  const dept = lead.department ? ` for the ${lead.department} department` : '';
  return {
    lead_id: lead.id,
    kind: 'college',
    title: `Industry Readiness Programs for ${lead.company ?? 'your institution'}`,
    sections: [
      {
        key: 'note',
        heading: 'A note for your institution',
        body: `Thank you for considering Brainbric Innovations. Based on ${lead.company ?? 'your institution'}'s focus${lead.pain_point ? ` (${lead.pain_point.replace(/\.$/, '')})` : ''}, we recommend starting with the ${program?.label ?? 'Industry Awareness Session'}${dept}${lead.domain ? `, in ${lead.domain}` : ''}. We are happy to adapt dates, batch size and topics to your academic calendar.`,
      },
      ...(tier ? [{ key: 'recommendation', heading: 'Why this program', body: tier.pitch }] : []),
    ],
    price_min: value,
    price_max: value,
    monthly_min: null,
    monthly_max: null,
    currency: 'INR',
    source: 'portal',
    prepared_by: preparedBy,
  };
}
