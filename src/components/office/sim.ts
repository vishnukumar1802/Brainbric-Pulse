// The people in the office and what they are doing, moment to moment.
// Real work comes from the agents' live steps (started, found, drafted, ...). When an agent has nothing to do it
// lives a little office life: desk time, coffee, chats with a colleague, the window, the pipeline board.
import type { OfficePerson } from '@/lib/office';

export type Pt = [number, number];
export type BubbleKind = 'work' | 'chat' | 'alert';
export type Bubble = { text: string; kind: BubbleKind; until: number };

export type LiveStepEvent = { id: number; agent: string; step: string; text: string | null; created_at: string };

// ---------- The walking map ----------

export const DESKS: Pt[] = [
  [1.0, 6], [3.8, 6], [6.6, 6], [9.4, 6],
  [1.0, 10], [3.8, 10], [6.6, 10], [9.4, 10],
];
export const PANTRY_SEATS: Pt[] = [[15.58, 3.4], [16.35, 3.4], [14.8, 3.4]];
export const CABIN_SEAT: Pt = [15.55, 5.6];

const N: Record<string, Pt> = {
  c0: [0.55, 5.2], c1: [5.5, 5.2], c2: [8.5, 5.2], c3: [11.4, 5.2], e0: [12.3, 5.2],
  w3: [0.55, 7.2], w1: [0.55, 9.0], w2: [0.55, 12.6],
  p0: [12.3, 4.0], ec: [12.3, 7.1], e1: [12.3, 9.0], em: [12.3, 12.2], e2: [12.3, 12.6],
  pi: [13.6, 4.15], coffee: [14.15, 1.35], chatP1: [13.75, 2.1], chatP2: [14.45, 2.45],
  mi: [5.5, 4.0], ms1: [5.1, 2.0], ms2: [5.1, 2.9],
  bo: [11.4, 1.05], bo2: [10.6, 1.5], li: [8.5, 1.05], co: [7.0, 1.6], co2: [7.65, 2.0],
  ci: [13.8, 7.1], ca: [13.8, 5.4], cs: [15.0, 5.35], cv: [14.3, 8.6],
  mm: [14.6, 12.4], mm2: [14.4, 13.2],
};
const E: [string, string][] = [
  ['c0', 'c1'], ['c1', 'c2'], ['c2', 'c3'], ['c3', 'e0'],
  ['c0', 'w3'], ['w3', 'w1'], ['w1', 'w2'],
  ['p0', 'e0'], ['e0', 'ec'], ['ec', 'e1'], ['e1', 'em'], ['em', 'e2'],
  ['p0', 'pi'], ['pi', 'coffee'], ['pi', 'chatP1'], ['pi', 'chatP2'], ['chatP1', 'coffee'],
  ['c1', 'mi'], ['mi', 'ms1'], ['mi', 'ms2'],
  ['c3', 'bo'], ['c3', 'bo2'], ['c2', 'li'], ['c2', 'co'], ['c2', 'co2'],
  ['ec', 'ci'], ['ci', 'ca'], ['ca', 'cs'], ['ci', 'cv'],
  ['em', 'mm'], ['mm', 'mm2'],
];
DESKS.forEach(([dx, dy], i) => {
  const x = dx + 0.83;
  if (dy < 8) {
    N[`j${i}`] = [x, 9.0];
    N[`s${i}`] = [x, 8.4];
    E.push([`s${i}`, `j${i}`]);
  } else {
    N[`j${i}`] = [x, 12.6];
    N[`s${i}`] = [x, 12.6];
  }
});
// Chain the corridor junctions in order along each row.
for (const [row, ends] of [[[0, 1, 2, 3], ['w1', 'e1']], [[4, 5, 6, 7], ['w2', 'e2']]] as const) {
  const ids = [ends[0], ...row.map((i) => `j${i}`), ends[1]];
  for (let k = 1; k < ids.length; k++) E.push([ids[k - 1], ids[k]]);
}
PANTRY_SEATS.forEach(([sx], k) => {
  N[`ps${k}`] = [sx, 4.15];
  E.push(['pi', `ps${k}`]);
});

