export const STATUSES = [
  { value: 'new', label: 'New', tone: 'neutral', hint: 'Found, nothing drafted yet' },
  { value: 'drafted', label: 'Ready to send', tone: 'action', hint: 'A message is drafted and waiting for you' },
  { value: 'sent', label: 'Contacted', tone: 'progress', hint: 'First message sent' },
  { value: 'followup1', label: 'Follow-up 1', tone: 'progress', hint: 'First follow-up sent' },
  { value: 'followup2', label: 'Follow-up 2', tone: 'progress', hint: 'Second follow-up sent' },
  { value: 'replied', label: 'Replied', tone: 'hot', hint: 'They wrote back' },
  { value: 'interested', label: 'Interested', tone: 'hot', hint: 'They want to talk' },
  { value: 'call_booked', label: 'Call booked', tone: 'hot', hint: 'A meeting is on the calendar' },
  { value: 'proposal', label: 'Proposal sent', tone: 'hot', hint: 'Waiting on their decision' },
  { value: 'won', label: 'Won', tone: 'won', hint: 'Now a client' },
  { value: 'lost', label: 'Lost', tone: 'lost', hint: 'Not going ahead' },
  { value: 'no_response', label: 'No response', tone: 'lost', hint: 'No reply after follow-ups' },
  { value: 'do_not_contact', label: 'Do not contact', tone: 'lost', hint: 'Asked us to stop' },
] as const;

export type StatusValue = (typeof STATUSES)[number]['value'];
export type Tone = (typeof STATUSES)[number]['tone'];

export const HOT_STATUSES: string[] = ['replied', 'interested', 'call_booked', 'proposal'];

export function statusInfo(value: string | null | undefined) {
  return STATUSES.find((s) => s.value === value) ?? { value: value ?? 'new', label: value ?? 'New', tone: 'neutral' as Tone, hint: '' };
}

export const TONE_CLASSES: Record<Tone, string> = {
  neutral: 'bg-ink-800/5 text-ink-700 ring-ink-800/10',
  action: 'bg-flame-amber/15 text-[#8A4B00] ring-flame-orange/30',
  progress: 'bg-sky-50 text-sky-800 ring-sky-200',
  hot: 'bg-flame-red/10 text-flame-deep ring-flame-red/30',
  won: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  lost: 'bg-ink-800/5 text-ink-500 ring-ink-800/10',
};

export const KIND_LABELS: Record<string, string> = {
  cold: 'Cold outreach',
  requirement: 'Requirement post',
  inbound: 'Inbound',
};
