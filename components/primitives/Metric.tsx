import { cn } from "@/lib/utils";
import { Label } from "./Label";

interface MetricProps {
  label: string;
  children: React.ReactNode;
  delta?: React.ReactNode;
  tone?: "paper" | "signal" | "pay" | "fail";
  className?: string;
}

const TONES = { paper: "text-paper", signal: "text-signal", pay: "text-pay", fail: "text-fail" } as const;

/** Label + big mono value + optional delta line. */
export function Metric({ label, children, delta, tone = "paper", className }: MetricProps) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Label>{label}</Label>
      <div className={cn("tnum font-mono text-2xl font-bold leading-none", TONES[tone])}>{children}</div>
      {delta ? <div className="font-mono text-[11px] text-muted">{delta}</div> : null}
    </div>
  );
}
