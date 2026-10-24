'use client';

import { Menu, X } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Brand } from './Brand';

export function MobileNav({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  useEffect(() => setOpen(false), [path]);
  return (
    <>
      <header className="sticky top-0 z-30 flex items-center justify-between bg-ink-950 px-4 py-3 lg:hidden">
        <Brand size={26} />
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-md p-2 text-white hover:bg-white/10"
          aria-label="Open menu"
          aria-expanded={open}
        >
          <Menu size={20} />
        </button>
      </header>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-ink-950/60" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw] overflow-y-auto bg-ink-950">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute right-3 top-4 rounded-md p-1.5 text-ink-400 hover:bg-white/10 hover:text-white"
              aria-label="Close menu"
            >
              <X size={18} />
            </button>
            {children}
          </div>
        </div>
      )}
    </>
  );
}
