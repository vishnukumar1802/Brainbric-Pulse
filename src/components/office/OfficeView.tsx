'use client';

import { Box as BoxIcon, Maximize2, Minimize2, Square } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import type { FloorKey, OfficeData, OfficePerson } from '@/lib/office';
import { AgentFace } from '../AgentFace';
import { AgentToggle, AllAgentsToggle } from '../AgentToggle';
import dynamic from 'next/dynamic';
import { drawOffice, LH, LW, personColor, type Hit } from './scene';
import { HQ } from './hqLayout';
import { OfficeSim, type LiveStepEvent } from './sim';

const FLOOR_LABEL: Record<FloorKey, string> = { g: 'Ground floor', f: 'First floor' };
const fmt = (n: number) => n.toLocaleString('en-IN');

function Tile({ label, value, hint, bar }: { label: string; value: string; hint: string; bar?: number }) {
  return (
    <div className="card min-w-0 px-4 py-3">
      <div className="text-xs font-medium text-ink-500">{label}</div>
      <div className="num mt-0.5 text-xl font-semibold tracking-[-0.01em] text-ink-950">{value}</div>
      {bar != null && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-paper-rule">
          <div className="h-full rounded-full bg-gradient-to-r from-flame-amber to-flame-red" style={{ width: `${Math.max(2, Math.min(100, bar))}%` }} />
        </div>
      )}
      <div className="mt-1 text-xs text-ink-400">{hint}</div>
    </div>
  );
}

function stateText(p: OfficePerson, live?: string) {
  if (live && !p.paused) return <span className="block truncate text-[11px] font-semibold text-flame-ink">● {live}</span>;
  const tone = p.state === 'failed' ? 'text-[#C4242A]' : p.state === 'walking' ? 'text-flame-ink' : p.state === 'working' && p.kind === 'agent' ? 'text-[#247B50]' : 'text-ink-500';
  return <span className={`text-[11px] font-semibold ${tone}`}>{p.detail}</span>;
}

const STEP_TEXT: Record<string, string> = {
  started: 'Starting a run',
  searching: 'Searching',
  found: 'Found a lead',
  writing: 'Writing a draft',
  drafted: 'Saved a draft',
  mail: 'Brought you mail',
  note: 'Working',
};

// The real 3D office (three.js) loads only when it is shown.
const OfficeStage3D = dynamic(() => import('../office3d/OfficeStage3D').then((m) => m.OfficeStage3D), {
  ssr: false,
  loading: () => <div className="grid aspect-[900/540] w-full place-items-center text-sm text-ink-700">Loading the 3D office…</div>,
});
const MODE_KEY = 'pulse-office-mode';

