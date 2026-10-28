'use client';

import { Download } from 'lucide-react';

export function PrintToolbar({ backHref }: { backHref: string }) {
  return (
    <div className="no-print mx-auto mb-5 flex max-w-[210mm] flex-wrap items-center justify-between gap-3 px-4">
      <a href={backHref} className="text-sm font-medium text-ink-700 hover:text-ink-950">
        ← Back to the proposal
      </a>
      <div className="flex items-center gap-3">
        <span className="text-xs text-ink-500">In the print window choose &ldquo;Save as PDF&rdquo;.</span>
        <button type="button" className="btn-primary" onClick={() => window.print()}>
          <Download size={15} /> Download PDF
        </button>
      </div>
    </div>
  );
}
