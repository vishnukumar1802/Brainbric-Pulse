// The services a manager can point the lead agents at. Each carries a short playbook the agents receive with the focus.
// Plain constants (no server-only) so the Focus form can render them too.

export type Service = {
  slug: string;
  label: string;
  /** Needs the manager to name a product or industry, e.g. "Facility Management". */
  needsProduct?: boolean;
  target: string;
  signals: string[];
  offer: string;
  sources: string;
};

export const SERVICES: Service[] = [
  {
    slug: 'saas-product',
    label: 'SaaS product',
    needsProduct: true,
    target: 'Businesses in the industry the product serves that still run that work on Excel, WhatsApp, paper or an outdated tool.',
    signals: [
      'Manual processes the product replaces (spreadsheets, registers, WhatsApp groups, phone calls)',
      'Growing operations: new branches, sites, clients or staff, without a system to run them',
      'Publicly asking for software or a vendor in this area, or complaining about their current tool',
      'Compliance or reporting pressure the product helps with',
    ],
    offer: 'The named SaaS product: a short demo, quick setup and a monthly subscription. Lead with the one problem it removes for them.',
    sources: "Industry directories and associations, Google Business / Justdial / IndiaMART listings, each business's own website, tenders and RFPs, industry news.",
  },
  {
    slug: 'custom-saas',
    label: 'Custom SaaS development',
    target: 'Founders and companies who want their own SaaS platform built (MVP or rebuild).',
    signals: [
      'Founder or company publicly planning a SaaS / platform and looking for a build partner',
      'RFPs or “looking for a development company” posts for a platform, portal or marketplace',
      'An outdated product that needs a rebuild (old stack, poor UX, no mobile)',
    ],
    offer: 'Build the SaaS end to end: multi-tenant architecture, subscriptions and billing, admin dashboards, APIs, cloud hosting, MVP in weeks.',
    sources: 'Startup communities and founder posts, RFP sites, Clutch / GoodFirms project posts, freelance project marketplaces (projects only).',
  },
  {
    slug: 'app-development',
    label: 'App development',
    target: 'Businesses whose customers would clearly benefit from a mobile app (Android / iOS).',
    signals: [
      'No mobile app where competitors have one (clinics, restaurants, salons, gyms, schools, real estate, D2C, logistics)',
      'Booking, ordering or tracking done by phone, WhatsApp or web forms only',
      'An outdated or badly rated existing app',
      'Publicly asking for an app developer or agency',
    ],
    offer: 'A mobile app built for their customers or staff: booking, ordering, payments, notifications, loyalty or tracking.',
    sources: 'Google Business / Justdial listings, app stores (bad reviews or missing apps), business websites, “looking for app developer” posts.',
  },
  {
    slug: 'website-development',
    label: 'Website development',
    target: 'Businesses with no website, or an outdated, slow, broken or non-mobile website.',
    signals: [
      'No website, only a social page or listing',
      'Outdated design, not mobile friendly, broken pages, no SSL, very slow',
      'No online enquiry, booking or payment on the site',
      'Publicly asking for a web designer or agency',
    ],
    offer: 'A fast, modern, mobile-friendly website with enquiry, booking or e-commerce, built and launched in weeks.',
    sources: "Google Business / Justdial / IndiaMART listings, each business's own site, and 'need a website' posts.",
  },
  {
    slug: 'ai-automation',
    label: 'AI & automation',
    target: 'Businesses with repetitive manual work or high enquiry volume that AI or automation can take over.',
    signals: [
      'Publicly talking about AI, chatbots, automation or digital transformation',
      'Heavy manual work: data entry, follow-ups, support replies, report building',
      'High enquiry volume on WhatsApp or the website with slow replies',
    ],
    offer: 'AI agents, website or WhatsApp chatbots, workflow automation and AI features inside their existing tools.',
    sources: 'Company blogs and news, founder interviews, LinkedIn post snippets, business websites, RFPs.',
  },
  {
    slug: 'erp-crm',
    label: 'ERP / CRM',
    target: 'SMBs and manufacturers running sales, stock, production or accounts on spreadsheets or disconnected tools.',
    signals: [
      'Spreadsheet-run operations, stock or orders',
      'Multiple branches or plants without one system',
      'Publicly looking for ERP / CRM implementation or customisation',
    ],
    offer: 'A custom ERP or CRM, or customisation of their current one, covering sales, inventory, production, billing and reports.',
    sources: 'Industry associations, IndiaMART / TradeIndia listings, business websites, tenders and RFPs.',
  },
  {
    slug: 'general',
    label: 'All services (no focus)',
    target: 'Any client who needs software built: SaaS, apps, websites, AI and automation.',
    signals: ['Asking for a vendor', 'Visible tech gap', 'AI / automation interest'],
    offer: 'The best-fit Brainbric service for what you found.',
    sources: 'All sources allowed by the playbook.',
  },
];

export function serviceInfo(slug: string | null | undefined): Service {
  return SERVICES.find((s) => s.slug === slug) ?? SERVICES[SERVICES.length - 1];
}

export type Focus = {
  service: string;
  product: string | null;
  product_details: string | null;
  regions: string | null;
  notes: string | null;
  set_by: string | null;
  set_at: string | null;
};

/** The niche label stored on every lead found under this focus, e.g. "SaaS: Facility Management". */
export function focusLabel(f: Pick<Focus, 'service' | 'product'>): string {
  const s = serviceInfo(f.service);
  if (s.needsProduct && f.product) return `SaaS: ${f.product}`;
  return s.slug === 'general' ? 'General' : s.label;
}
