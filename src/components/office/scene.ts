// Draws the isometric office on a 2D canvas. Plain functions, no React: the OfficeView component calls drawOffice
// every animation frame with the people from the simulation (sim.ts) and gets back the clickable areas.
import type { FloorKey, OfficePerson } from '@/lib/office';
import { AGENT_AVATARS, type HairStyle, type Look } from '@/lib/avatars';
import { DESKS, PANTRY_SEATS, type Actor, type BubbleKind, type Face } from './sim';

export const LW = 900;
export const LH = 540;
const S = 26;
const OX = 400;
const OY = 104;

export type Hit = { x: number; y: number; w: number; h: number; href?: string; action?: 'lift'; id?: string };

export type SceneInput = {
  floor: FloorKey;
  actors: Actor[];
  ready: number;
  readyHref: string;
  talks: number;
  talksHref: string;
  otherFloor: string | null;
  selected: string | null;
  t: number;
  liftT: number | null;
  font: string;
};

const THEMES: Record<FloorKey, { tile: [string, string]; wall: string; acc: string; rooms: [string, string, string, string]; label: string }> = {
  g: { tile: ['#e6ebee', '#dde4e8'], wall: '#f4f0ea', acc: '#FF3A08', rooms: ['#d5e7dc', '#f0e2cc', '#ddd6ee', '#f3e4c3'], label: 'Ground floor · Software services' },
  f: { tile: ['#f2e9dc', '#ebe0cf'], wall: '#f7f2f7', acc: '#7F77DD', rooms: ['#e4ddf4', '#f3e3cf', '#e8dcef', '#f4e6c7'], label: 'First floor · College programs' },
};

export const STATE_COLORS: Record<OfficePerson['state'], string> = {
  working: '#1D9E75',
  walking: '#D85A30',
  paused: '#8E8893',
  failed: '#C4242A',
  away: '#B4B2A9',
};
export const PEOPLE_COLOR = '#378ADD';

export function personColor(p: OfficePerson): string {
  if (p.kind !== 'agent') return p.state === 'away' ? STATE_COLORS.away : PEOPLE_COLOR;
  return STATE_COLORS[p.state];
}

const HAIR = ['#2a1d16', '#1b1b1b', '#3b2416', '#24170f', '#1d1410', '#3a2618', '#4a3020', '#2e1f14'];
const SHIRTS = ['#2f7fd1', '#d0543a', '#e0a526', '#8a4fd0', '#2b8a7e', '#7a6fd0', '#5a9e4b', '#c4497a', '#c98a2b', '#24324a'];
const SKINS = ['#C68A5E', '#A9744F', '#D9A47A', '#B97E55', '#E0B48C', '#9E6A45'];
const STYLES: HairStyle[] = ['short', 'short', 'long', 'curly', 'bob', 'ponytail'];
function hash(s: string): number {
  let h = 7;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}
/** Agents wear the outfit from their portrait; everyone else gets a steady look picked from their id. */
function looks(p: OfficePerson): Look {
  const known = p.slug ? AGENT_AVATARS[p.slug]?.look : undefined;
  if (known) return known;
  const h = hash(p.id);
  const shirt = SHIRTS[(h >>> 4) % SHIRTS.length];
  return { skin: SKINS[h % SKINS.length], hair: HAIR[(h >>> 8) % HAIR.length], style: STYLES[(h >>> 12) % STYLES.length], top: shirt, inner: shirt, pants: '#2f3747' };
}


type Ctx = CanvasRenderingContext2D;
type Pt = [number, number];

