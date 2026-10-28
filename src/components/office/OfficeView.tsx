'use client';

import { Maximize2, Minimize2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import type { FloorKey, OfficeData, OfficePerson } from '@/lib/office';
import { drawOffice, LH, LW, personColor, type Hit } from './scene';

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

function stateText(p: OfficePerson) {
  const tone = p.state === 'failed' ? 'text-[#C4242A]' : p.state === 'walking' ? 'text-flame-ink' : p.state === 'working' && p.kind === 'agent' ? 'text-[#247B50]' : 'text-ink-500';
  return <span className={`text-[11px] font-semibold ${tone}`}>{p.detail}</span>;
}

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

  const floorInfo = data.floors.find((f) => f.key === floor) ?? data.floors[0];
  const other = data.floors.find((f) => f.key !== floor) ?? null;
  const people = data.people.filter((p) => p.floor === floor);

  // Keep the drawing inputs in a ref so the animation loop always reads the latest without restarting.
  const inputRef = useRef({ floor, people, floorInfo, other, selected });
  inputRef.current = { floor, people, floorInfo, other, selected };

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    const font = getComputedStyle(document.body).fontFamily || 'system-ui, sans-serif';
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const size = () => {
      const w = cv.clientWidth || LW;
      const d = window.devicePixelRatio || 1;
      cv.width = Math.round(w * d);
      cv.height = Math.round(((w * LH) / LW) * d);
    };
    const draw = (t: number) => {
      const i = inputRef.current;
      hitsRef.current = drawOffice(ctx, cv.width / LW, {
        floor: i.floor,
        people: i.people,
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
    const start = performance.now();
    const loop = (n: number) => {
      clockRef.current = (n - start) / 1000;
      draw(clockRef.current);
      raf = requestAnimationFrame(loop);
    };
    if (reduce) {
      clockRef.current = 6;
      draw(6);
      const id = window.setInterval(() => draw(6), 1000);
      return () => {
        ro.disconnect();
        window.clearInterval(id);
      };
    }
    raf = requestAnimationFrame(loop);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf);
    };
  }, []);

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
            else if (h.href) router.push(h.href);
            else if (h.id) setSelected((s) => (s === h.id ? null : h.id!));
          }}
        />
        <div className={`absolute flex items-center gap-2 ${isFull ? 'left-4 right-4 top-4' : 'right-4 top-4'}`}>
          {isFull && <div className="mr-auto">{floorSwitch}</div>}
          <button type="button" onClick={toggleFull} className="btn-ghost h-8 bg-white px-2.5 text-xs">
            {isFull ? <Minimize2 size={14} /> : <Maximize2 size={14} />} {isFull ? 'Exit full screen' : 'Full screen'}
          </button>
        </div>
        {!isFull && (
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
        {floorSwitch || <span />}
        <span className="text-xs text-ink-400">Click a name in the office to open it. The office refreshes every minute.</span>
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
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-xs font-bold text-white" style={{ background: personColor(p) }}>
                {p.name.slice(0, 2).toUpperCase()}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[13.5px] font-semibold text-ink-950">{p.name}</span>
                <span className="block truncate text-[11.5px] text-ink-500">{p.role}</span>
                {stateText(p)}
              </span>
            </button>
            {p.href && (
              <Link href={p.href} className="shrink-0 text-xs font-medium text-ink-500 hover:text-ink-950 hover:underline">
                Open
              </Link>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}
