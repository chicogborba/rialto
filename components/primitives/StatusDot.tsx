import { cn } from "@/lib/utils";

type Tone = "ok" | "warn" | "fail" | "idle";
const TONES: Record<Tone, string> = {
  ok: "bg-signal",
  warn: "bg-pay",
  fail: "bg-fail",
  idle: "bg-line-hi",
};

export function StatusDot({ tone, className }: { tone: Tone; className?: string }) {
  return <span aria-hidden className={cn("inline-block size-2", TONES[tone], className)} />;
}