const ADJ: Record<string, { to: string; d: number }[]> = {};
for (const [a, b] of E) {
  const d = Math.hypot(N[a][0] - N[b][0], N[a][1] - N[b][1]);
  (ADJ[a] ??= []).push({ to: b, d });
  (ADJ[b] ??= []).push({ to: a, d });
}

function route(from: string, to: string): string[] {
  if (from === to) return [to];
  const dist: Record<string, number> = { [from]: 0 };
  const prev: Record<string, string> = {};
  const open = new Set([from]);
  while (open.size) {
    let cur = '';
    let best = Infinity;
    for (const n of open) if (dist[n] < best) ((best = dist[n]), (cur = n));
    open.delete(cur);
    if (cur === to) break;
    for (const { to: nx, d } of ADJ[cur] ?? []) {
      const nd = best + d;
      if (nd < (dist[nx] ?? Infinity)) {
        dist[nx] = nd;
        prev[nx] = cur;
        open.add(nx);
      }
    }
  }
  if (!(to in prev)) return [to];
  const path = [to];
  while (path[0] !== from) path.unshift(prev[path[0]]);
  return path.slice(1);
}

// ---------- People ----------

type Seat = { kind: 'desk'; i: number } | { kind: 'pantry'; i: number } | { kind: 'cabin' };

type Job = (
  | { kind: 'walk'; to: string; carry?: boolean }
  | { kind: 'sit'; seat: Seat; dur: number; bubble?: Omit<Bubble, 'until'> }
  | { kind: 'stand'; dur: number; bubble?: Omit<Bubble, 'until'>; back?: boolean }
  | { kind: 'chat'; with: string; dur: number; first: boolean }
) & {
  /** From a real step the agent reported; everything else is office life and gives way to real work. */
  real?: boolean;
};

export type Actor = {
  person: OfficePerson;
  x: number;
  y: number;
  node: string;
  seat: Seat | null;
  walking: boolean;
  front: boolean;
  carry: boolean;
  bubble: Bubble | null;
  jobs: Job[];
  busyUntil: number;
  /** Running a real job from the agent's live steps (idle life waits). */
  working: boolean;
  lastWorkText: string | null;
  home: Seat | null;
  homeNode: string;
  chatting: string | null;
  path: Pt[];
  /** The current activity came from a real step. */
  onReal: boolean;
};

const GOSSIP = [
  'Did you see that new SaaS lead?',
  'Coimbatore is busy today',
  'Who took my coffee mug?',
  'That proposal looked sharp',
  'Lunch at 1?',
  'My inbox never ends',
  'Another clinic wants an app',
  'Let us close one more deal',
  'Nice work on that draft',
  'Any weekend plans?',
  'Did the client reply yet?',
  'This coffee is strong',
  'The lift is slow again',
  'Colleges are opening up',
  'Big week for the pipeline',
  'I found a great lead earlier',
];
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const rand = (a: number, b: number) => a + Math.random() * (b - a);

function seatNode(seat: Seat): string {
  if (seat.kind === 'desk') return `s${seat.i}`;
  if (seat.kind === 'pantry') return `ps${seat.i}`;
  return 'cs';
}
export function seatPos(seat: Seat): Pt {
  if (seat.kind === 'desk') return [DESKS[seat.i][0] + 0.83, DESKS[seat.i][1] + 1.42];
  if (seat.kind === 'pantry') return PANTRY_SEATS[seat.i];
  return CABIN_SEAT;
}
const sameSeat = (a: Seat | null, b: Seat | null) => Boolean(a && b && a.kind === b.kind && (a.kind === 'cabin' || (a as { i: number }).i === (b as { i: number }).i));

const SPEED = 1.6;

export class OfficeSim {
  actors: Actor[] = [];
  private now = 0;

