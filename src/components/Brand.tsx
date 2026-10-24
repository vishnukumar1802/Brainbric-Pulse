import Image from 'next/image';

export function Brand({ dark = true, size = 32 }: { dark?: boolean; size?: number }) {
  return (
    <div className="flex items-center gap-2.5">
      <Image src="/brainbric-logo.png" alt="Brainbric Innovations" width={size} height={Math.round(size * 1.05)} priority />
      <div className="leading-tight">
        <div className={`font-display text-[15px] font-semibold tracking-tight ${dark ? 'text-white' : 'text-ink-950'}`}>
          Brainbric <span className="bg-flame-x bg-clip-text text-transparent">Pulse</span>
        </div>
        <div className={`text-[10.5px] font-medium ${dark ? 'text-ink-400' : 'text-ink-500'}`}>Brainbric Innovations</div>
      </div>
    </div>
  );
}
