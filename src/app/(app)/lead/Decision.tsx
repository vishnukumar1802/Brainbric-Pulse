'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { decideRequestAction } from '@/app/actions';
import type { RequestStatus } from '@/lib/lead-status';

function Button({ action, className, children }: { action: string; className: string; children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" name="action" value={action} className={className} disabled={pending}>
      {children}
    </button>
  );
}

/** Checkpoint buttons: approve the plan, ask for changes or answer, approve going live, cancel. */
export function Decision({ id, status, cancelOnly = false }: { id: number; status: RequestStatus; cancelOnly?: boolean }) {
  const [state, action] = useFormState(decideRequestAction, undefined);
  if (state?.ok) return <p className="text-sm font-medium text-[#0B6B34]">{state.ok}</p>;
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="id" value={id} />
      {cancelOnly ? (
        <>
          <input name="note" className="input" placeholder="Why (optional)" />
          <div>
            <Button action="cancel" className="btn">
              Cancel request
            </Button>
          </div>
        </>
      ) : status === 'ready' ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button action="approve_live" className="btn-primary">
            Approve going live
          </Button>
          <span className="text-xs text-ink-500">Arvind merges the changes and the live site updates.</span>
        </div>
      ) : (
        <>
          <textarea
            name="note"
            rows={3}
            className="input"
            placeholder={status === 'questions' ? 'Your answer' : 'Optional: what to change in the plan, or answers to his questions'}
          />
          <div className="flex flex-wrap gap-2">
            {status === 'plan_ready' && (
              <Button action="approve_plan" className="btn-primary">
                Approve plan
              </Button>
            )}
            <Button action={status === 'questions' ? 'answer' : 'change_plan'} className="btn">
              {status === 'questions' ? 'Send answer' : 'Ask for changes'}
            </Button>
          </div>
        </>
      )}
      {state?.error && <p className="text-sm text-[#A32A2D]">{state.error}</p>}
    </form>
  );
}