  /** Match the cast to the latest data: new people walk in, people who left disappear, homes are kept. */
  sync(people: OfficePerson[], isGround: boolean) {
    const present = people.filter((p) => p.state !== 'away');
    const cabinOwner = isGround ? present.find((p) => p.kind === 'admin' && p.isYou) ?? present.find((p) => p.kind === 'admin') : undefined;
    const ordered = present.filter((p) => p !== cabinOwner).sort((a, b) => Number(a.kind !== 'agent') - Number(b.kind !== 'agent'));
    const keep = new Map(this.actors.map((a) => [a.person.id, a]));
    const next: Actor[] = [];
    const homeFor = (p: OfficePerson): Seat | null => {
      if (p === cabinOwner) return { kind: 'cabin' };
      const i = ordered.indexOf(p);
      return i >= 0 && i < DESKS.length ? { kind: 'desk', i } : null;
    };
    for (const p of present) {
      const home = homeFor(p);
      const old = keep.get(p.id);
      if (old) {
        old.person = p;
        if (!sameSeat(old.home, home)) {
          old.home = home;
          old.homeNode = home ? seatNode(home) : 'c2';
        }
        next.push(old);
        continue;
      }
      const start = home ?? { kind: 'desk' as const, i: 0 };
      const [x, y] = home ? seatPos(start) : N.c2;
      next.push({
        person: p,
        x,
        y,
        node: home ? seatNode(start) : 'c2',
        seat: home,
        walking: false,
        front: false,
        carry: false,
        bubble: null,
        jobs: [],
        busyUntil: this.now + rand(1, 6),
        working: false,
        lastWorkText: null,
        home,
        homeNode: home ? seatNode(home) : 'c2',
        chatting: null,
        path: [],
        onReal: false,
      });
    }
    this.actors = next;
  }

  /** A real step from an agent. `replay` false means it is history: set the state without walking it out. */
  push(e: LiveStepEvent, replay: boolean) {
    const a = this.actors.find((x) => x.person.slug === e.agent);
    if (!a || a.person.paused) return;
    const text = e.text?.trim() || null;
    if (!replay) {
      if (e.step === 'finished' || e.step === 'failed') {
        a.working = false;
        a.lastWorkText = null;
      } else {
        a.working = true;
        a.lastWorkText = text ?? a.lastWorkText;
      }
      return;
    }
    this.breakChat(a);
    // Real work comes first: drop any office-life plans and get up now (a walk in progress finishes its leg).
    a.jobs = a.jobs.filter((j) => j.real);
    if (!a.onReal) a.busyUntil = 0;
    if (a.jobs.length > 24) a.jobs = a.jobs.slice(-12);
    const home = a.home;
    const before = a.jobs.length;
    const sitHome = (bubble?: Omit<Bubble, 'until'>, dur = 6): Job[] => (home ? [{ kind: 'walk', to: seatNode(home) }, { kind: 'sit', seat: home, dur, bubble }] : [{ kind: 'stand', dur, bubble }]);
    a.working = e.step !== 'finished' && e.step !== 'failed';
    switch (e.step) {
      case 'started':
        a.jobs.push(...sitHome({ text: 'Starting my run', kind: 'work' }, 3));
        break;
      case 'searching':
      case 'writing':
      case 'note':
        a.lastWorkText = text;
        a.jobs.push(...sitHome(text ? { text: short(text), kind: 'work' } : undefined, 5));
        break;
      case 'found':
        a.jobs.push({ kind: 'walk', to: Math.random() < 0.5 ? 'bo' : 'bo2' }, { kind: 'stand', dur: 2.6, back: true, bubble: { text: text ? `Found: ${short(text, 22)}` : 'New lead found', kind: 'work' } });
        break;
      case 'drafted':
        a.jobs.push({ kind: 'walk', to: 'mm', carry: true }, { kind: 'stand', dur: 2.2, bubble: { text: text ? `Draft: ${short(text, 22)}` : 'Draft ready', kind: 'work' } });
        break;
      case 'finished':
        a.lastWorkText = null;
        a.jobs.push(...sitHome({ text: text ? `Done: ${short(text, 26)}` : 'Run finished', kind: 'work' }, 4));
        break;
      case 'failed':
        a.lastWorkText = null;
        a.jobs.push(...sitHome({ text: 'My run failed', kind: 'alert' }, 8));
        break;
    }
    for (let k = before; k < a.jobs.length; k++) a.jobs[k].real = true;
  }

