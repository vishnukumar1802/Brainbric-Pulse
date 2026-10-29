'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { createLeadRequestAction } from '@/app/actions';

function Send() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? 'Sending…' : 'Send to Arvind'}
    </button>
  );
}

const EXAMPLES = {
  change: 'Example: On the employee page add a "Leave balance" column, and a monthly leave report managers can download as Excel.',
  new: 'Example: A booking website for a beauty parlour: services and prices, an online booking form that emails the owner, gallery, contact page with map. Mobile-friendly, brand colour pink.',
};

export function RequestForm({ projects, defaultProject }: { projects: { id: number; name: string }[]; defaultProject: number | null }) {
  const [state, action] = useFormState(createLeadRequestAction, undefined);
  const [kind, setKind] = useState<'change' | 'new'>('change');
  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex gap-2" role="radiogroup" aria-label="What kind of request">
        {(['change', 'new'] as const).map((k) => (
          <label
            key={k}
            className={`flex-1 cursor-pointer rounded-md border px-3 py-2 text-sm ${kind === k ? 'border-ink-900 bg-white font-medium text-ink-950' : 'border-paper-line text-ink-700 hover:border-ink-400'}`}
          >
            <input type="radio" name="kind" value={k} checked={kind === k} onChange={() => setKind(k)} className="sr-only" />
            {k === 'change' ? 'Change an existing project' : 'New project'}
          </label>
        ))}
      </div>

      {kind === 'change' && (
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-medium text-ink-700">Project</span>
          <select name="project_id" defaultValue={defaultProject ?? ''} className="input" required>
            <option value="" disabled>
              Pick a project
            </option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-xs font-medium text-ink-700">Title</span>
        <input name="title" className="input" maxLength={160} placeholder={kind === 'new' ? 'Beauty parlour booking website' : 'Leave balance and monthly leave report'} required />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-xs font-medium text-ink-700">What do you need?</span>
        <textarea name="brief" rows={7} maxLength={8000} className="input" placeholder={EXAMPLES[kind]} required />
        <span className="text-xs text-ink-500">Who it is for, what it must do, any look and feel, links to examples or documents.</span>
      </label>

      <label className="flex flex-col gap-1 text-sm sm:w-56">
        <span className="text-xs font-medium text-ink-700">Deadline (optional)</span>
        <input type="date" name="deadline" className="input" />
      </label>

      <div className="flex items-center gap-3">
        <Send />
        {state?.error && <span className="text-sm text-[#A32A2D]">{state.error}</span>}
      </div>
    </form>
  );
}
