import type { Clock, WalletState } from "@/lib/types";
import { fnv128 } from "./hash";
import type {
  PaymentAuthorization,
  PaymentRail,
  PaymentRequirements,
  Settlement,
  VerifyResult,
} from "./rail";

function reqHash(req: PaymentRequirements): string {
  return fnv128(`${req.network}|${req.asset}|${req.amountMicro}|${req.payTo}|${req.resource}`);
}

/** Simulation rail. No network calls, no chain. Settlement refs are prefixed `sim_`. */
export class DemoPaymentRail implements PaymentRail {
  readonly mode = "simulated" as const;
  constructor(private readonly clock: Clock) {}

  requestPayment(req: PaymentRequirements, _wallet: WalletState): Promise<PaymentAuthorization> {
    return Promise.resolve({
      mode: "simulated",
      payload: `sim_auth_${reqHash(req)}_${this.clock.id("n")}`,
      payer: "DEMO_AGENT_WALLET",
    });
  }

  verifyPayment(auth: PaymentAuthorization, req: PaymentRequirements): Promise<VerifyResult> {
    if (!auth.payload.startsWith("sim_auth_")) return Promise.resolve({ ok: false, reason: "bad_payload" });
    if (!auth.payload.includes(reqHash(req))) return Promise.resolve({ ok: false, reason: "amount_or_payee_mismatch" });
    return Promise.resolve({ ok: true });
  }

  settlePayment(auth: PaymentAuthorization, req: PaymentRequirements): Promise<Settlement> {
    return Promise.resolve({
      mode: "simulated",
      txRef: `sim_${fnv128(`${auth.payload}|${req.resource}|settle`)}`,
      explorerUrl: null,
      settledAt: this.clock.now(),
    });
  }
}
