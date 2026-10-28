import { agentPhoto } from '@/lib/avatars';

/** An agent's round portrait, or their initials on a coloured tile when there is no photo (team members, new agents). */
export function AgentFace({
  slug,
  name,
  size = 32,
  color = '#66606B',
  ring,
  className = '',
}: {
  slug?: string | null;
  name: string;
  size?: number;
  color?: string;
  /** Status colour shown as a dot on the corner. */
  ring?: string;
  className?: string;
}) {
  const src = agentPhoto(slug);
  return (
    <span className={`relative inline-block shrink-0 ${className}`} style={{ width: size, height: size }}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" width={size} height={size} loading="lazy" className="h-full w-full rounded-full object-cover ring-1 ring-black/5" />
      ) : (
        <span
          className="grid h-full w-full place-items-center rounded-full font-semibold text-white"
          style={{ background: color, fontSize: Math.max(9, Math.round(size * 0.36)) }}
          aria-hidden
        >
          {name.slice(0, 2).toUpperCase()}
        </span>
      )}
      {ring && (
        <span
          className="absolute -bottom-0.5 -right-0.5 rounded-full border-2 border-white"
          style={{ width: Math.max(8, size * 0.3), height: Math.max(8, size * 0.3), background: ring }}
          aria-hidden
        />
      )}
    </span>
  );
}
