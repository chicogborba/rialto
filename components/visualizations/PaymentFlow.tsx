"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check, X } from "lucide-react";
import { formatUsdc } from "@/lib/money";
import { activeAttempt, nameOfProvider, type AttemptState, type RunState } from "@/lib/agent/reducer";
import { MOTION } from "@/lib/agent/timing";
import { cn } from "@/lib/utils";
import { Label, ModeBadge, Panel } from "@/components/primitives";

/** How far through the 9-step rail an attempt got (0–9). */
function reached(a: AttemptState): number {
  switch (a.stage) {
    case "idle": return 0;
    case "requested": return 1;
    case "required_402": return 3;
    case "policy_ok": return 4;
    case "signing": return 6;
    case "verified": return 7;
    case "executing": return 8;
    case "settled": return 9;
    case "failed":
      if (a.error === "policy_rejected") return 4;
      if (a.error === "payment_rejected") return 6;
      if (a.mode !== null) return 8;
      return a.requirements ? 2 : 1;
  }
}

const RAIL = [
  "POST",
  "402 PAYMENT REQUIRED",
  "READ REQUIREMENTS",
  "POLICY CHECK",
  "SIGN USDC",
  "RETRY WITH PAYMENT",
  "PROVIDER VERIFIES",
  "EXECUTE",
  "SETTLED",
] as const;

const BIG_402 = new Set(["required_402", "policy_ok", "signing"]);

function Big402({ attempt }: { attempt: AttemptState }) {
  const reduce = useReducedMotion();
  const signing = attempt.stage === "signing";
  return (
    <motion.div
      key="402"
      initial={reduce ? false : { opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.98 }}
      transition={MOTION.snap}
      className="border border-pay bg-pay p-4 text-ink"
      role="status"
    >
      <div className="tnum font-mono text-6xl font-bold leading-none tracking-tighter">402</div>
      <div className="mt-2 font-mono text-xs font-bold uppercase tracking-[0.12em]">Payment required</div>
      <div className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1 font-mono text-sm font-bold">
        <span className="tnum text-2xl">{attempt.requirements ? formatUsdc(attempt.requirements.amountMicro) : "—"}</span>
        <span className="uppercase tracking-wider">{attempt.requirements?.network ?? ""}</span>
      </div>
      {signing && <div className="sy-pulse mt-3 font-mono text-sm font-bold uppercase tracking-[0.14em]">Signing…</div>}
    </motion.div>
  );
}

export function PaymentFlow({ state, className }: { state: RunState; className?: string }) {
  const active = activeAttempt(state);
  const attempt = active?.attempt;
  const mode = attempt?.mode ?? state.mode ?? "simulated";
  const progress = attempt ? reached(attempt) : 0;
  const failed = attempt?.stage === "failed";

  return (
    <Panel
      title="x402 payment flow"
      status={<ModeBadge mode={mode} />}
      className={className}
      bodyClassName="space-y-4"
    >
      {!attempt ? (
        <p className="font-mono text-xs text-muted">No purchase yet. The agent pays only after it decides.</p>
      ) : (
        <>
          <div className="flex items-center justify-between gap-2">
            <Label tone="paper">
              {nameOfProvider(state, attempt.providerId)} · {attempt.role.replace("_", " ")}
            </Label>
            <Label className="truncate">{attempt.endpoint}</Label>
          </div>

          <AnimatePresence mode="wait" initial={false}>
            {BIG_402.has(attempt.stage) ? (
              <Big402 attempt={attempt} />
            ) : attempt.stage === "verified" || attempt.stage === "executing" ? (
              <motion.div key="ok" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={MOTION.snap}
                className="border border-signal bg-surface p-4" role="status">
                <div className="font-mono text-2xl font-bold uppercase text-signal">Payment verified</div>
                {attempt.stage === "executing" && (
                  <div className="sy-pulse mt-1 font-mono text-xs uppercase tracking-wider text-data">Request executing…</div>
                )}
              </motion.div>
            ) : attempt.stage === "settled" ? (
              <motion.div key="settled" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={MOTION.snap}
                className="border border-signal bg-surface p-4" role="status">
                <div className="font-mono text-2xl font-bold uppercase text-signal">Request executed</div>
                <div className="tnum mt-2 break-all font-mono text-[11px] text-muted">
                  SETTLED {attempt.txRef}
                </div>
                {attempt.mode === "live" && attempt.explorerUrl ? (
                  <a className="mt-1 inline-block font-mono text-[11px] text-signal underline" href={attempt.explorerUrl} target="_blank" rel="noreferrer">
                    View on Solana Explorer (devnet)
                  </a>
                ) : (
                  <div className="mt-1 font-mono text-[11px] text-pay">SIMULATED — no blockchain transaction</div>
                )}
              </motion.div>
            ) : failed ? (
              <motion.div key="failed" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={MOTION.snap}
                className="border border-fail bg-surface p-4" role="alert">
                <div className="font-mono text-2xl font-bold uppercase text-fail">Failed · not charged</div>
                <div className="mt-1 font-mono text-[11px] text-muted">{attempt.error}</div>
              </motion.div>
            ) : (
              <motion.div key="req" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={MOTION.snap}
                className="border border-line p-4 font-mono text-xs text-muted">
                POST {attempt.endpoint} …
              </motion.div>
            )}
          </AnimatePresence>

          <ol className="space-y-1" aria-label="Payment steps">
            {RAIL.map((label, i) => {
              const done = progress > i;
              const current = progress === i && !failed && attempt.stage !== "settled";
              const isFailStep = failed && progress === i + 1 && i === progress - 1;
              return (
                <li key={label} className={cn("flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider",
                  done ? "text-paper" : current ? "text-pay" : "text-muted/50")}>
                  <span className={cn("grid size-4 place-items-center border", done ? "border-signal bg-signal text-ink" : "border-line-hi")}>
                    {done && !isFailStep ? <Check className="size-3" aria-hidden /> : isFailStep ? <X className="size-3 text-fail" aria-hidden /> : null}
                  </span>
                  {label}
                </li>
              );
            })}
          </ol>

          {attempt.checks && (
            <div>
              <Label>Spending policy</Label>
              <ul className="mt-2 space-y-1">
                {attempt.checks.map((c) => (
                  <li key={c.rule} className="flex items-center justify-between gap-3 font-mono text-[11px]">
                    <span className={c.ok ? "text-signal" : "text-fail"}>
                      {c.ok ? "●" : "✕"} {c.rule}
                    </span>
                    <span className="tnum truncate text-muted">{c.detail}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </Panel>
  );
}
