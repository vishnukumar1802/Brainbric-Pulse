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
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-paper-line bg-paper px-4 lg:hidden">
        <Brand size={24} />
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-md p-2 text-ink-900 hover:bg-paper-active"
          aria-label="Open menu"
          aria-expanded={open}
        >
          <Menu size={20} />
        </button>
      </header>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-ink-950/30" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw] overflow-y-auto border-r border-paper-line bg-paper shadow-[0_8px_24px_rgba(20,18,21,0.12)]">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute right-3 top-4 rounded-md p-1.5 text-ink-500 hover:bg-paper-active hover:text-ink-950"
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
