import { askDocAction } from '@/app/actions';
import { AgentFace } from '@/components/AgentFace';
import { Card } from '@/components/ui';
import { DOC_KINDS, DOC_SHORT, type DocRequest, type ProjectDoc } from '@/lib/docs';
import { fmtDate } from '@/lib/format';

/** The project's documents from Ananya (Business Analyst), and buttons to ask for one. */
export function Documents({ requestId, docs, pending }: { requestId: number; docs: ProjectDoc[]; pending: DocRequest[] }) {
  const waiting = new Set(pending.map((p) => p.kind));
  return (
    <Card
      flush
      title={
        <span className="flex items-center gap-2">
          <AgentFace slug="business-analyst" name="Ananya" size={22} /> Documents
        </span>
      }
      note="Branded Word and PDF documents, written by Ananya (Business Analyst)."
    >
      {docs.length > 0 ? (
        <ul className="divide-y divide-paper-rule">
          {docs.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
              <span className="min-w-0">
                <a href={d.url} target="_blank" rel="noreferrer" className="font-medium text-ink-950 underline-offset-2 hover:underline">
                  {DOC_SHORT[d.kind]} v{d.version}
                </a>
                <span className="block truncate text-xs text-ink-500">{d.title}</span>
              </span>
              <span className="flex shrink-0 items-center gap-2 text-xs text-ink-500">
                {d.pdf_url && (
                  <a href={d.pdf_url} target="_blank" rel="noreferrer" className="font-medium hover:text-ink-950">
                    PDF
                  </a>
                )}
                {fmtDate(d.created_at)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-5 pb-2 text-sm text-ink-500">No documents yet. The SRS and project plan come with the plan; progress reports weekly while building.</p>
      )}
      {pending.length > 0 && (
        <p className="border-t border-paper-rule px-5 py-2 text-xs text-ink-500">
          Being written: {pending.map((p) => DOC_SHORT[p.kind]).join(', ')}. Ananya works hourly, 9 AM to 7 PM.
        </p>
      )}
      <div className="flex flex-wrap gap-1.5 border-t border-paper-rule px-5 py-3">
        <span className="mr-1 self-center text-xs text-ink-500">Ask Ananya for:</span>
        {DOC_KINDS.map((k) => (
          <form key={k} action={askDocAction}>
            <input type="hidden" name="request_id" value={requestId} />
            <input type="hidden" name="kind" value={k} />
            <button type="submit" disabled={waiting.has(k)} className="rounded-md border border-paper-line px-2 py-0.5 text-xs text-ink-700 hover:border-ink-400 hover:text-ink-950 disabled:opacity-40">
              {DOC_SHORT[k]}
            </button>
          </form>
        ))}
      </div>
    </Card>
  );
}
