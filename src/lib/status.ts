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
  { value: 'scheduled', label: 'Workshop scheduled', tone: 'won', hint: 'Dates confirmed with the college' },
  { value: 'delivered', label: 'Delivered', tone: 'won', hint: 'Program done; ask for a repeat or partnership' },
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
  neutral: 'bg-[#F0EEEB] text-ink-700',
  action: 'bg-flame-tint text-flame-ink',
  progress: 'bg-[#EEF1F5] text-[#2F4058]',
  hot: 'bg-[#FFEDEA] text-[#831C1E]',
  won: 'bg-[#DCFAE5] text-[#0B3D1C]',
  lost: 'bg-transparent text-ink-500',
};

export const KIND_LABELS: Record<string, string> = {
  cold: 'Cold outreach',
  requirement: 'Requirement post',
  inbound: 'Inbound',
  college: 'College',
};
