import { cn } from "@/lib/utils";

type Tone = "signal" | "pay" | "paper" | "data" | "fail";
const TONES: Record<Tone, string> = {
  signal: "bg-signal text-ink",
  pay: "bg-pay text-ink",
  paper: "bg-paper text-ink",
  data: "bg-data text-ink",
  fail: "bg-fail text-ink",
};

interface StickerProps {
  children: React.ReactNode;
  tone?: Tone;
  /** rotation in degrees */
  rotate?: number;
  /** animation delay in seconds, so stickers don't bob in sync */
  delay?: number;
  className?: string;
}

/** Slap-on text sticker. Decorative unless it carries the only copy of a label. */
export function Slap({ children, tone = "signal", rotate = -4, delay = 0, className }: StickerProps) {
  return (
    <span className={cn("sy-sticker px-3 py-2 text-xs md:text-sm", TONES[tone], className)} style={{ "--r": `${rotate}deg`, "--d": `${delay}s` } as React.CSSProperties}>
      {children}
    </span>
  );
}

/** Round emoji badge. `label` is what a screen reader hears. */
export function Emoji({ children, label, tone = "paper", rotate = 8, delay = 0, className }: StickerProps & { label: string }) {
  return (
    <span role="img" aria-label={label} className={cn("sy-emoji size-16 text-4xl md:size-24 md:text-6xl", TONES[tone], className)} style={{ "--r": `${rotate}deg`, "--d": `${delay}s` } as React.CSSProperties}>
      {children}
    </span>
  );
}
