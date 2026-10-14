import type { Clock, PaymentMode } from "@/lib/types";
import { DemoPaymentRail } from "./demo-rail";
import { LiveGateway } from "./live-server";
import type { PaymentRail } from "./rail";
import { liveConfig } from "./solana";

declare global {
  var __rialtoLiveGateway: LiveGateway | undefined;
}

/**
 * The live gateway, or null when `PAYMENT_MODE` is not `live` or no fee address is configured.
 * One instance per process: it caches the facilitator's fee payer.
 */
export function liveGateway(clock: Clock): LiveGateway | null {
  const cfg = liveConfig();
  if (!cfg) return null;
  return (globalThis.__rialtoLiveGateway ??= new LiveGateway(cfg, clock));
}

/**
 * The rail Rialto's own orchestrator pays on: always the simulation. Real payments are made by the
 * buyer's wallet, outside this server (see `BuyerPaymentRail`), and never from a balance held here.
 */
export function getRail(clock: Clock): PaymentRail {
  return new DemoPaymentRail(clock);
}

/** `live` when real sellers are paid on-chain by their buyers; `simulated` otherwise. */
export function currentMode(): PaymentMode {
  return liveConfig() ? "live" : "simulated";
}