  private breakChat(a: Actor) {
    if (!a.chatting) return;
    const b = this.actors.find((x) => x.person.id === a.chatting);
    a.chatting = null;
    a.jobs = a.jobs.filter((j) => j.kind !== 'chat');
    if (b) {
      b.chatting = null;
      b.jobs = b.jobs.filter((j) => j.kind !== 'chat');
    }
  }

  private idle(a: Actor) {
    const p = a.person;
    // Paused agents rest in the pantry.
    if (p.kind === 'agent' && p.paused) {
      const taken = new Set(this.actors.filter((x) => x !== a && x.seat?.kind === 'pantry').map((x) => (x.seat as { i: number }).i));
      const free = [0, 1, 2].find((i) => !taken.has(i));
      if (free == null) {
        a.jobs.push({ kind: 'walk', to: 'coffee' }, { kind: 'stand', dur: 12 });
      } else {
        const seat: Seat = { kind: 'pantry', i: free };
        a.jobs.push({ kind: 'walk', to: seatNode(seat) }, { kind: 'sit', seat, dur: 30 });
      }
      return;
    }
    // Mid-run with nothing queued: at the desk, typing.
    if (a.working) {
      a.jobs.push(...(a.home ? [{ kind: 'walk', to: seatNode(a.home) } as Job, { kind: 'sit', seat: a.home, dur: 8, bubble: a.lastWorkText ? { text: short(a.lastWorkText), kind: 'work' as const } : undefined } as Job] : [{ kind: 'stand', dur: 6 } as Job]));
      return;
    }
    if (p.kind === 'agent' && p.state === 'failed' && Math.random() < 0.5) {
      a.jobs.push(...(a.home ? [{ kind: 'walk', to: seatNode(a.home) } as Job, { kind: 'sit', seat: a.home, dur: 8, bubble: { text: 'My last run failed', kind: 'alert' as const } } as Job] : []));
      return;
    }
    const deskBias = p.kind === 'agent' ? 0.42 : 0.7;
    const r = Math.random();
    if (r < deskBias && a.home) {
      a.jobs.push({ kind: 'walk', to: seatNode(a.home) }, { kind: 'sit', seat: a.home, dur: rand(8, 18) });
      return;
    }
    if (r < deskBias + 0.2 && this.startChat(a)) return;
    const choices: Job[][] = [
      [{ kind: 'walk', to: 'coffee' }, { kind: 'stand', dur: rand(4, 7), back: true, bubble: { text: 'Coffee break', kind: 'chat' } }],
      [{ kind: 'walk', to: 'w3' }, { kind: 'stand', dur: rand(4, 7), back: true }],
      [{ kind: 'walk', to: 'bo' }, { kind: 'stand', dur: rand(3, 5), back: true, bubble: { text: 'Checking the pipeline', kind: 'chat' } }],
      [{ kind: 'walk', to: 'li' }, { kind: 'stand', dur: rand(2, 4), back: true }],
    ];
    const other = pick(this.actors.filter((x) => x !== a && x.home?.kind === 'desk'));
    if (other?.home) {
      const i = (other.home as { i: number }).i;
      choices.push([{ kind: 'walk', to: `j${i}` }, { kind: 'stand', dur: rand(3, 6), bubble: { text: pick(GOSSIP), kind: 'chat' } }]);
    }
    a.jobs.push(...pick(choices));
  }

  private startChat(a: Actor): boolean {
    const free = this.actors.filter((x) => x !== a && !x.chatting && !x.working && !(x.person.kind === 'agent' && x.person.paused) && x.jobs.length === 0);
    const b = pick(free);
    if (!b) return false;
    const spots = pick([
      ['chatP1', 'chatP2'],
      ['co', 'co2'],
      ['bo', 'bo2'],
      ['ms1', 'ms2'],
    ]);
    const dur = rand(8, 13);
    a.chatting = b.person.id;
    b.chatting = a.person.id;
    a.jobs.push({ kind: 'walk', to: spots[0] }, { kind: 'chat', with: b.person.id, dur, first: true });
    b.jobs.push({ kind: 'walk', to: spots[1] }, { kind: 'chat', with: a.person.id, dur, first: false });
    b.busyUntil = 0;
    return true;
  }

