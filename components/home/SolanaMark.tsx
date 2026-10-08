import { SOLANA_MARK } from "@/components/landing/scene/solana-mark";

/** Solana's logo mark. Sized by its height; takes the text colour nowhere: it is always its own gradient. */
export function SolanaMark({ className }: { className?: string }) {
  const id = "solana-mark-gradient";
  return (
    <svg viewBox={`0 0 ${SOLANA_MARK.width} ${SOLANA_MARK.height}`} role="img" aria-label="Solana" className={className}>
      <defs>
        <linearGradient id={id} x1="0" y1={SOLANA_MARK.height} x2={SOLANA_MARK.width} y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={SOLANA_MARK.gradient[0]} />
          <stop offset="1" stopColor={SOLANA_MARK.gradient[1]} />
        </linearGradient>
      </defs>
      {SOLANA_MARK.paths.map((d) => (
        <path key={d} d={d} fill={`url(#${id})`} />
      ))}
    </svg>
  );
}
