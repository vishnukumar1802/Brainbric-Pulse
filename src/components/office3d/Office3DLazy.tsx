'use client';

import dynamic from 'next/dynamic';

/** The 3D office loads only in the browser, and only on the page that shows it (three.js is large). */
export const Office3DLazy = dynamic(() => import('./Office3D').then((m) => m.Office3D), {
  ssr: false,
  loading: () => <div className="grid h-[420px] place-items-center rounded-xl border border-paper-line bg-[#efedea] text-sm text-ink-700">Loading the 3D office…</div>,
});