  step(dt: number, now: number) {
    this.now = now;
    for (const a of this.actors) {
      if (a.bubble && a.bubble.until < now) a.bubble = null;
      if (a.walking) {
        // A real step arrived mid-stroll: stop at the next corner and head off from there.
        if (!a.onReal && a.jobs[0]?.real && a.path.length > 1) {
          a.path = a.path.slice(0, 1);
          a.node = nearestNode(a.path[0]);
        }
        this.walk(a, dt);
        continue;
      }
      if (now < a.busyUntil) {
        this.chatTalk(a, now);
        continue;
      }
      const job = a.jobs.shift();
      if (!job) {
        if (a.chatting) this.breakChat(a);
        this.idle(a);
        continue;
      }
      this.begin(a, job, now);
    }
  }

  private begin(a: Actor, job: Job, now: number) {
    a.onReal = Boolean(job.real);
    switch (job.kind) {
      case 'walk': {
        // Already sitting there: stay seated. Already standing there: nothing to do.
        if (a.seat ? seatNode(a.seat) === job.to : a.node === job.to) return;
        const from = a.node;
        const wasSeated = Boolean(a.seat);
        a.seat = null;
        const nodes = route(from, job.to);
        // From a chair, first step out to the spot in front of it.
        a.path = [...(wasSeated ? [N[from]] : []), ...nodes.map((n) => N[n])];
        a.node = job.to;
        a.walking = a.path.length > 0;
        a.carry = Boolean(job.carry);
        return;
      }
      case 'sit':
        a.seat = job.seat;
        [a.x, a.y] = seatPos(job.seat);
        a.front = job.seat.kind === 'cabin';
        a.busyUntil = now + job.dur;
        if (job.bubble) a.bubble = { ...job.bubble, until: now + Math.min(job.dur, 6) };
        return;
      case 'stand':
        a.front = !job.back;
        a.busyUntil = now + job.dur;
        a.carry = false;
        if (job.bubble) a.bubble = { ...job.bubble, until: now + job.dur };
        return;
      case 'chat': {
        const b = this.actors.find((x) => x.person.id === job.with);
        if (!b || b.chatting !== a.person.id) {
          a.chatting = null;
          return;
        }
        a.front = job.first;
        a.busyUntil = now + job.dur;
        if (job.first) a.bubble = { text: pick(GOSSIP), kind: 'chat', until: now + 2.6 };
        return;
      }
    }
  }

  /** Two people chatting take turns with a line each. */
  private chatTalk(a: Actor, now: number) {
    if (!a.chatting || a.bubble) return;
    const b = this.actors.find((x) => x.person.id === a.chatting);
    if (!b || b.walking || a.walking) return;
    if (!b.bubble && Math.random() < 0.02) a.bubble = { text: pick(GOSSIP), kind: 'chat', until: now + 2.6 };
  }

  private walk(a: Actor, dt: number) {
    let left = dt * SPEED;
    while (left > 0 && a.path.length) {
      const [tx, ty] = a.path[0];
      const dx = tx - a.x;
      const dy = ty - a.y;
      const d = Math.hypot(dx, dy);
      if (d <= left) {
        a.x = tx;
        a.y = ty;
        a.path.shift();
        left -= d;
      } else {
        a.x += (dx / d) * left;
        a.y += (dy / d) * left;
        a.front = dx + dy > 0.001;
        left = 0;
      }
    }
    if (!a.path.length) {
      a.walking = false;
      if (!a.jobs.length || a.jobs[0].kind === 'walk') a.carry = false;
    }
  }
}

function nearestNode([x, y]: Pt): string {
  let best = 'c2';
  let d = Infinity;
  for (const [id, [nx, ny]] of Object.entries(N)) {
    const dd = Math.hypot(nx - x, ny - y);
    if (dd < d) ((d = dd), (best = id));
  }
  return best;
}

function short(s: string, n = 30): string {
  const t = s.replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t;
}
