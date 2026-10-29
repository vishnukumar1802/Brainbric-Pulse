'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { saveDevopsSitesAction } from '@/app/actions';

function Save() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? 'Saving…' : 'Save'}
    </button>
  );
}

export function SitesForm({ sites }: { sites: string }) {
  const [state, action] = useFormState(saveDevopsSitesAction, undefined);
  return (
    <form action={action} className="flex flex-col gap-3">
      <textarea name="sites" defaultValue={sites} rows={4} placeholder="https://brainbric.com" className="input w-full" aria-label="Websites to watch" />
      <div className="flex items-center gap-3">
        <Save />
        {state?.error && <span className="text-sm text-[#A32A2D]">{state.error}</span>}
        {state?.ok && <span className="text-sm text-ink-500">{state.ok}</span>}
      </div>
    </form>
  );
}
