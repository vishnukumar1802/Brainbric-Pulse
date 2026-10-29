import { REQUEST_STATUS, type RequestStatus } from '@/lib/lead-status';

const TONE: Record<string, string> = {
  grey: 'bg-[#F0EEEB] text-ink-700',
  amber: 'bg-flame-tint text-flame-ink',
  blue: 'bg-[#EEF1F5] text-[#2F4058]',
  green: 'bg-[#DCFAE5] text-[#0B3D1C]',
  red: 'bg-[#FFEDEA] text-[#831C1E]',
};

export function StatusPill({ status }: { status: RequestStatus }) {
  const s = REQUEST_STATUS[status];
  return (
    <span title={s.hint} className={`inline-flex h-5 shrink-0 items-center whitespace-nowrap rounded px-1.5 text-xs font-medium ${TONE[s.tone]}`}>
      {s.label}
    </span>
  );
}
