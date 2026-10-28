// Indicative price ranges for proposals. Pitched at small-agency rates for Indian startups and SMBs (₹) and at
// offshore rates for international clients ($): affordable for the client, above our delivery cost. Admins edit them in Settings.

export type PriceRow = {
  slug: string;
  label: string;
  inr: [number, number];
  usd: [number, number];
  /** 'project' for a one-time build, 'month' for recurring fees. */
  unit: 'project' | 'month';
  timeline: string;
  /** Optional recurring part shown after the one-time range, e.g. a SaaS subscription. */
  monthly_inr?: [number, number];
  monthly_usd?: [number, number];
};

export const DEFAULT_PRICES: PriceRow[] = [
  { slug: 'website-basic', label: 'Business website (5-10 pages)', inr: [25000, 60000], usd: [800, 2000], unit: 'project', timeline: '2-3 weeks' },
  { slug: 'website-dynamic', label: 'Website with CMS, booking or e-commerce', inr: [60000, 150000], usd: [2000, 5000], unit: 'project', timeline: '4-6 weeks' },
  { slug: 'app-mvp', label: 'Mobile app MVP (Android + iOS)', inr: [150000, 400000], usd: [5000, 12000], unit: 'project', timeline: '6-10 weeks' },
  { slug: 'app-advanced', label: 'Advanced mobile app (payments, real-time, admin panel)', inr: [400000, 800000], usd: [12000, 25000], unit: 'project', timeline: '10-16 weeks' },
  { slug: 'saas-mvp', label: 'Custom SaaS MVP', inr: [300000, 800000], usd: [10000, 25000], unit: 'project', timeline: '8-12 weeks' },
  { slug: 'saas-full', label: 'Full SaaS platform', inr: [800000, 2000000], usd: [25000, 60000], unit: 'project', timeline: '4-6 months' },
  { slug: 'ai-chatbot', label: 'AI chatbot (website or WhatsApp)', inr: [40000, 150000], usd: [1500, 5000], unit: 'project', timeline: '2-4 weeks' },
  { slug: 'ai-automation', label: 'AI agents and workflow automation', inr: [75000, 300000], usd: [2500, 10000], unit: 'project', timeline: '3-6 weeks' },
  { slug: 'erp-crm', label: 'Custom ERP / CRM', inr: [200000, 800000], usd: [7000, 25000], unit: 'project', timeline: '8-16 weeks' },
  {
    slug: 'saas-subscription',
    label: 'Ready SaaS product (setup + subscription)',
    inr: [10000, 50000],
    usd: [300, 1500],
    unit: 'project',
    timeline: '1-2 weeks to go live',
    monthly_inr: [2000, 10000],
    monthly_usd: [50, 300],
  },
  { slug: 'maintenance', label: 'Support and maintenance', inr: [8000, 40000], usd: [300, 1500], unit: 'month', timeline: 'Monthly' },
];

export const DEFAULT_PRICE_TERMS = [
  'Indicative range; the final quote follows a short scoping call.',
  'Payment: 40% to start, 40% when the beta is ready, 20% at launch.',
  'Minimum project value ₹25,000 (or $800).',
  'Changes beyond the agreed scope are quoted separately before work starts.',
  'Hosting, domains, app store and third-party fees are billed at actuals.',
  '30 days of free support after launch.',
]
  .map((t) => `- ${t}`)
  .join('\n');

/** Which price row a service focus (or a lead's niche / service text) maps to. */
export function priceRowFor(serviceSlugOrText: string | null | undefined, rows: PriceRow[]): PriceRow {
  const t = (serviceSlugOrText ?? '').toLowerCase();
  const pick = (slug: string) => rows.find((r) => r.slug === slug) ?? rows[0];
  if (/saas-product|^saas:|subscription/.test(t)) return pick('saas-subscription');
  // Whole words only: "WhatsApp" is not an app request and "maintain" is not AI.
  if (/custom-saas|\bsaas\b|marketplace|multi-tenant/.test(t)) return pick('saas-mvp');
  if (/\b(mobile )?apps?\b|\bandroid\b|\bios\b|app-development/.test(t) && !/\bweb apps?\b/.test(t)) return pick('app-mvp');
  if (/\berp\b|\bcrm\b|inventory/.test(t)) return pick('erp-crm');
  if (/chatbot|whatsapp bot/.test(t)) return pick('ai-chatbot');
  if (/\bai\b|automation|\bagents?\b/.test(t)) return pick('ai-automation');
  if (/e-?commerce|booking|\bcms\b|\bshop\b|portal|dashboard|\bweb apps?\b/.test(t)) return pick('website-dynamic');
  if (/website|web site|landing|\bsite\b/.test(t)) return pick('website-basic');
  return pick('website-dynamic');
}

/** Clients outside India are quoted in dollars. */
export function currencyFor(country: string | null | undefined): 'INR' | 'USD' {
  const c = (country ?? '').trim().toLowerCase();
  return !c || c === 'india' || c === 'in' ? 'INR' : 'USD';
}

export function fmtMoney(n: number | null | undefined, currency: 'INR' | 'USD'): string {
  if (n == null) return '–';
  return currency === 'INR' ? `₹${new Intl.NumberFormat('en-IN').format(n)}` : `$${new Intl.NumberFormat('en-US').format(n)}`;
}

export function fmtRange(min: number | null | undefined, max: number | null | undefined, currency: 'INR' | 'USD'): string {
  if (min == null && max == null) return 'To be confirmed after scoping';
  if (min != null && max != null && min !== max) return `${fmtMoney(min, currency)} – ${fmtMoney(max, currency)}`;
  return fmtMoney(min ?? max, currency);
}
