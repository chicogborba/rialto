import { cn } from "@/lib/utils";

interface LabelProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: "muted" | "paper" | "signal" | "pay" | "fail" | "data" | "ink";
}

const TONES: Record<NonNullable<LabelProps["tone"]>, string> = {
  muted: "text-muted",
  paper: "text-paper",
  signal: "text-signal",
  pay: "text-pay",
  fail: "text-fail",
  data: "text-data",
  ink: "text-ink",
};

/** Small uppercase mono metadata label. */
export function Label({ tone = "muted", className, ...props }: LabelProps) {
  return (
    <span
      className={cn(
        "font-mono text-[11px] uppercase tracking-[0.12em] leading-none",
        TONES[tone],
        className,
      )}
      {...props}
    />
  );
}
