import { cn } from "@/lib/utils";

/** Small rotated tag. Max one per viewport. */
export function Sticker({
  tone = "signal",
  className,
  children,
}: {
  tone?: "signal" | "pay" | "paper";
  className?: string;
  children: React.ReactNode;
}) {
  const tones = { signal: "bg-signal", pay: "bg-pay", paper: "bg-paper" } as const;
  return (
    <span
      className={cn(
        "inline-block -rotate-3 px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-ink",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
