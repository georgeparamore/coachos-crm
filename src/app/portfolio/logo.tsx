// Full Circle Labs mark, rebuilt as vector so it stays sharp at any size and
// the orbiting dot can actually orbit. Gradient matches the brand (violet →
// blue), the same hues the site's accent already uses.

export function LogoMark({
  size = 40,
  animate = false,
  className,
}: {
  size?: number;
  animate?: boolean;
  className?: string;
}) {
  // A unique gradient id per render size keeps multiple marks on one page from
  // clashing; the value is stable for a given size so hydration matches.
  const gid = `fcl-grad-${size}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      role="img"
      aria-label="Full Circle Labs"
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8b5cf6" />
          <stop offset="1" stopColor="#4c9bf5" />
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="37" fill="none" stroke={`url(#${gid})`} strokeWidth="6.5" />
      <circle cx="50" cy="50" r="10" fill="#8b5cf6" />
      <g className={animate ? "fcl-orbit-dot" : undefined}>
        <circle cx="50" cy="13" r="7.5" fill="#8b5cf6" />
      </g>
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return <span className={`fcl-wordmark ${className ?? ""}`}>Full Circle Labs</span>;
}

/** Icon + wordmark lockup, used in the nav and footer. */
export function LogoLockup({ size = 34 }: { size?: number }) {
  return (
    <span className="fcl-lockup">
      <LogoMark size={size} />
      <Wordmark />
    </span>
  );
}
