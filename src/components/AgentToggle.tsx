'use client';

import { Pause, Play } from 'lucide-react';
import { useFormStatus } from 'react-dom';
import { setAgentPausedAction } from '@/app/actions';

function ToggleButton({ paused, label, size }: { paused: boolean; label?: string; size: 'sm' | 'md' }) {
  const { pending } = useFormStatus();
  const base =
    size === 'sm'
      ? 'inline-flex h-7 w-[4.25rem] items-center justify-center gap-1 rounded-md text-xs font-medium transition-colors disabled:opacity-50'
      : 'btn';
  const tone = paused
    ? 'bg-ink-900 text-white hover:bg-ink-700'
    : 'border border-[#D9D5D1] bg-white text-ink-700 hover:border-ink-400 hover:text-ink-950';
  return (
    <button type="submit" className={`${base} ${tone}`} disabled={pending} aria-label={label}>
      {paused ? <Play size={size === 'sm' ? 12 : 15} /> : <Pause size={size === 'sm' ? 12 : 15} />}
      {pending ? (paused ? 'Starting…' : 'Pausing…') : paused ? 'Start' : 'Pause'}
    </button>
  );
}

/** Pause or start one agent (slug) or every agent (slug "*"). Only shown to admins. */
export function AgentToggle({ slug, paused, name, size = 'sm' }: { slug: string; paused: boolean; name: string; size?: 'sm' | 'md' }) {
  return (
    <form action={setAgentPausedAction}>
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="paused" value={paused ? 'false' : 'true'} />
      <ToggleButton paused={paused} size={size} label={`${paused ? 'Start' : 'Pause'} ${name}`} />
    </form>
  );
}

export function AllAgentsToggle({ anyRunning, anyPaused }: { anyRunning: boolean; anyPaused: boolean }) {
  return (
    <div className="flex gap-1.5">
      {anyRunning && (
        <form action={setAgentPausedAction}>
          <input type="hidden" name="slug" value="*" />
          <input type="hidden" name="paused" value="true" />
          <AllButton paused={false} />
        </form>
      )}
      {anyPaused && (
        <form action={setAgentPausedAction}>
          <input type="hidden" name="slug" value="*" />
          <input type="hidden" name="paused" value="false" />
          <AllButton paused />
        </form>
      )}
    </div>
  );
}

function AllButton({ paused }: { paused: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-7 items-center gap-1 rounded-md border border-[#D9D5D1] bg-white px-2 text-xs font-medium text-ink-700 transition-colors hover:border-ink-400 hover:text-ink-950 disabled:opacity-50"
    >
      {paused ? <Play size={11} /> : <Pause size={11} />}
      {pending ? 'Saving…' : paused ? 'Start all' : 'Pause all'}
    </button>
  );
}
