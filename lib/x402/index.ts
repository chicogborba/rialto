import type { Clock, PaymentMode } from "@/lib/types";
import { DemoPaymentRail } from "./demo-rail";
import type { PaymentRail } from "./rail";

/** Currently always the simulation rail. Live mode is gated behind Phase 8 (see plan.md). */
export function getRail(clock: Clock): PaymentRail {
  return new DemoPaymentRail(clock);
}

export function currentMode(): PaymentMode {
  return "simulated";
}
