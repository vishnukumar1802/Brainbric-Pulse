// Draws the isometric office on a 2D canvas. Plain functions, no React: the OfficeView component calls drawOffice
// every animation frame and gets back the clickable areas (name tags and room labels).
import type { FloorKey, OfficePerson } from '@/lib/office';

export const LW = 900;
export const LH = 540;
const S = 26;
const OX = 400;
const OY = 104;

export type Hit = { x: number; y: number; w: number; h: number; href?: string; action?: 'lift'; id?: string };

export type SceneInput = {
  floor: FloorKey;
  people: OfficePerson[];
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
function hash(s: string): number {
  let h = 7;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}
function looks(id: string) {
  const h = hash(id);
  return { hair: HAIR[h % HAIR.length], shirt: SHIRTS[(h >>> 4) % SHIRTS.length] };
}

const DESKS: [number, number][] = [
  [1.0, 6], [3.8, 6], [6.6, 6], [9.4, 6],
  [1.0, 10], [3.8, 10], [6.6, 10], [9.4, 10],
];
const PANTRY_SEATS: [number, number][] = [[15.58, 3.4], [16.35, 3.4], [14.8, 3.4]];

type Ctx = CanvasRenderingContext2D;
type Pt = [number, number];

function P(x: number, y: number, z: number): Pt {
  return [OX + (x - y) * S, OY + ((x + y) * S) / 2 - z * S];
}
function shade(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${((n >> 16) * f) | 0},${(((n >> 8) & 255) * f) | 0},${((n & 255) * f) | 0})`;
}

function pathPos(pts: Pt[], t: number, speed: number, pause: number) {
  const seg: number[] = [];
  let L = 0;
  for (let i = 1; i < pts.length; i++) {
    const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    seg.push(l);
    L += l;
  }
  const tt = L / speed;
  const m = t % (2 * tt + 2 * pause);
  let d: number;
  let st: 'start' | 'move' | 'end' = 'move';
  if (m < pause) {
    d = 0;
    st = 'start';
  } else if (m < pause + tt) d = (m - pause) * speed;
  else if (m < 2 * pause + tt) {
    d = L;
    st = 'end';
  } else d = L - (m - 2 * pause - tt) * speed;
  let i = 0;
  while (i < seg.length - 1 && d > seg[i]) {
    d -= seg[i];
    i++;
  }
  const a = pts[i];
  const b = pts[i + 1];
  const k = seg[i] ? Math.min(1, d / seg[i]) : 0;
  return { x: a[0] + (b[0] - a[0]) * k, y: a[1] + (b[1] - a[1]) * k, st };
}

export function drawOffice(c: Ctx, scale: number, s: SceneInput): Hit[] {
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
  const bubble = (text: string, p: Pt, danger = false) => {
    c.font = font(600, 12);
    const w = c.measureText(text).width + 18;
    const x = p[0] - w / 2;
    const y = p[1] - 28;
    c.fillStyle = 'rgba(0,0,0,0.14)';
    rr(x + 1, y + 2, w, 22, 11);
    c.fill();
    rr(x, y, w, 22, 11);
    c.fillStyle = danger ? '#FFEDEA' : '#ffffff';
    c.fill();
    c.beginPath();
    c.moveTo(p[0] - 5, y + 21);
    c.lineTo(p[0], y + 27);
    c.lineTo(p[0] + 5, y + 21);
    c.fill();
    c.fillStyle = danger ? '#831C1E' : '#1d1a1e';
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
  const person = (x: number, y: number, z: number, p: OfficePerson, ph: number, seated: boolean, front: boolean): Pt => {
    const lk = looks(p.id);
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
    const o = ph ? 0.06 : -0.06;
    if (!seated) {
      box(x + 0.04, y + 0.06 + o, 0, 0.12, 0.12, 0.45, '#2f3747');
      box(x + 0.19, y + 0.06 - o, 0, 0.12, 0.12, 0.45, '#2f3747');
    }
    const b = z + (seated ? 0 : 0.45);
    box(x, y, b, 0.34, 0.26, 0.5, lk.shirt);
    box(x - 0.07, y + 0.05, b + 0.12, 0.07, 0.16, 0.34, lk.shirt);
    box(x + 0.34, y + 0.05, b + 0.12, 0.07, 0.16, 0.34, lk.shirt);
    const hz = b + 0.5;
    box(x + 0.03, y, hz, 0.28, 0.26, 0.28, '#f1c7a0');
    box(x + 0.01, y - 0.02, hz + 0.22, 0.32, 0.3, 0.1, lk.hair);
    if (front) {
      fy(x + 0.08, x + 0.12, y + 0.26, hz + 0.12, hz + 0.17, '#2a2a2a');
      fy(x + 0.21, x + 0.25, y + 0.26, hz + 0.12, hz + 0.17, '#2a2a2a');
    } else box(x + 0.02, y + 0.2, hz + 0.04, 0.3, 0.08, 0.2, lk.hair);
    return P(x + 0.17, y + 0.13, hz + 0.78);
  };
  // Name tags stay short so neighbours don't overlap; an agent without a given name shows the first word of its job.
  const tagText = (p: OfficePerson) => (p.name.length > 12 ? p.name.split(' ')[0] : p.name);
  const nameTag = (p: OfficePerson, at: Pt) => pill(tagText(p), at, personColor(p), { href: p.href ?? undefined, id: p.id });

  // Who sits where.
  const present = s.people.filter((p) => p.state !== 'away');
  const cabin = s.floor === 'g' ? present.find((p) => p.kind === 'admin' && p.isYou) ?? present.find((p) => p.kind === 'admin') : undefined;
  const pantry = present.filter((p) => p.state === 'paused').slice(0, PANTRY_SEATS.length);
  const desked = present.filter((p) => p !== cabin && p.state !== 'paused').sort((a, b) => Number(a.kind !== 'agent') - Number(b.kind !== 'agent')).slice(0, DESKS.length);

  c.setTransform(scale, 0, 0, scale, 0, 0);
  c.clearRect(0, 0, LW, LH);

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
  fy(8.3, 8.7, 0, 1.92, 2.06, fr ? '#ffcc4d' : '#d6a92a');
  fy(10.2, 12.6, 0, 0.8, 1.85, '#ffffff');
  [['#E4572E', 4], ['#EF9F27', 3], ['#378ADD', 2], ['#1D9E75', 2]].forEach(([col, n], i) => {
    for (let k = 0; k < (n as number); k++) fy(10.35 + i * 0.58, 10.75 + i * 0.58, 0, 1.55 - k * 0.17, 1.68 - k * 0.17, col as string);
  });

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
      const h = person(2.55, 0.85, 0.42, guest, 0, true, true);
      tags.push(() => bubble(s.floor === 'g' ? `In talks · ${s.talks}` : `College talks · ${s.talks}`, [h[0], h[1] - 6]));
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
      const p = pantry[i];
      if (!p) return;
      const h = person(sx, sy, 0.45, p, 0, true, false);
      tags.push(() => {
        nameTag(p, h);
        const k = s.t % 2;
        c.font = font(700, 14);
        c.fillStyle = '#6b6b8a';
        c.textAlign = 'left';
        c.globalAlpha = 1 - k / 2;
        c.fillText('z z', h[0] + 18, h[1] - 8 - k * 10);
        c.globalAlpha = 1;
        if (s.selected === p.id) bubble('Paused', [h[0], h[1] - 12]);
      });
    });
  });

  add(20.6, () => {
    if (cabin) {
      const h = person(15.55, 5.6, 0.45, cabin, 0, true, true);
      tags.push(() => {
        nameTag(cabin, h);
        if (cabin.bubble && (s.selected === cabin.id || s.t % 14 < 4)) bubble(cabin.bubble, [h[0], h[1] - 8]);
      });
    }
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
  add(17, () => plant(12.1, 5.0));
  add(25.5, () => plant(12.2, 13.0));
  add(7, () => plant(6.4, 0.4));

  DESKS.forEach(([dx, dy], i) => {
    const p = desked[i];
    const walking = p?.state === 'walking';
    const pts: Pt[] =
      dy < 8
        ? [[dx + 0.83, dy + 2.3], [dx + 0.83, 9], [12.3, 9], [12.3, 12.2], [14.6, 12.4]]
        : [[dx + 0.83, dy + 2.6], [12.3, dy + 2.6], [12.3, 12.2], [14.6, 12.4]];
    const pos = walking ? pathPos(pts, s.t + i * 2.3, 1.7, 2.4) : null;
    const seated = p && (!pos || pos.st === 'start') ? p : null;
    const on = Boolean(p);
    add(dx + dy + 1.55, () => {
      box(dx, dy, 0, 2.0, 1.1, 0.72, '#c99a63');
      box(dx + 0.6, dy + 0.2, 0.72, 0.8, 0.1, 0.52, '#2d3038');
      const glow = p?.state === 'failed' ? (fr ? '#ff9a9a' : '#e45b5b') : fr && seated ? '#9fe6ff' : '#62c6ee';
      fy(dx + 0.66, dx + 1.34, dy + 0.3, 0.78, 1.18, on ? glow : '#1d2229');
      box(dx + 0.85, dy + 0.25, 0.72, 0.3, 0.25, 0.04, '#2d3038');
      box(dx + 0.62, dy + 0.55, 0.72, 0.75, 0.22, 0.03, '#efefef');
      box(dx + 1.6, dy + 0.45, 0.72, 0.14, 0.14, 0.16, th.acc);
    });
    add(dx + dy + 2.8, () => {
      box(dx + 0.95, dy + 1.6, 0, 0.1, 0.1, 0.35, '#222');
      box(dx + 0.65, dy + 1.35, 0.35, 0.7, 0.6, 0.1, '#3b4252');
      let h: Pt | null = null;
      if (seated) h = person(dx + 0.83, dy + 1.42, 0.45, seated, 0, true, false);
      box(dx + 0.65, dy + 1.9, 0.45, 0.7, 0.1, 0.55, '#3b4252');
      if (seated && h) {
        const at: Pt = [h[0], h[1] + 6];
        tags.push(() => {
          nameTag(seated, at);
          const show = seated.state === 'failed' || s.selected === seated.id || (s.t + i * 3.1) % 12 < 3.5;
          if (seated.bubble && show) bubble(seated.bubble, [h![0], h![1] - 8], seated.state === 'failed');
        });
      }
    });
    if (p && pos && pos.st !== 'start') {
      add(pos.x + pos.y + 0.4, () => {
        const h = person(pos.x, pos.y, 0, p, pos.st === 'move' ? fr : 0, false, true);
        if (pos.st === 'move') box(pos.x + 0.38, pos.y + 0.05, 0.75, 0.2, 0.26, 0.14, '#ffffff');
        tags.push(() => {
          nameTag(p, h);
          if (pos.st === 'end' && p.bubble) bubble(p.bubble, [h[0], h[1] - 12]);
        });
      });
    }
  });

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
  const label = th.label;
  const lw = c.measureText(label).width + 22;
  rr(10, 10, lw, 26, 13);
  c.fillStyle = th.acc;
  c.fill();
  c.fillStyle = '#ffffff';
  c.textAlign = 'left';
  c.fillText(label, 21, 27);

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
