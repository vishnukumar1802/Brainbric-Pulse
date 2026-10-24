'use client';

import { useEffect, useRef } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { addNoteAction } from '@/app/actions';

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-ghost self-end" disabled={pending}>
      {pending ? 'Saving…' : 'Add note'}
    </button>
  );
}

export function NoteForm({ id }: { id: string }) {
  const [state, action] = useFormState(addNoteAction, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);
  return (
    <form ref={ref} action={action} className="flex flex-col gap-2">
      <input type="hidden" name="id" value={id} />
      <label htmlFor="note" className="sr-only">
        Note
      </label>
      <textarea id="note" name="note" rows={3} placeholder="Add a note: what they said, next step, call outcome…" className="input resize-y" />
      {state?.error && <p className="text-xs text-flame-deep">{state.error}</p>}
      <Submit />
    </form>
  );
}
