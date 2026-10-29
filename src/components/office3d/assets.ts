// Downloads for the 3D office, shared by everything that needs them. The Overview starts them all at once as soon as
// it knows the 3D view will show (before the 3D code itself has loaded), and each file is fetched only once.
// No three.js here, so this stays tiny.
import { AGENT_MODELS, CLIPS, GUEST, PEOPLE_FILES } from './models';

export const BASE = '/office3d';
/** Poly Haven furniture used by the HQ (public/office3d/hq). */
export const HQ_MODELS = [
  'CoffeeCart_01', 'Ottoman_01', 'Television_01', 'bar_chair_round_01', 'calathea_orbifolia_01', 'chess_set',
  'classic_laptop', 'coffee_table_round_01', 'dartboard', 'desk_lamp_arm_01', 'gaming_console',
  'mid_century_lounge_chair', 'modern_arm_chair_01', 'modern_ceiling_lamp_01', 'modern_coffee_table_01',
  'pachira_aquatica_01', 'planter_box_01', 'potted_plant_01', 'potted_plant_02', 'potted_plant_04',
  'round_wooden_table_01', 'sofa_02', 'steel_frame_shelves_01', 'wall_clock',
] as const;

const files = new Map<string, Promise<Response>>();
function get(url: string) {
  let p = files.get(url);
  if (!p) {
    p = fetch(url).then((r) => {
      if (!r.ok) throw new Error(`${url}: ${r.status}`);
      return r;
    });
    p.catch(() => files.delete(url));
    files.set(url, p);
  }
  return p;
}
/** Each call gets its own copy of the body, so the same file can be read by more than one part. */
export const fetchBuffer = (url: string) => get(url).then((r) => r.clone().arrayBuffer());
export const fetchJson = <T,>(url: string) => get(url).then((r) => r.clone().json() as Promise<T>);
export const fetchBlob = (url: string) => get(url).then((r) => r.clone().blob());

export const personUrl = (file: string) => `${BASE}/folk/${file}.glb`;
export const textureUrl = (file: string) => `${BASE}/folk/${file}`;
export const clipUrl = (name: string) => `${BASE}/anim/${name}.json`;
export const hqUrl = (name: string) => `${BASE}/hq/${name}.glb`;

let started = false;
/** Start every download the 3D office needs: motions first, then the people, then the furniture. */
export function preloadOffice() {
  if (started) return;
  started = true;
  for (const c of CLIPS) void get(clipUrl(c)).catch(() => undefined);
  const people = new Set([...Object.values(AGENT_MODELS).map((m) => m.file), GUEST.file, ...PEOPLE_FILES]);
  for (const f of people) void get(personUrl(f)).catch(() => undefined);
  for (const n of HQ_MODELS) void get(hqUrl(n)).catch(() => undefined);
}
