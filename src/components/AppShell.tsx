'use client';

import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useState } from 'react';

/** Desktop frame: the sidebar can be closed to give the page (and the office) the full width. Remembered in a cookie. */
export function AppShell({
  sidebar,
  mobileNav,
  initialClosed,
  children,
}: {
  sidebar: React.ReactNode;
  mobileNav: React.ReactNode;
  initialClosed: boolean;
  children: React.ReactNode;
}) {
  const [closed, setClosed] = useState(initialClosed);
  const toggle = () => {
    const next = !closed;
    setClosed(next);
    document.cookie = `pulse_sidebar=${next ? 'closed' : 'open'}; path=/; max-age=31536000; samesite=lax`;
  };
  return (
    <div className={`min-h-screen ${closed ? '' : 'lg:pl-60'}`}>
      {!closed && <aside className="fixed inset-y-0 left-0 hidden w-60 overflow-y-auto border-r border-paper-line bg-paper lg:block">{sidebar}</aside>}
      <button
        type="button"
        onClick={toggle}
        aria-label={closed ? 'Open sidebar' : 'Close sidebar'}
        aria-expanded={!closed}
        title={closed ? 'Open sidebar' : 'Close sidebar'}
        className={`fixed top-4 z-30 hidden h-8 w-8 place-items-center rounded-md border border-paper-line bg-white text-ink-500 shadow-sm transition-colors hover:border-ink-400 hover:text-ink-950 lg:grid ${
          closed ? 'left-3' : 'left-[224px]'
        }`}
      >
        {closed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
      </button>
      {mobileNav}
      <main
        className={`mx-auto w-full px-4 py-6 sm:px-6 lg:py-8 ${closed ? 'max-w-[1600px] lg:pl-16 lg:pr-10' : 'max-w-[1240px] lg:px-10'}`}
      >
        {children}
      </main>
    </div>
  );
}
