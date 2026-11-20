export function Logo({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden>
      <defs>
        <linearGradient id="lg" x1="0" y1="0" x2="48" y2="48">
          <stop stopColor="#22d3ee" />
          <stop offset="1" stopColor="#34d399" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="44" height="44" rx="14" stroke="url(#lg)" strokeWidth="2.5" fill="rgba(34,211,238,0.08)" />
      <path d="M8 26h8l3-9 5 18 4-13 2 4h10" stroke="url(#lg)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
