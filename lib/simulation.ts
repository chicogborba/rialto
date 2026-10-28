import { HttpError } from "@/lib/http";
import { currentMode } from "@/lib/x402";

/** Simulation is a development tool, never a production payment option. */
export function simulationAllowed(): boolean {
  return process.env.NODE_ENV !== "production" && currentMode() !== "live";
}

export function requireSimulation(): void {
  if (!simulationAllowed()) throw new HttpError(403, "simulation_disabled", "Simulation is disabled. Connect a USDC wallet to pay for APIs.");
}
