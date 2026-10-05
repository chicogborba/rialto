import { handleSimCall } from "./sim-provider";
import type { Candidate, Service } from "@/lib/types";
import type { PaymentRail } from "@/lib/x402/rail";
import type { Executor } from "@/lib/agent/run";

/** Calls the simulated provider logic directly (no HTTP). Used by tests and the run recorder. */
export function createInProcessExecutor(
  candidates: Candidate[],
  rail: PaymentRail,
  payToOf: (providerId: string) => string = (id) => `DEMO_${id}`,
  failFirstServiceIds: ReadonlySet<string> = new Set(),
): Executor {
  const failedOnce = new Set<string>();
  return {
    async call(service: Service, body: unknown, headers: Record<string, string>) {
      const c = candidates.find((x) => x.service.id === service.id);
      if (!c) return { status: 404, json: { error: "unknown_service" }, headers: {} };
      return handleSimCall({
        provider: c.provider,
        service: c.service,
        payTo: payToOf(c.provider.id),
        demoFailFirstCall: failFirstServiceIds.has(service.id),
        headers,
        body,
        rail,
        failedOnce,
      });
    },
  };
}
