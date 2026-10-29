'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { decideHireAction } from '@/app/actions';

function Button({ action, className, children }: { action: string; className: string; children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" name="action" value={action} className={className} disabled={pending}>
      {children}
    </button>
  );
}

/** Approve or decline a proposal; for a hired agent, let it go. */
export function HireDecision({ id, mode }: { id: number; mode: 'proposal' | 'hired' }) {
  const [state, action] = useFormState(decideHireAction, undefined);
  if (state?.ok) return <p className="text-sm font-medium text-[#0B6B34]">{state.ok}</p>;
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={id} />
      {mode === 'proposal' ? (
        <>
          <input name="note" className="input h-8 min-w-0 flex-1 text-sm" placeholder="Note (optional)" />
          <Button action="approve" className="btn-primary">
            Approve hire
          </Button>
          <Button action="reject" className="btn">
            Decline
          </Button>
        </>
      ) : (
        <Button action="retire" className="btn">
          Let go
        </Button>
      )}
      {state?.error && <p className="w-full text-sm text-[#A32A2D]">{state.error}</p>}
    </form>
  );
}
