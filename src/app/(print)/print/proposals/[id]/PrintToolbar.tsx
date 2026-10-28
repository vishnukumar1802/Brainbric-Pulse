'use client';

import { Download } from 'lucide-react';

/** Screen-only bar above a printable proposal. Without backHref it is the client's view. */
export function PrintToolbar({ backHref }: { backHref?: string }) {
  return (
    <div className="no-print mx-auto mb-5 flex max-w-[210mm] flex-wrap items-center justify-between gap-3 px-4">
      {backHref ? (
        <a href={backHref} className="text-sm font-medium text-ink-700 hover:text-ink-950">
          ← Back to the proposal
        </a>
      ) : (
        <span className="flex items-center gap-2 text-sm font-medium text-ink-900">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brainbric-logo.png" alt="" className="h-6 w-auto" /> Brainbric Innovations
        </span>
      )}
      <div className="flex items-center gap-3">
        <span className="hidden text-xs text-ink-500 sm:inline">In the print window choose &ldquo;Save as PDF&rdquo;.</span>
        <button type="button" className="btn-primary" onClick={() => window.print()}>
          <Download size={15} /> Download PDF
        </button>
      </div>
    </div>
  );
}
