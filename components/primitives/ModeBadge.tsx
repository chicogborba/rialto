import { cn } from "@/lib/utils";
import type { PaymentMode } from "@/lib/types";

/** Always-visible LIVE / SIMULATED marker. Simulated is never styled like live. */
export function ModeBadge({ mode, className }: { mode: PaymentMode; className?: string }) {
  const live = mode === "live";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 border px-1.5 py-1 font-mono text-[10px] font-bold uppercase leading-none tracking-[0.12em]",
        live ? "border-signal bg-signal text-ink" : "border-pay bg-pay text-ink",
        className,
      )}
      title={live ? "Real devnet payment" : "Simulated payment — no blockchain transaction"}
    >
      <span aria-hidden className={cn("size-1.5", live ? "bg-ink" : "bg-ink")} />
      {live ? "LIVE" : "SIMULATED"}
    </span>
  );
}
