// Which 3D person (from Microsoft's open Rocketbox library, files in public/office3d/people) plays whom.
// Agents get the person closest to their portrait; team members and visitors get one picked steadily from a pool.
import type { OfficePerson } from '@/lib/office';

export type Model = { file: string; sex: 'm' | 'f' };

export const AGENT_MODELS: Record<string, Model> = {
  'lead-hunter': { file: 'Male_Adult_17', sex: 'm' }, // Arjun: navy jacket over a light top
  'requirement-hunter': { file: 'Female_Adult_09', sex: 'f' }, // Priya: blazer
  'inbox-assistant': { file: 'Male_Adult_11', sex: 'm' }, // Karthik: black top
  'college-outreach': { file: 'Female_Adult_15', sex: 'f' }, // Meena: blue top
  'daily-brief': { file: 'Female_Adult_04', sex: 'f' }, // Divya: brown jacket
  'social-content': { file: 'Male_Adult_04', sex: 'm' }, // Rahul: casual jacket
  'competitor-watch': { file: 'Female_Adult_07', sex: 'f' }, // Sneha: dark jacket
  'mail-watcher': { file: 'Male_Adult_08', sex: 'm' }, // Vikram: light blue shirt
};

const TEAM: Model[] = [
  { file: 'Male_Adult_02', sex: 'm' },
  { file: 'Female_Adult_17', sex: 'f' },
];
const ADMIN: Model = { file: 'Male_Adult_14', sex: 'm' };
export const GUEST: Model = { file: 'Male_Adult_02', sex: 'm' };

function hash(s: string): number {
  let h = 7;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export function modelFor(p: OfficePerson): Model {
  if (p.slug && AGENT_MODELS[p.slug]) return AGENT_MODELS[p.slug];
  if (p.kind === 'admin') return ADMIN;
  return TEAM[hash(p.id) % TEAM.length];
}

/** Motion clips (public/office3d/anim). Talking and listening are shared by everyone. */
export const CLIPS = [
  'm_walk_neutral_01',
  'f_walk_neutral_01',
  'm_sit_table_breathe_01',
  'f_sit_table_breathe_01',
  'm_idle_breathe_01',
  'f_idle_breathe_01',
  'm_gestic_talk_neutral_02',
  'f_gestic_listen_accept_01',
] as const;
