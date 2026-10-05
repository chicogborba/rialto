import type { RunEvent } from "./events";

/** Delay (ms) slept BEFORE each event is emitted. Scaled by the clock's speed. */
export const TIMING: Record<RunEvent["type"], number> = {
  "run.started": 400,
  "goal.parsed": 1400,
  "discovery.completed": 1500,
  "qualification.completed": 1300,
  "evaluation.scored": 2600,
  "decision.made": 2200,
  "plan.ready": 1200,
  "request.sent": 900,
  "payment.required": 1600,
  "policy.checked": 1400,
  "payment.signed": 1500,
  "payment.verified": 1200,
  "execution.started": 600,
  "execution.completed": 900, // max(this, provider latency)
  "execution.failed": 900,
  "payment.settled": 900,
  "wallet.updated": 500,
  "reputation.updated": 1200,
  "fallback.triggered": 1500,
  "run.completed": 800,
  "run.failed": 600,
};

/** Speed multipliers (1 = real time as in TIMING). */
export const SPEED = {
  fullDemo: 1.2,
  singleStep: 1,
  multiStep: 0.45,
  instant: 0,
} as const;

export const MOTION = {
  snap: { duration: 0.12, ease: [0.2, 0, 0, 1] as [number, number, number, number] },
  move: { type: "spring" as const, stiffness: 520, damping: 38 },
  draw: { duration: 0.5, ease: "easeInOut" as const },
  particleSeconds: 0.7,
} as const;
