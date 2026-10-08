import type { Clock, PaymentMode } from "@/lib/types";
import { DemoPaymentRail } from "./demo-rail";
import { HybridPaymentRail } from "./hybrid-rail";
import type { PaymentRail } from "./rail";
import { liveConfig } from "./solana";
import { X402PaymentRail } from "./x402-rail";

declare global {
  var __rialtoLiveRail: X402PaymentRail | undefined;
}

/**
 * The live rail, or null when `PAYMENT_MODE` is not `live` or no payer wallet is configured.
 * One instance per process: it caches the payer key and the facilitator's fee payer.
 */
export function liveRail(clock: Clock): X402PaymentRail | null {
  const cfg = liveConfig();
  if (!cfg) return null;
  return (globalThis.__rialtoLiveRail ??= new X402PaymentRail(cfg, clock));
}

/** Simulation only, or simulation for demo providers plus real x402 for real sellers. */
export function getRail(clock: Clock): PaymentRail {
  const live = liveRail(clock);
  return live ? new HybridPaymentRail(new DemoPaymentRail(clock), live) : new DemoPaymentRail(clock);
}

export function currentMode(): PaymentMode {
  return liveConfig() ? "live" : "simulated";
}