function P(x: number, y: number, z: number): Pt {
  return [OX + (x - y) * S, OY + ((x + y) * S) / 2 - z * S];
}
function shade(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${((n >> 16) * f) | 0},${(((n >> 8) & 255) * f) | 0},${((n & 255) * f) | 0})`;
}

const ROOM_CACHE = new Map<string, HTMLCanvasElement>();

export function drawOffice(ctx: Ctx, scale: number, s: SceneInput): Hit[] {
  // `c` is swapped for the cache canvas while the room is drawn once.
  let c = ctx;
  const th = THEMES[s.floor];
  const hits: Hit[] = [];
  const tags: (() => void)[] = [];
  const fr = Math.floor(s.t * 5) % 2;
  const font = (w: number, px: number) => `${w} ${px}px ${s.font}`;

  const poly = (p: Pt[], fill: string, stroke?: string) => {
    c.beginPath();
    c.moveTo(p[0][0], p[0][1]);
    for (let i = 1; i < p.length; i++) c.lineTo(p[i][0], p[i][1]);
    c.closePath();
    c.fillStyle = fill;
    c.fill();
    if (stroke) {
      c.strokeStyle = stroke;
      c.lineWidth = 1;
      c.stroke();
    }
  };
  const box = (x: number, y: number, z: number, w: number, d: number, h: number, col: string, glass = false) => {
    const top: Pt[] = [P(x, y, z + h), P(x + w, y, z + h), P(x + w, y + d, z + h), P(x, y + d, z + h)];
    const left: Pt[] = [P(x, y + d, z), P(x + w, y + d, z), P(x + w, y + d, z + h), P(x, y + d, z + h)];
    const right: Pt[] = [P(x + w, y, z), P(x + w, y + d, z), P(x + w, y + d, z + h), P(x + w, y, z + h)];
    if (glass) {
      poly(left, 'rgba(170,215,240,0.22)', 'rgba(110,160,195,0.55)');
      poly(right, 'rgba(170,215,240,0.16)', 'rgba(110,160,195,0.55)');
      poly(top, 'rgba(210,238,250,0.7)', 'rgba(110,160,195,0.55)');
      return;
    }
    poly(left, shade(col, 0.86));
    poly(right, shade(col, 0.7));
    poly(top, col);
  };
  const fy = (x1: number, x2: number, y: number, z1: number, z2: number, col: string) => poly([P(x1, y, z1), P(x2, y, z1), P(x2, y, z2), P(x1, y, z2)], col);
  const fx = (x: number, y1: number, y2: number, z1: number, z2: number, col: string) => poly([P(x, y1, z1), P(x, y2, z1), P(x, y2, z2), P(x, y1, z2)], col);
  const tile = (x: number, y: number, w: number, d: number, col: string) => poly([P(x, y, 0), P(x + w, y, 0), P(x + w, y + d, 0), P(x, y + d, 0)], col);
  const rr = (x: number, y: number, w: number, h: number, r: number) => {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  };
  const bubble = (text: string, p: Pt, kind: BubbleKind = 'work') => {
    const danger = kind === 'alert';
    const chat = kind === 'chat';
    c.font = chat ? `italic ${font(500, 12)}` : font(600, 12);
    const w = c.measureText(text).width + 18;
    const x = p[0] - w / 2;
    const y = p[1] - 28;
    c.fillStyle = 'rgba(0,0,0,0.14)';
    rr(x + 1, y + 2, w, 22, 11);
    c.fill();
    rr(x, y, w, 22, 11);
    c.fillStyle = danger ? '#FFEDEA' : chat ? '#F4F2EC' : '#ffffff';
    c.fill();
    c.beginPath();
    c.moveTo(p[0] - 5, y + 21);
    c.lineTo(p[0], y + 27);
    c.lineTo(p[0] + 5, y + 21);
    c.fill();
    c.fillStyle = danger ? '#831C1E' : chat ? '#5F5E5A' : '#1d1a1e';
    c.textAlign = 'center';
    c.fillText(text, p[0], y + 15);
  };
  const pill = (text: string, p: Pt, col: string, hit?: Omit<Hit, 'x' | 'y' | 'w' | 'h'>) => {
    c.font = font(700, 11);
    const w = c.measureText(text).width + 14;
    rr(p[0] - w / 2, p[1] - 9, w, 18, 9);
    c.fillStyle = col;
    c.fill();
    c.fillStyle = '#ffffff';
    c.textAlign = 'center';
    c.fillText(text, p[0], p[1] + 4);
    if (hit) hits.push({ x: p[0] - w / 2, y: p[1] - 9, w, h: 18, ...hit });
  };
  const plant = (x: number, y: number) => {
    box(x, y, 0, 0.42, 0.42, 0.38, '#e7e1d6');
    box(x - 0.06, y - 0.06, 0.38, 0.54, 0.54, 0.38, '#4e9a5c');
    box(x + 0.08, y + 0.08, 0.76, 0.26, 0.26, 0.26, '#69b874');
  };
  /**
   * A person made of boxes, facing one of four ways. `gait` animates walking: the stride phase swings the legs
   * (one forward, one back, the moving foot lifted), the arms swing the other way and the body bobs with each step.
   */
  const person = (x: number, y: number, z: number, p: OfficePerson, face: Face, seated = false, gait?: { phase: number; amt: number }): Pt => {
    const lk = looks(p);
    const alongX = face === '+x' || face === '-x';
    if (s.selected === p.id) {
      c.strokeStyle = '#FCB216';
      c.lineWidth = 2.5;
      const q = P(x + 0.17, y + 0.13, z === 0 ? 0 : z - 0.45);
      c.beginPath();
      c.ellipse(q[0], q[1], 17, 8.5, 0, 0, Math.PI * 2);
      c.stroke();
    }
    if (z === 0) {
      c.fillStyle = 'rgba(0,0,0,0.16)';
      const q = P(x + 0.17, y + 0.13, 0);
      c.beginPath();
      c.ellipse(q[0], q[1], 10, 5, 0, 0, Math.PI * 2);
      c.fill();
    }
    const sw = gait ? Math.sin(gait.phase) * gait.amt : 0;
    const bob = gait ? Math.abs(Math.sin(gait.phase)) * 0.035 * gait.amt : 0;
    // The direction of travel along the floor, for the swing.
    const fx0 = alongX ? (face === '+x' ? 1 : -1) : 0;
    const fy0 = alongX ? 0 : face === '+y' ? 1 : -1;
    if (!seated) {
      const legs: [number, number][] = alongX ? [[0.11, 0.03], [0.11, 0.17]] : [[0.04, 0.07], [0.19, 0.07]];
      legs.forEach(([ox, oy], i) => {
        const k = i === 0 ? sw : -sw;
        const lift = Math.max(0, k) * 0.05;
        box(x + ox + fx0 * k * 0.1, y + oy + fy0 * k * 0.1, lift, 0.12, 0.12, 0.45 - lift + bob, lk.pants);
      });
    }
    const b = z + (seated ? 0 : 0.45) + bob;
    // Torso and arms in the outer layer (jacket, blazer, shirt), with what is underneath showing down the front.
    if (alongX) {
      box(x + 0.04, y - 0.04, b, 0.26, 0.34, 0.5, lk.top);
      if (lk.inner !== lk.top && face === '+x') fx(x + 0.3, y + 0.08, y + 0.22, b + 0.06, b + 0.49, lk.inner);
      box(x + 0.09 - fx0 * sw * 0.08, y - 0.11, b + 0.12, 0.16, 0.07, 0.34, lk.top);
      box(x + 0.09 + fx0 * sw * 0.08, y + 0.3, b + 0.12, 0.16, 0.07, 0.34, lk.top);
    } else {
      box(x, y, b, 0.34, 0.26, 0.5, lk.top);
      if (lk.inner !== lk.top && face === '+y') fy(x + 0.11, x + 0.23, y + 0.26, b + 0.06, b + 0.49, lk.inner);
      box(x - 0.07, y + 0.05 - fy0 * sw * 0.08, b + 0.12, 0.07, 0.16, 0.34, lk.top);
      box(x + 0.34, y + 0.05 + fy0 * sw * 0.08, b + 0.12, 0.07, 0.16, 0.34, lk.top);
    }
    const hz = b + 0.5;
    // Long hair, a bob or a ponytail hangs at the back of the head: drawn before the head when the face is towards
    // us (so the head covers it), after it when they face away.
    const towards = face === '+y' || face === '+x';
    const backHair = () => {
      const len = lk.style === 'long' ? 0.5 : lk.style === 'bob' ? 0.3 : lk.style === 'ponytail' ? 0.28 : 0;
      if (!len) return;
      const thin = lk.style === 'ponytail';
      const zb = hz + 0.28 - len;
      if (alongX) {
        const bx = face === '+x' ? x - 0.03 : x + 0.27;
        box(bx, y + (thin ? 0.09 : 0.0), zb, 0.08, thin ? 0.08 : 0.26, len, lk.hair);
      } else {
        const by = face === '+y' ? y - 0.05 : y + 0.23;
        box(x + (thin ? 0.13 : 0.02), by, zb, thin ? 0.08 : 0.3, 0.08, len, lk.hair);
      }
    };
    if (towards) backHair();
    box(x + 0.03, y, hz, 0.28, 0.26, 0.28, lk.skin);
    if (!towards) backHair();
    // Hair on top: curly hair is fuller; a bun sits at the back.
    if (lk.style === 'curly') box(x - 0.01, y - 0.04, hz + 0.2, 0.36, 0.34, 0.16, lk.hair);
    else box(x + 0.01, y - 0.02, hz + 0.22, 0.32, 0.3, 0.1, lk.hair);
    if (lk.style === 'bun') {
      const [bx, by] = alongX ? [face === '+x' ? x - 0.04 : x + 0.24, y + 0.08] : [x + 0.11, face === '+y' ? y - 0.06 : y + 0.2];
      box(bx, by, hz + 0.22, 0.12, 0.12, 0.12, lk.hair);
    }
    if (lk.headset) {
      box(x - 0.005, y + 0.08, hz + 0.08, 0.04, 0.1, 0.12, '#222');
      box(x + 0.305, y + 0.08, hz + 0.08, 0.04, 0.1, 0.12, '#222');
    }
    // Face: eyes (and glasses or a beard) on the side facing us, or the back of the head when walking away.
    if (face === '+y') {
      if (lk.beard) fy(x + 0.06, x + 0.28, y + 0.26, hz + 0.01, hz + 0.09, lk.hair);
      if (lk.glasses) fy(x + 0.05, x + 0.29, y + 0.261, hz + 0.1, hz + 0.19, '#1c1c1c');
      fy(x + 0.08, x + 0.12, y + 0.262, hz + 0.12, hz + 0.17, lk.glasses ? '#f4f4f4' : '#2a2a2a');
      fy(x + 0.21, x + 0.25, y + 0.262, hz + 0.12, hz + 0.17, lk.glasses ? '#f4f4f4' : '#2a2a2a');
    } else if (face === '+x') {
      if (lk.beard) fx(x + 0.31, y + 0.03, y + 0.23, hz + 0.01, hz + 0.09, lk.hair);
      if (lk.glasses) fx(x + 0.311, y + 0.02, y + 0.24, hz + 0.1, hz + 0.19, '#1c1c1c');
      fx(x + 0.312, y + 0.05, y + 0.09, hz + 0.12, hz + 0.17, lk.glasses ? '#f4f4f4' : '#2a2a2a');
      fx(x + 0.312, y + 0.17, y + 0.21, hz + 0.12, hz + 0.17, lk.glasses ? '#f4f4f4' : '#2a2a2a');
    } else if (face === '-x') {
      if (lk.style === 'short' || lk.style === 'curly' || lk.style === 'bun') box(x + 0.23, y + 0.0, hz + 0.04, 0.09, 0.26, 0.2, lk.hair);
    } else if (lk.style === 'short' || lk.style === 'curly' || lk.style === 'bun') {
      box(x + 0.02, y + 0.2, hz + 0.04, 0.3, 0.08, 0.2, lk.hair);
    }
    return P(x + 0.17, y + 0.13, hz + 0.78);
  };
  // Name tags stay short so neighbours don't overlap; an agent without a given name shows the first word of its job.
  const tagText = (p: OfficePerson) => (p.name.length > 12 ? p.name.split(' ')[0] : p.name);
  const nameTag = (p: OfficePerson, at: Pt) => pill(tagText(p), at, personColor(p), { href: p.href ?? undefined, id: p.id });

  // Who is sitting where right now (the simulation decides; walkers have no seat).
  const seatedAt = (kind: 'desk' | 'pantry' | 'cabin', i = 0) =>
    s.actors.find((a) => !a.walking && a.seat?.kind === kind && (kind === 'cabin' || (a.seat as { i: number }).i === i));
  const deskOwner = (i: number) => s.actors.find((a) => a.home?.kind === 'desk' && (a.home as { i: number }).i === i);
  /** Name tag, and the speech bubble above it: the simulation's bubble, or what they are doing when selected. */
  const label = (a: Actor, at: Pt, zz = false) => {
    tags.push(() => {
      nameTag(a.person, at);
      if (zz) {
        const k = s.t % 2;
        c.font = font(700, 14);
        c.fillStyle = '#6b6b8a';
        c.textAlign = 'left';
        c.globalAlpha = 1 - k / 2;
        c.fillText('z z', at[0] + 18, at[1] - 8 - k * 10);
        c.globalAlpha = 1;
      }
      const b = a.bubble ?? (s.selected === a.person.id ? { text: a.person.detail, kind: 'work' as const } : null);
      if (b) bubble(b.text, [at[0], at[1] - 10], b.kind);
    });
  };

  // The room itself (floor, walls, windows, lift, board) never changes: draw it once per floor and size, then reuse it.
  const key = `${s.floor}|${c.canvas.width}x${c.canvas.height}|${scale}`;
  let room = ROOM_CACHE.get(key);
  if (!room) {
    room = document.createElement('canvas');
    room.width = c.canvas.width;
    room.height = c.canvas.height;
    const rc = room.getContext('2d')!;
    const real = c;
    c = rc;
    c.setTransform(scale, 0, 0, scale, 0, 0);

    // Floor, rooms and walls.
    box(0, 0, -0.35, 18, 14, 0.35, '#b7ae9f');
    for (let y = 0; y < 14; y++) for (let x = 0; x < 18; x++) tile(x, y, 1, 1, th.tile[(x + y) % 2]);
    tile(0, 0, 6, 4.8, th.rooms[0]);
    tile(13, 0, 5, 4.8, th.rooms[1]);
    tile(13, 4.8, 5, 5, th.rooms[2]);
    tile(13, 9.8, 5, 4.2, th.rooms[3]);
    tile(0.6, 5.6, 11.2, 7.4, 'rgba(60,100,150,0.08)');
    box(-0.25, -0.25, 0, 0.25, 14.25, 2.4, th.wall);
    box(0, -0.25, 0, 18, 0.25, 2.4, th.wall);
    fy(0, 18, 0, 2.15, 2.4, th.acc);
    fx(0, 0, 14, 2.15, 2.4, th.acc);
    for (const y of [5.4, 8.4, 11.4]) {
      fx(0, y, y + 2, 0.9, 1.9, '#bfe0f0');
      fx(0, y + 0.97, y + 1.03, 0.9, 1.9, '#ffffff');
    }
    for (const [a, b] of [[1, 3], [3.4, 5.4], [13.6, 15.6]]) {
      fy(a, b, 0, 0.9, 1.9, '#bfe0f0');
      fy((a + b) / 2 - 0.03, (a + b) / 2 + 0.03, 0, 0.9, 1.9, '#ffffff');
    }
    fy(7.3, 9.7, 0, 0, 1.85, '#8f99a4');
    fy(7.45, 8.45, 0, 0.03, 1.75, '#cdd5dc');
    fy(8.55, 9.55, 0, 0.03, 1.75, '#cdd5dc');
    fy(10.2, 12.6, 0, 0.8, 1.85, '#ffffff');
    [['#E4572E', 4], ['#EF9F27', 3], ['#378ADD', 2], ['#1D9E75', 2]].forEach(([col, n], i) => {
      for (let k = 0; k < (n as number); k++) fy(10.35 + i * 0.58, 10.75 + i * 0.58, 0, 1.55 - k * 0.17, 1.68 - k * 0.17, col as string);
    });
    c = real;
    if (ROOM_CACHE.size > 6) ROOM_CACHE.clear();
    ROOM_CACHE.set(key, room);
  }
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.clearRect(0, 0, c.canvas.width, c.canvas.height);
  c.drawImage(room, 0, 0);
  c.setTransform(scale, 0, 0, scale, 0, 0);
  fy(8.3, 8.7, 0, 1.92, 2.06, fr ? '#ffcc4d' : '#d6a92a');

  // Furniture and people, drawn back to front.
  const items: { k: number; fn: () => void }[] = [];
  const add = (k: number, fn: () => void) => items.push({ k, fn });

  add(3, () => {
    box(1.2, 1.4, 0, 3.4, 1.6, 0.68, '#9c6b43');
    box(2.4, 1.8, 0.68, 0.6, 0.4, 0.03, '#d9dde2');
    box(3.6, 2.1, 0.68, 0.3, 0.3, 0.12, '#ffffff');
  });
  for (const x of [1.5, 3.6]) add(x + 1, () => {
    box(x, 0.8, 0, 0.5, 0.45, 0.42, '#c94d6d');
    box(x, 0.62, 0.42, 0.5, 0.12, 0.45, '#c94d6d');
  });
  add(3.6, () => {
    if (s.talks > 0) {
      const guest: OfficePerson = { id: 'guest', name: 'Guest', role: '', kind: 'member', floor: s.floor, state: 'working', bubble: null, detail: '', href: null, isYou: false, slug: null, paused: false };
      const h = person(2.55, 0.85, 0.42, guest, '+y', true);
      tags.push(() => bubble(s.floor === 'g' ? `In talks · ${s.talks}` : `College talks · ${s.talks}`, [h[0], h[1] - 6], 'work'));
    }
    box(2.45, 0.62, 0.42, 0.5, 0.12, 0.45, '#c94d6d');
  });
  for (const x of [1.5, 2.6, 3.7]) add(x + 3.6, () => box(x, 3.2, 0, 0.5, 0.45, 0.42, '#c94d6d'));
  add(5.5, () => box(0, 4.8, 0, 5, 0.08, 1.3, '', true));
  add(9, () => box(6, 0, 0, 0.08, 4.8, 1.3, '', true));
  add(14.6, () => box(13, 0, 0, 0.08, 3.2, 1.3, '', true));
  add(18.4, () => box(13, 4.8, 0, 0.08, 1.6, 1.3, '', true));
  add(21.6, () => box(13, 7.9, 0, 0.08, 1.9, 1.3, '', true));
  add(23.6, () => box(13, 9.8, 0, 0.08, 1.6, 1.3, '', true));
  add(26.5, () => box(13, 13, 0, 0.08, 1, 1.3, '', true));
  add(18.5, () => box(13, 4.8, 0, 5, 0.08, 1.3, '', true));
  add(23.5, () => box(13, 9.8, 0, 5, 0.08, 1.3, '', true));

  add(15, () => {
    box(13.4, 0.25, 0, 3.6, 0.7, 0.9, '#ece6dc');
    box(13.4, 0.25, 0.9, 3.6, 0.7, 0.06, '#8b8f96');
    box(14, 0.35, 0.96, 0.4, 0.4, 0.45, '#2f3038');
    box(15.2, 0.4, 0.96, 0.2, 0.2, 0.18, '#ffffff');
  });
  add(18.6, () => {
    box(17.2, 0.3, 0, 0.7, 0.7, 1.9, '#dfe6ea');
    fy(17.3, 17.35, 1.0, 0.9, 1.5, '#9aa3ad');
  });
  add(18.4, () => {
    box(15.2, 2.3, 0, 1.3, 0.8, 0.75, '#c99a63');
    box(15.6, 2.5, 0.75, 0.16, 0.16, 0.2, '#E4572E');
  });
  PANTRY_SEATS.forEach(([sx, sy], i) => {
    add(sx + sy + 0.6, () => {
      box(sx - 0.03, sy - 0.05, 0, 0.42, 0.42, 0.45, '#E4572E');
      const a = seatedAt('pantry', i);
      if (!a) return;
      const h = person(sx, sy, 0.45, a.person, '-y', true);
      label(a, h, a.person.paused);
    });
  });

  add(20.6, () => {
    const a = seatedAt('cabin');
    if (a) label(a, person(15.55, 5.6, 0.45, a.person, '+y', true));
    box(15.45, 5.35, 0.45, 0.55, 0.12, 0.6, '#2d3240');
  });
  add(21.6, () => {
    box(14.4, 6.25, 0, 2.6, 1.1, 0.75, '#7b5537');
    box(15.4, 6.4, 0.75, 0.8, 0.1, 0.5, '#2d3038');
    box(16.5, 6.5, 0.75, 0.3, 0.4, 0.05, '#ffffff');
  });
  add(23.2, () => plant(17.4, 5.4));
  add(22, () => plant(13.4, 8.8));
  add(24.4, () => {
    box(13.5, 10.0, 0, 3.8, 0.5, 1.5, '#a87b52');
    for (let i = 0; i < 3; i++) {
      box(13.5, 10.0, 0.45 + i * 0.45, 3.8, 0.5, 0.04, '#7a5636');
      for (let k = 0; k < 6; k++) fy(13.7 + k * 0.6, 14.05 + k * 0.6, 10.5, 0.12 + i * 0.45, 0.36 + i * 0.45, ['#ffffff', '#f0b54a', '#bfe0f0'][(k + i) % 3]);
    }
  });
  add(28.3, () => {
    box(15.2, 12.2, 0, 1.3, 0.9, 0.55, '#f0b54a');
    if (s.ready > 0) {
      box(15.35, 12.32, 0.55, 1.0, 0.66, Math.min(0.3, 0.06 + s.ready * 0.01), '#ffffff');
    }
  });
  add(13, () => plant(0.3, 13.2));
  add(13.1, () => plant(12.5, 0.5));
  add(25.9, () => plant(12.5, 13.4));
  add(7, () => plant(6.4, 0.4));
  // Water cooler by the lift: a favourite spot for a chat.
  add(7.9, () => {
    box(6.3, 1.25, 0, 0.42, 0.42, 0.75, '#dfe6ea');
    box(6.36, 1.31, 0.75, 0.3, 0.3, 0.32, '#9fd4ef');
  });

  DESKS.forEach(([dx, dy], i) => {
    const owner = deskOwner(i);
    const sitter = seatedAt('desk', i);
    add(dx + dy + 1.55, () => {
      box(dx, dy, 0, 2.0, 1.1, 0.72, '#c99a63');
      box(dx + 0.6, dy + 0.2, 0.72, 0.8, 0.1, 0.52, '#2d3038');
      const failed = owner?.person.kind === 'agent' && owner.person.state === 'failed' && !owner.working;
      const glow = failed ? (fr ? '#ff9a9a' : '#e45b5b') : fr && sitter ? '#9fe6ff' : '#62c6ee';
      fy(dx + 0.66, dx + 1.34, dy + 0.3, 0.78, 1.18, owner ? glow : '#1d2229');
      box(dx + 0.85, dy + 0.25, 0.72, 0.3, 0.25, 0.04, '#2d3038');
      box(dx + 0.62, dy + 0.55, 0.72, 0.75, 0.22, 0.03, '#efefef');
      box(dx + 1.6, dy + 0.45, 0.72, 0.14, 0.14, 0.16, th.acc);
    });
    add(dx + dy + 2.8, () => {
      box(dx + 0.95, dy + 1.6, 0, 0.1, 0.1, 0.35, '#222');
      box(dx + 0.65, dy + 1.35, 0.35, 0.7, 0.6, 0.1, '#3b4252');
      const h = sitter ? person(dx + 0.83, dy + 1.42, 0.45, sitter.person, '-y', true) : null;
      box(dx + 0.65, dy + 1.9, 0.45, 0.7, 0.1, 0.55, '#3b4252');
      if (sitter && h) label(sitter, [h[0], h[1] + 6]);
    });
  });

  // Everyone on their feet: walking, standing at the board, chatting by the cooler.
  for (const a of s.actors) {
    if (a.seat && !a.walking) continue;
    add(a.x + a.y + 0.45, () => {
      const h = person(a.x, a.y, 0, a.person, a.face, false, a.walking || a.spd > 0 ? { phase: a.phase, amt: Math.min(1, 0.35 + a.spd / 1.35) } : undefined);
      if (a.carry) box(a.x + 0.38, a.y + 0.05, 0.75, 0.2, 0.26, 0.14, '#ffffff');
      label(a, h);
    });
  }

  items.sort((a, b) => a.k - b.k).forEach((o) => o.fn());

  const lab = 'rgba(40,36,44,0.72)';
  pill('Meeting room', P(4.9, 4.3, 0), lab, { href: s.talksHref });
  pill('Pantry', P(17.4, 4.2, 0), lab);
  pill(s.floor === 'g' ? 'Manager cabin' : 'Program head', P(17.3, 9.3, 0), lab);
  pill(`Mail room · ${s.ready} ready`, P(17.2, 13.6, 0), '#BA7517', { href: s.readyHref });
  if (s.otherFloor) pill(`Lift · ${s.otherFloor}`, P(8.5, 0, 2.75), lab, { action: 'lift' });
  pill('Pipeline', P(11.4, 0, 2.05), lab, { href: s.floor === 'g' ? '/leads' : '/colleges' });
  tags.forEach((g) => g());

  c.font = font(700, 13);
  const floorName = th.label;
  const lw = c.measureText(floorName).width + 22;
  rr(10, 10, lw, 26, 13);
  c.fillStyle = th.acc;
  c.fill();
  c.fillStyle = '#ffffff';
  c.textAlign = 'left';
  c.fillText(floorName, 21, 27);

  // Lift doors close and open when changing floors.
  if (s.liftT != null && s.liftT >= 0 && s.liftT < 0.9) {
    const k = s.liftT < 0.45 ? s.liftT / 0.45 : 1 - (s.liftT - 0.45) / 0.45;
    const half = (LW / 2) * Math.min(1, k);
    c.fillStyle = '#9aa3ad';
    c.fillRect(0, 0, half, LH);
    c.fillRect(LW - half, 0, half, LH);
    c.fillStyle = '#cdd5dc';
    c.fillRect(half - 6, 0, 6, LH);
    c.fillRect(LW - half, 0, 6, LH);
  }
  return hits;
}
