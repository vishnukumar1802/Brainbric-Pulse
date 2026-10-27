import Image from 'next/image';

/** The Brainbric mark with the product name and its scope. */
export function Brand({ size = 28, scope = true }: { size?: number; scope?: boolean; dark?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <Image src="/brainbric-logo.png" alt="" width={size} height={Math.round(size * 1.05)} priority />
      <div className="min-w-0 leading-tight">
        <div className="text-[15px] font-semibold tracking-[-0.01em] text-ink-950">Pulse</div>
        {scope && <div className="truncate text-xs text-ink-500">Brainbric Innovations</div>}
      </div>
    </div>
  );
}
