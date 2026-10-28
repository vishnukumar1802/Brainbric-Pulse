'use client';

import { Bell, BellRing, ExternalLink, Mail, X } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';

type Alert = {
  id: number;
  from_name: string | null;
  from_email: string | null;
  subject: string | null;
  received_at: string;
  web_link: string | null;
  label: string | null;
  lead_id: string | null;
  seen: boolean;
};

const LABELS: Record<string, { text: string; cls: string }> = {
  lead: { text: 'Lead reply', cls: 'bg-flame-tint text-flame-ink' },
  client: { text: 'Client', cls: 'bg-[#DCFAE5] text-[#0B3D1C]' },
  meeting: { text: 'Meeting', cls: 'bg-[#E6F1FB] text-[#0C447C]' },
  newsletter: { text: 'Newsletter', cls: 'bg-paper-active text-ink-700' },
  notification: { text: 'Notification', cls: 'bg-paper-active text-ink-700' },
  other: { text: 'Mail', cls: 'bg-paper-active text-ink-700' },
};
const OUTLOOK_INBOX = 'https://outlook.office.com/mail/inbox';

function ago(iso: string) {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h} h ago` : new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}
const who = (a: Alert) => a.from_name || a.from_email || 'Someone';

/**
 * New-mail alerts for the admin: a bell with the unread count, a pop-up for each new mail with a Check mail button
 * that opens it in Outlook, and a desktop notification when the browser allows it. Checks every 15 seconds.
 */
export function MailBell({ sidebarClosed }: { sidebarClosed: boolean }) {
  const [items, setItems] = useState<Alert[]>([]);
  const [unseen, setUnseen] = useState(0);
  const [open, setOpen] = useState(false);
  const [toasts, setToasts] = useState<Alert[]>([]);
  const [perm, setPerm] = useState<NotificationPermission | 'unsupported'>('default');
  const baseline = useRef<number | null>(null);

  useEffect(() => {
    setPerm(typeof Notification === 'undefined' ? 'unsupported' : Notification.permission);
  }, []);

  const markSeen = useCallback(async (body: { id?: number; all?: boolean }) => {
    setItems((list) => list.map((a) => (body.all || a.id === body.id ? { ...a, seen: true } : a)));
    setUnseen((n) => (body.all ? 0 : Math.max(0, n - 1)));
    await fetch('/api/mail/seen', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).catch(() => undefined);
  }, []);

  useEffect(() => {
    let stop = false;
    let timer = 0;
    const poll = async () => {
      try {
        const res = await fetch('/api/mail/alerts', { cache: 'no-store' });
        if (res.ok) {
          const data = (await res.json()) as { items: Alert[]; unseen: number };
          setItems(data.items);
          setUnseen(data.unseen);
          const top = data.items.reduce((m, a) => Math.max(m, a.id), 0);
          // The first load sets the starting point; only mail that arrives after that pops up.
          if (baseline.current == null) baseline.current = top;
          else if (top > baseline.current) {
            const fresh = data.items.filter((a) => a.id > baseline.current! && !a.seen).reverse();
            baseline.current = top;
            setToasts((t) => [...t, ...fresh].slice(-3));
            if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
              for (const a of fresh.slice(-3)) {
                const n = new Notification(`New mail from ${who(a)}`, { body: a.subject || '(no subject)', tag: `mail-${a.id}` });
                n.onclick = () => {
                  window.open(a.web_link || OUTLOOK_INBOX, '_blank', 'noopener');
                  void markSeen({ id: a.id });
                  n.close();
                };
              }
            }
          }
        }
      } catch {
        // Offline for a moment: try again on the next tick.
      }
      if (!stop) timer = window.setTimeout(poll, document.hidden ? 60_000 : 15_000);
    };
    void poll();
    return () => {
      stop = true;
      window.clearTimeout(timer);
    };
  }, [markSeen]);

  // Pop-ups close themselves after 20 seconds.
  useEffect(() => {
    if (!toasts.length) return;
    const id = window.setTimeout(() => setToasts((t) => t.slice(1)), 20_000);
    return () => window.clearTimeout(id);
  }, [toasts]);

  const checkLink = (a: Alert) => (
    <a
      href={a.web_link || OUTLOOK_INBOX}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => {
        void markSeen({ id: a.id });
        setToasts((t) => t.filter((x) => x.id !== a.id));
      }}
      className="inline-flex h-7 items-center gap-1.5 rounded-md bg-ink-950 px-2.5 text-xs font-medium text-white hover:bg-ink-800"
    >
      <Mail size={13} /> Check mail
    </a>
  );
  const chip = (a: Alert) => {
    const l = LABELS[a.label ?? 'other'] ?? LABELS.other;
    return <span className={`inline-flex h-5 items-center rounded px-1.5 text-[11px] font-medium ${l.cls}`}>{l.text}</span>;
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={unseen ? `${unseen} new mails` : 'Mail alerts'}
        aria-expanded={open}
        title="New mail in your inbox"
        className={`fixed z-40 grid h-8 w-8 place-items-center rounded-md border border-paper-line bg-white text-ink-700 shadow-sm transition-colors hover:border-ink-400 hover:text-ink-950 right-[60px] top-3 lg:right-auto lg:top-4 ${
          sidebarClosed ? 'lg:left-[52px]' : 'lg:left-[186px]'
        }`}
      >
        {unseen ? <BellRing size={16} className="text-flame-red" /> : <Bell size={16} />}
        {unseen > 0 && (
          <span className="num absolute -right-1.5 -top-1.5 min-w-[18px] rounded-full bg-flame-red px-1 text-center text-[10.5px] font-semibold leading-[18px] text-white">
            {unseen > 99 ? '99+' : unseen}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-50" onClick={() => setOpen(false)}>
          <div
            className="absolute right-4 top-14 w-[400px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-paper-line bg-white shadow-[0_12px_32px_rgba(20,18,21,0.16)] lg:left-[186px] lg:right-auto"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="New mail"
          >
            <div className="flex items-center justify-between border-b border-paper-line px-4 py-3">
              <div>
                <div className="text-sm font-semibold text-ink-950">Inbox alerts</div>
                <div className="text-xs text-ink-500">Outside mail, checked every 2 minutes, 9 AM to 9 PM</div>
              </div>
              <div className="flex items-center gap-2">
                {unseen > 0 && (
                  <button type="button" onClick={() => markSeen({ all: true })} className="text-xs font-medium text-ink-500 hover:text-ink-950">
                    Mark all read
                  </button>
                )}
                <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="text-ink-400 hover:text-ink-950">
                  <X size={16} />
                </button>
              </div>
            </div>
            {perm === 'default' && (
              <button
                type="button"
                onClick={async () => setPerm(await Notification.requestPermission())}
                className="flex w-full items-center gap-2 border-b border-paper-line bg-flame-tint px-4 py-2 text-left text-xs font-medium text-flame-ink"
              >
                <BellRing size={13} /> Turn on desktop alerts, so new mail pops up even when this tab is in the background
              </button>
            )}
            <ul className="max-h-[60vh] overflow-y-auto">
              {items.length ? (
                items.map((a) => (
                  <li key={a.id} className={`flex gap-3 border-b border-paper-rule px-4 py-3 last:border-b-0 ${a.seen ? '' : 'bg-[#FFFBF7]'}`}>
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${a.seen ? 'bg-transparent' : 'bg-flame-red'}`} aria-hidden />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-sm font-semibold text-ink-950">{who(a)}</span>
                        <span className="shrink-0 text-[11px] text-ink-400">{ago(a.received_at)}</span>
                      </div>
                      <div className="truncate text-[13px] text-ink-700">{a.subject || '(no subject)'}</div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {chip(a)}
                        {checkLink(a)}
                        {a.lead_id && (
                          <Link href={`/leads/${encodeURIComponent(a.lead_id)}`} onClick={() => setOpen(false)} className="text-xs font-medium text-ink-500 hover:text-ink-950 hover:underline">
                            Open lead
                          </Link>
                        )}
                      </div>
                    </div>
                  </li>
                ))
              ) : (
                <li className="px-4 py-8 text-center text-sm text-ink-500">No new outside mail yet. New mail shows up here within 2 minutes.</li>
              )}
            </ul>
            <a
              href={OUTLOOK_INBOX}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 border-t border-paper-line px-4 py-2.5 text-xs font-medium text-ink-700 hover:bg-paper"
            >
              Open Outlook inbox <ExternalLink size={12} />
            </a>
          </div>
        </div>
      )}

      <div className="pointer-events-none fixed bottom-4 right-4 z-[55] flex w-[360px] max-w-[calc(100vw-2rem)] flex-col gap-2" aria-live="polite">
        {toasts.map((a) => (
          <div key={a.id} className="pointer-events-auto rounded-xl border border-paper-line bg-white p-3.5 shadow-[0_12px_32px_rgba(20,18,21,0.18)]">
            <div className="flex items-start gap-2.5">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-flame-tint text-flame-ink">
                <Mail size={15} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-medium text-ink-500">New mail · {ago(a.received_at)}</div>
                <div className="truncate text-sm font-semibold text-ink-950">{who(a)}</div>
                <div className="truncate text-[13px] text-ink-700">{a.subject || '(no subject)'}</div>
                <div className="mt-2.5 flex items-center gap-2">
                  {checkLink(a)}
                  {chip(a)}
                </div>
              </div>
              <button type="button" onClick={() => setToasts((t) => t.filter((x) => x.id !== a.id))} aria-label="Dismiss" className="text-ink-400 hover:text-ink-950">
                <X size={15} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
