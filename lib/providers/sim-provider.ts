import { buildMockResult } from "./mock-results";
import type { PaymentRail, PaymentRequirements } from "@/lib/x402/rail";
import {
  SIM_PAYMENT_HEADER,
  SIM_SETTLEMENT_HEADER,
  RUN_ID_HEADER,
  type SimPaymentRequiredBody,
  type SimSuccessBody,
} from "@/lib/x402/sim-protocol";
import type { Provider, Service } from "@/lib/types";

export interface SimResponse {
  status: number;
  json: unknown;
  headers: Record<string, string>;
}

export interface SimCallArgs {
  provider: Provider;
  service: Service;
  payTo: string;
  demoFailFirstCall: boolean;
  headers: Record<string, string>;
  body: unknown;
  rail: PaymentRail;
  /** Mutable set of "runId:serviceId" keys that already failed once. */
  failedOnce: Set<string>;
  /** Real work to run instead of the canned result (e.g. calling an actual public API). A throw means "failed, not charged". */
  produce?: (body: unknown) => Promise<unknown>;
}

/**
 * Provider side of the simulated protocol. Order mirrors x402: verify → execute → settle.
 * A failed execution is never settled (agent is not charged). Does not sleep; latency is simulated by the agent.
 */
export async function handleSimCall(a: SimCallArgs): Promise<SimResponse> {
  const requirements: PaymentRequirements = {
    scheme: "exact",
    network: a.provider.network,
    asset: "USDC",
    amountMicro: a.service.priceMicro,
    payTo: a.payTo,
    resource: a.service.endpoint,
    description: `${a.provider.name} · ${a.service.capability} (DEMO PROVIDER)`,
  };

  const payload = a.headers[SIM_PAYMENT_HEADER];
  if (!payload) {
    const body: SimPaymentRequiredBody = { simulated: true, accepts: [requirements] };
    return { status: 402, json: body, headers: {} };
  }

  const auth = { mode: "simulated" as const, payload, payer: "unknown" };
  const verified = await a.rail.verifyPayment(auth, requirements);
  if (!verified.ok) {
    const body: SimPaymentRequiredBody = { simulated: true, accepts: [requirements], reason: verified.reason };
    return { status: 402, json: body, headers: {} };
  }

  const runId = a.headers[RUN_ID_HEADER] ?? "no-run";
  const failKey = `${runId}:${a.service.id}`;
  if (a.demoFailFirstCall && !a.failedOnce.has(failKey)) {
    a.failedOnce.add(failKey);
    return { status: 503, json: { error: "upstream_timeout", simulated: true }, headers: {} };
  }

  let result: unknown;
  try {
    result = a.produce ? await a.produce(a.body) : buildMockResult(a.service.capability, a.provider.name, a.body);
  } catch (e) {
    // failed after verification: nothing is settled, the agent is not charged
    return { status: 502, json: { error: e instanceof Error ? e.message : "upstream_error", simulated: true }, headers: {} };
  }
  const settlement = await a.rail.settlePayment(auth, requirements);
  const body: SimSuccessBody = { result, settlement };
  return { status: 200, json: body, headers: { [SIM_SETTLEMENT_HEADER]: settlement.txRef } };
}
