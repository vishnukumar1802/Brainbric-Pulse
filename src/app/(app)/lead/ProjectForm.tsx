'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { saveProjectAction } from '@/app/actions';

function Save() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn" disabled={pending}>
      {pending ? 'Saving…' : 'Save project'}
    </button>
  );
}

export function ProjectForm() {
  const [state, action] = useFormState(saveProjectAction, undefined);
  return (
    <form action={action} className="grid gap-2 sm:grid-cols-2">
      <input name="name" className="input" placeholder="Name (same name updates it)" required />
      <input name="repo" className="input" placeholder="GitHub: owner/repository" />
      <input name="live_url" className="input" placeholder="Live site: https://…" />
      <input name="description" className="input" placeholder="What it is (one line)" />
      <div className="flex items-center gap-3 sm:col-span-2">
        <Save />
        {state?.error && <span className="text-sm text-[#A32A2D]">{state.error}</span>}
        {state?.ok && <span className="text-sm text-ink-500">{state.ok}</span>}
      </div>
    </form>
  );
}
