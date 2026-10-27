import 'server-only';
import { q } from './db';

// Programs and fees from the Industry Readiness proposal. Fees are per student unless `flat` is set.
export const PROGRAMS = [
  { slug: 'insight-talk', label: 'Industry Insight Talk', duration: '90 minutes', fee: 0 },
  { slug: 'awareness', label: 'Industry Awareness Session', duration: '1 day', fee: 150 },
  { slug: 'workshop', label: 'Skill Workshop', duration: '2 days', fee: 249 },
  { slug: 'bootcamp', label: 'Industry Readiness & Innovation Bootcamp', duration: '1 week', fee: 450 },
  { slug: 'internship', label: 'Industry Internship Program', duration: '4 weeks', fee: 1499 },
  { slug: 'fdp', label: 'Faculty Development Program', duration: '2 days', fee: 7500, flat: true },
  { slug: 'partnership', label: 'Annual Campus Partnership', duration: 'Academic year', fee: 0 },
] as const;

export const MIN_BATCH = 50;

/** The current proposal, served to signed-in users only (the middleware guards /proposals). */
export const PROPOSAL_URL = '/proposals/brainbric-industry-readiness-programs.pdf';

export function programInfo(slug: string | null | undefined) {
  return PROGRAMS.find((p) => p.slug === slug) ?? null;
}

/** Fee for the pitched program at the college's batch size (minimum batch applies). Null when it cannot be priced. */
export function estValue(l: { program: string | null; student_strength: number | null }): number | null {
  const p = programInfo(l.program);
  if (!p || !p.fee) return null;
  if ('flat' in p && p.flat) return p.fee;
  return p.fee * Math.max(MIN_BATCH, l.student_strength ?? MIN_BATCH);
}

export const INSTITUTION_TYPES: Record<string, string> = {
  engineering: 'Engineering',
  polytechnic: 'Polytechnic',
  arts_science: 'Arts & Science',
  other: 'Other',
};

export const TIERS: Record<number, { label: string; who: string; pitch: string; approach: string[] }> = {
  1: {
    label: 'Tier 1',
    who: 'Autonomous, NAAC A+ or A++, NIRF ranked or a well-known name.',
    pitch: 'Bootcamp, Internship, Faculty Development Program or the Annual Campus Partnership.',
    approach: [
      'Write to the Placement Officer or the Dean of industry relations, copy the HoD.',
      'Lead with outcomes and quality: real projects, AI built in, the institution report for NAAC and NIRF records.',
      'Offer a faculty session or a hackathon tie-up rather than a basic awareness talk.',
      'Expect a longer decision; ask for a 20-minute call and a pilot with one department.',
    ],
  },
  2: {
    label: 'Tier 2',
    who: 'Affiliated, NAAC A or B++, steady placements, mid-size.',
    pitch: 'Industry Readiness & Innovation Bootcamp, combining departments to reach 100+ students.',
    approach: [
      'Write to the HoD and the Placement Officer; they decide and the Principal approves.',
      'Lead with placement readiness and the portfolio project every student builds.',
      'Mention the Coimbatore-region colleges already trained and that most of the fee is paid after delivery.',
      'Offer the complimentary Insight Talk as the first step if they hesitate.',
    ],
  },
  3: {
    label: 'Tier 3',
    who: 'Newer, rural or small, NAAC B or not yet accredited, price-sensitive.',
    pitch: 'Complimentary Insight Talk, then the ₹150 Industry Awareness Session.',
    approach: [
      'Write to the Principal directly; a phone or WhatsApp follow-up works better than email alone.',
      'Lead with affordability: ₹150 per student, travel covered by Brainbric.',
      'Stress employability and confidence: resume, LinkedIn and what recruiters expect.',
      'Combine years and departments to reach the 50-student minimum.',
    ],
  },
};

export type CollegeStats = {
  total: number;
  drafted: number;
  talking: number;
  scheduled: number;
  delivered: number;
  open_value: number;
  byTier: { tier: number | null; n: number; drafted: number; won: number }[];
  byDistrict: { district: string; n: number; won: number }[];
};

const OPEN = `status NOT IN ('lost','no_response','do_not_contact','delivered','won')`;

export async function collegeStats(): Promise<CollegeStats> {
  const [totals, byTier, byDistrict, open] = await Promise.all([
    q<{ total: number; drafted: number; talking: number; scheduled: number; delivered: number }>(
      `SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE status = 'drafted')::int AS drafted,
              COUNT(*) FILTER (WHERE status IN ('replied','interested','call_booked','proposal'))::int AS talking,
              COUNT(*) FILTER (WHERE status = 'scheduled')::int AS scheduled,
              COUNT(*) FILTER (WHERE status IN ('delivered','won'))::int AS delivered
       FROM leads WHERE kind = 'college'`,
    ),
    q<{ tier: number | null; n: number; drafted: number; won: number }>(
      `SELECT tier, COUNT(*)::int AS n, COUNT(*) FILTER (WHERE status = 'drafted')::int AS drafted,
              COUNT(*) FILTER (WHERE status IN ('scheduled','delivered','won'))::int AS won
       FROM leads WHERE kind = 'college' GROUP BY tier ORDER BY tier NULLS LAST`,
    ),
    q<{ district: string; n: number; won: number }>(
      `SELECT COALESCE(NULLIF(TRIM(district), ''), 'Unknown') AS district, COUNT(*)::int AS n,
              COUNT(*) FILTER (WHERE status IN ('scheduled','delivered','won'))::int AS won
       FROM leads WHERE kind = 'college' GROUP BY 1 ORDER BY n DESC, 1 LIMIT 12`,
    ),
    q<{ program: string | null; student_strength: number | null }>(`SELECT program, student_strength FROM leads WHERE kind = 'college' AND ${OPEN}`),
  ]);
  // The open value is summed from the same per-college estimate shown in each row, so the two always agree.
  const open_value = open.reduce((a, l) => a + (estValue(l) ?? 0), 0);
  const t = totals[0] ?? { total: 0, drafted: 0, talking: 0, scheduled: 0, delivered: 0 };
  return { ...t, open_value, byTier, byDistrict };
}

export async function collegeDistricts(): Promise<string[]> {
  const rows = await q<{ d: string }>(
    `SELECT DISTINCT district AS d FROM leads WHERE kind = 'college' AND district IS NOT NULL AND district <> '' ORDER BY 1`,
  );
  return rows.map((r) => r.d);
}

export function fmtRupees(n: number | null | undefined): string {
  if (n == null) return '–';
  return `₹${new Intl.NumberFormat('en-IN').format(n)}`;
}