/** The Overview as a live 3D office: one floor for software services, one for college programs. */
export function OfficeView({ data }: { data: OfficeData }) {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const hitsRef = useRef<Hit[]>([]);
  const [floor, setFloor] = useState<FloorKey>('g');
  const [selected, setSelected] = useState<string | null>(null);
  const [full, setFull] = useState(false);
  const [fallbackFull, setFallbackFull] = useState(false);
  const liftRef = useRef<number | null>(null);
  const clockRef = useRef(0);
  const drawRef = useRef<((t: number) => void) | null>(null);
  // One simulation per floor, kept alive while you look at the other floor.
  const simsRef = useRef<Record<FloorKey, OfficeSim> | null>(null);
  if (!simsRef.current) simsRef.current = { g: new OfficeSim(), f: new OfficeSim() };
  // The 3D office is the premium HQ, with its own floor plan; the same people and live steps drive both.
  const hqSimsRef = useRef<Record<FloorKey, OfficeSim> | null>(null);
  if (!hqSimsRef.current) hqSimsRef.current = { g: new OfficeSim(HQ), f: new OfficeSim(HQ) };
  // What each agent is doing right now, from its live steps (shown on its card).
  const [live, setLive] = useState<Record<string, string>>({});
  // Real 3D on computers that can show it; the drawn office on phones, old browsers, or when chosen.
  const [mode, setMode] = useState<'2d' | '3d'>('2d');
  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = window.localStorage.getItem(MODE_KEY);
    } catch {
      // Private window: no saved choice.
    }
    const gl = (() => {
      try {
        return Boolean(document.createElement('canvas').getContext('webgl2'));
      } catch {
        return false;
      }
    })();
    if (gl && (saved === '3d' || (saved == null && window.innerWidth >= 900))) setMode('3d');
  }, []);
  const switchMode = (m: '2d' | '3d') => {
    setMode(m);
    try {
      window.localStorage.setItem(MODE_KEY, m);
    } catch {
      // Not saved; fine.
    }
  };

  const floorInfo = data.floors.find((f) => f.key === floor) ?? data.floors[0];
  const other = data.floors.find((f) => f.key !== floor) ?? null;
  const people = data.people.filter((p) => p.floor === floor);

  // Keep the drawing inputs in a ref so the animation loop always reads the latest without restarting.
  const inputRef = useRef({ floor, floorInfo, other, selected });
  inputRef.current = { floor, floorInfo, other, selected };

  // Match the cast to the latest data (someone paused, a new agent, a team member signing in).
  useEffect(() => {
    for (const sims of [simsRef.current!, hqSimsRef.current!]) {
      sims.g.sync(data.people.filter((p) => p.floor === 'g'), true);
      sims.f.sync(data.people.filter((p) => p.floor === 'f'), false);
    }
  }, [data]);

  // Live steps: what happened in the last 15 minutes sets the scene; after that every new step is acted out.
  useEffect(() => {
    let lastId = 0;
    let stop = false;
    let refreshAt = 0;
    const apply = (events: LiveStepEvent[], replay: boolean) => {
      const all = [simsRef.current!, hqSimsRef.current!];
      let changed = false;
      const next: Record<string, string | null> = {};
      for (const e of events) {
        lastId = Math.max(lastId, e.id);
        for (const sims of all) {
          sims.g.push(e, replay);
          sims.f.push(e, replay);
        }
        next[e.agent] = e.step === 'finished' || e.step === 'failed' || e.step === 'mail' ? null : e.text || STEP_TEXT[e.step] || 'Working';
        if (replay && (e.step === 'drafted' || e.step === 'finished' || e.step === 'failed')) changed = true;
      }
      if (Object.keys(next).length) {
        setLive((prev) => {
          const out = { ...prev };
          for (const [k, v] of Object.entries(next)) {
            if (v) out[k] = v;
            else delete out[k];
          }
          return out;
        });
      }
      // New drafts or a finished run change the counts: reload the page data, at most every 10 seconds.
      if (changed && Date.now() > refreshAt) {
        refreshAt = Date.now() + 10_000;
        router.refresh();
      }
    };
    const poll = async (first: boolean) => {
      try {
        const res = await fetch(`/api/office/live${first ? '' : `?since=${lastId}`}`, { cache: 'no-store' });
        if (res.ok) {
          const { events } = (await res.json()) as { events: LiveStepEvent[] };
          apply(events, !first);
        }
      } catch {
        // Offline for a moment: try again on the next tick.
      }
      if (!stop) timer = window.setTimeout(() => poll(false), document.hidden ? 30_000 : 6_000);
    };
    let timer = window.setTimeout(() => poll(true), 300);
    return () => {
      stop = true;
      window.clearTimeout(timer);
    };
  }, [router]);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    const font = getComputedStyle(document.body).fontFamily || 'system-ui, sans-serif';
    const size = () => {
      const w = cv.clientWidth || LW;
      // Sharp on retina screens, but no more than 2x: more pixels only cost frames.
      const d = Math.min(2, window.devicePixelRatio || 1);
      cv.width = Math.round(w * d);
      cv.height = Math.round(((w * LH) / LW) * d);
    };
    const draw = (t: number) => {
      const i = inputRef.current;
      hitsRef.current = drawOffice(ctx, cv.width / LW, {
        floor: i.floor,
        actors: simsRef.current![i.floor].actors,
        ready: i.floorInfo.ready,
        readyHref: i.floorInfo.readyHref,
        talks: i.floorInfo.talks,
        talksHref: i.floorInfo.talksHref,
        otherFloor: i.other ? FLOOR_LABEL[i.other.key] : null,
        selected: i.selected,
        t,
        liftT: liftRef.current == null ? null : t - liftRef.current,
        font,
      });
    };
    drawRef.current = draw;
    size();
    const ro = new ResizeObserver(() => {
      size();
      draw(clockRef.current);
    });
    ro.observe(cv);
    let raf = 0;
    const tick = (t: number) => {
      // Big gaps (a background tab) are not replayed as one long jump across the room.
      const dt = Math.min(0.25, Math.max(0, t - clockRef.current));
      clockRef.current = t;
      simsRef.current!.g.step(dt, t);
      simsRef.current!.f.step(dt, t);
      draw(t);
    };
    const loop = (n: number) => {
      // One clock for both views (seconds since the page opened), so switching 2D/3D keeps everyone's timing.
      tick(n / 1000);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [mode]);

  // Redraw at once when the floor, selection or data change, even if the tab is not animating.
  useEffect(() => {
    drawRef.current?.(clockRef.current);
  }, [floor, selected, data, full, fallbackFull]);

  // The agents report in on their own schedule; refresh the office every minute while the tab is open.
  useEffect(() => {
    const id = window.setInterval(() => {
      if (!document.hidden) router.refresh();
    }, 60_000);
    return () => window.clearInterval(id);
  }, [router]);

  useEffect(() => {
    const onChange = () => setFull(document.fullscreenElement === stageRef.current);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFallbackFull(false);
    };
    document.addEventListener('fullscreenchange', onChange);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  const goFloor = (k: FloorKey) => {
    if (k === floor) return;
    liftRef.current = clockRef.current;
    window.setTimeout(() => {
      setFloor(k);
      setSelected(null);
    }, 450);
  };

  const toggleFull = async () => {
    if (full || fallbackFull) {
      if (document.fullscreenElement) await document.exitFullscreen().catch(() => undefined);
      setFallbackFull(false);
      return;
    }
    // Some browsers (and embedded views) refuse or ignore real full screen; fill the window instead.
    try {
      const req = stageRef.current?.requestFullscreen?.();
      if (req) await Promise.race([req, new Promise((r) => window.setTimeout(r, 400))]);
    } catch {
      // handled below
    }
    if (document.fullscreenElement !== stageRef.current) setFallbackFull(true);
  };

  const hitAt = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * LW;
    const y = ((e.clientY - r.top) / r.height) * LH;
    return [...hitsRef.current].reverse().find((h) => x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h);
  };

  const isFull = full || fallbackFull;
  const picked = people.find((p) => p.id === selected) ?? null;
  const agentsHere = data.people.filter((p) => p.kind === 'agent');
  const allToggle = data.canControl && agentsHere.length > 0 && (
    <AllAgentsToggle anyRunning={agentsHere.some((p) => !p.paused)} anyPaused={agentsHere.some((p) => p.paused)} />
  );
  const floorSwitch = data.floors.length > 1 && (
    <div className="inline-flex gap-0.5 rounded-lg border border-paper-line bg-white p-[3px]" role="group" aria-label="Floor">
      {data.floors.map((f) => (
        <button
          key={f.key}
          type="button"
          aria-pressed={floor === f.key}
          onClick={() => goFloor(f.key)}
          className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-semibold transition-colors ${
            floor === f.key ? 'bg-ink-950 text-white' : 'text-ink-700 hover:bg-paper'
          }`}
        >
          {f.key === 'g' ? 'Ground · Software' : 'First · Colleges'}
          {floor !== f.key && f.ready > 0 && <span className="rounded-full bg-flame-red px-1.5 text-[10.5px] text-white">{f.ready} ready</span>}
        </button>
      ))}
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Progress">
        <Tile
          label="Office level"
          value={`Level ${data.xp.level}`}
          bar={(data.xp.inLevel / data.xp.perLevel) * 100}
          hint={`${fmt(data.xp.inLevel)} / ${fmt(data.xp.perLevel)} XP to level ${data.xp.level + 1}`}
        />
        <Tile
          label="Today's goal"
          value={`${data.goal.done} / ${data.goal.target} sent`}
          bar={(data.goal.done / data.goal.target) * 100}
          hint={data.goal.done >= data.goal.target ? 'Goal reached today' : `${data.goal.target - data.goal.done} more emails to reach it`}
        />
        <Tile label="Streak" value={`${data.streak} ${data.streak === 1 ? 'day' : 'days'}`} hint="Days in a row with at least 1 email sent" />
        <Tile label="Ready to send" value={`${fmt(floorInfo.ready)} ${floorInfo.ready === 1 ? 'draft' : 'drafts'}`} hint="Click the mail room to open them" />
      </section>

      <div
        ref={stageRef}
        className={
          isFull
            ? `flex items-center justify-center bg-[#EFEDEA] px-4 pb-4 pt-16 ${fallbackFull ? 'fixed inset-0 z-[60]' : 'relative'}`
            : 'relative rounded-xl border border-paper-line bg-[#EFEDEA] p-2'
        }
      >
        {mode === '3d' ? (
          <div className="w-full">
            <OfficeStage3D
              floor={floor}
              simsRef={hqSimsRef}
              ready={floorInfo.ready}
              readyHref={floorInfo.readyHref}
              talks={floorInfo.talks}
              talksHref={floorInfo.talksHref}
              otherFloor={other ? FLOOR_LABEL[other.key] : null}
              selected={selected}
              full={isFull}
              onSelect={(id) => setSelected((s) => (s === id ? null : id))}
              onNavigate={(href) => router.push(href)}
              onLift={() => other && goFloor(other.key)}
            />
          </div>
        ) : (
        <canvas
          ref={canvasRef}
          className="block aspect-[900/540] max-w-full cursor-default"
          style={{ width: isFull ? 'min(100%, calc((100vh - 96px) * 900 / 540))' : '100%' }}
          aria-label={`3D office, ${FLOOR_LABEL[floor]}: ${people.filter((p) => p.state !== 'away').map((p) => `${p.name} ${p.detail}`).join(', ')}`}
          role="img"
          onMouseMove={(e) => {
            e.currentTarget.style.cursor = hitAt(e) ? 'pointer' : 'default';
          }}
          onClick={(e) => {
            const h = hitAt(e);
            if (!h) return;
            if (h.action === 'lift' && other) goFloor(other.key);
            else if (h.id) setSelected((s) => (s === h.id ? null : h.id!));
            else if (h.href) router.push(h.href);
          }}
        />
        )}
        <div className={`absolute flex items-center gap-2 ${isFull ? 'left-4 right-4 top-4' : 'right-4 top-4'}`}>
          {isFull && <div className="mr-auto">{floorSwitch}</div>}
          {isFull && allToggle}
          <button
            type="button"
            onClick={() => switchMode(mode === '3d' ? '2d' : '3d')}
            className="btn-ghost h-8 bg-white px-2.5 text-xs"
            title={mode === '3d' ? 'Show the drawn office (lighter)' : 'Show the real 3D office'}
          >
            {mode === '3d' ? <Square size={14} /> : <BoxIcon size={14} />} {mode === '3d' ? '2D' : '3D'}
          </button>
          <button type="button" onClick={toggleFull} className="btn-ghost h-8 bg-white px-2.5 text-xs">
            {isFull ? <Minimize2 size={14} /> : <Maximize2 size={14} />} {isFull ? 'Exit full screen' : 'Full screen'}
          </button>
        </div>
        {picked && (
          <div className="absolute bottom-3 left-4 flex max-w-[calc(100%-2rem)] items-center gap-3 rounded-xl border border-paper-line bg-white px-3 py-2.5 shadow-[0_8px_24px_rgba(20,18,21,0.12)]">
            <AgentFace slug={picked.slug} name={picked.name} size={44} color={personColor(picked)} ring={personColor(picked)} />
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-ink-950">{picked.name}</span>
              <span className="block truncate text-xs text-ink-500">
                {picked.role} · {picked.detail}
              </span>
            </span>
            {data.canControl && picked.slug && <AgentToggle slug={picked.slug} paused={picked.paused} name={picked.name} />}
            {picked.href && (
              <Link href={picked.href} className="btn-ghost h-7 px-2 text-xs">
                Open
              </Link>
            )}
            <button type="button" onClick={() => setSelected(null)} className="text-xs text-ink-400 hover:text-ink-950" aria-label="Close">
              ✕
            </button>
          </div>
        )}
        {!isFull && !picked && (
          <div className="absolute bottom-3 right-4 hidden flex-wrap gap-3 rounded-lg border border-paper-line bg-white px-2.5 py-1 text-[11.5px] text-ink-700 sm:flex">
            {[
              ['#1D9E75', 'Working'],
              ['#D85A30', 'Delivering drafts'],
              ['#8E8893', 'Paused'],
              ['#C4242A', 'Failed run'],
              ['#378ADD', 'Team'],
            ].map(([c, l]) => (
              <span key={l} className="inline-flex items-center gap-1.5">
                <i className="h-2 w-2 rounded-full" style={{ background: c }} /> {l}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {floorSwitch}
          {allToggle}
        </div>
        <span className="text-xs text-ink-400">Click anyone in the office to see them, pause or start them. The office refreshes every minute.</span>
      </div>

      <section className="grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-2.5" aria-label={`People on the ${FLOOR_LABEL[floor].toLowerCase()}`}>
        {people.map((p) => (
          <div
            key={p.id}
            className={`card flex items-center gap-2.5 px-3 py-2.5 transition-shadow ${selected === p.id ? 'border-flame-red shadow-[0_0_0_2px_#FFF1E6]' : ''}`}
          >
            <button
              type="button"
              onClick={() => setSelected((s) => (s === p.id ? null : p.id))}
              aria-pressed={selected === p.id}
              className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
              title="Show in the office"
            >
              <AgentFace slug={p.slug} name={p.name} size={38} color={personColor(p)} ring={personColor(p)} />
              <span className="min-w-0">
                <span className="block truncate text-[13.5px] font-semibold text-ink-950">{p.name}</span>
                <span className="block truncate text-[11.5px] text-ink-500">{p.role}</span>
                {stateText(p, p.slug ? live[p.slug] : undefined)}
              </span>
            </button>
            {data.canControl && p.slug ? (
              <span className="shrink-0">
                <AgentToggle slug={p.slug} paused={p.paused} name={p.name} />
              </span>
            ) : (
              p.href && (
                <Link href={p.href} className="shrink-0 text-xs font-medium text-ink-500 hover:text-ink-950 hover:underline">
                  Open
                </Link>
              )
            )}
          </div>
        ))}
      </section>
    </div>
  );
}
