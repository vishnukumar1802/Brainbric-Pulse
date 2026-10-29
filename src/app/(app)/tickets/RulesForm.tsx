'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { saveSupportRulesAction } from '@/app/actions';

function Save() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? 'Saving…' : 'Save'}
    </button>
  );
}

export function RulesForm({ rules }: { rules: string }) {
  const [state, action] = useFormState(saveSupportRulesAction, undefined);
  return (
    <form action={action} className="flex flex-col gap-3">
      <textarea name="rules" defaultValue={rules} rows={4} maxLength={2000} className="input w-full" aria-label="What counts as support" />
      <div className="flex items-center gap-3">
        <Save />
        {state?.error && <span className="text-sm text-[#A32A2D]">{state.error}</span>}
        {state?.ok && <span className="text-sm text-ink-500">{state.ok}</span>}
      </div>
    </form>
  );
}
