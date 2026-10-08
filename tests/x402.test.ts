import { describe, expect, it } from "vitest";
import { handleSimCall } from "@/lib/providers/sim-provider";
import { DemoPaymentRail } from "@/lib/x402/demo-rail";
import { HybridPaymentRail } from "@/lib/x402/hybrid-rail";
import type { PaymentAuthorization, PaymentRail, PaymentRequirements, Settlement, VerifyResult } from "@/lib/x402/rail";
import { parsePaymentRequired, paymentHeader, SIM_PAYMENT_HEADER, X402_PAYMENT_HEADER } from "@/lib/x402/sim-protocol";
import { explorerTx, isSolanaAddress, liveConfig } from "@/lib/x402/solana";
import type { Clock, Provider, Service, WalletState } from "@/lib/types";

const clock: Clock = { now: () => 1_000, id: (p) => `${p}_1`, sleep: () => Promise.resolve() };
const wallet = {} as WalletState;
const SELLER = "AavcvScqne4DsEUd2m3MHhtEHFrQUwVYppocc1xKzbgR";

/** Stands in for the facilitator: accepts one known payload, counts what it settled. */
class FakeLiveRail implements PaymentRail {
  readonly mode = "live" as const;
  settledMicro: number[] = [];
  failSettle = false;
  requestPayment(_req: PaymentRequirements): Promise<PaymentAuthorization> {
    return Promise.resolve({ mode: "live", payload: "signed-tx", payer: "PAYER" });
  }
  verifyPayment(auth: PaymentAuthorization): Promise<VerifyResult> {
    return Promise.resolve(auth.payload === "signed-tx" ? { ok: true } : { ok: false, reason: "invalid_payment" });
  }
  settlePayment(_auth: PaymentAuthorization, req: PaymentRequirements): Promise<Settlement> {
    if (this.failSettle) return Promise.reject(new Error("blockhash_expired"));
    this.settledMicro.push(req.settleMicro ?? req.amountMicro);
    return Promise.resolve({ mode: "live", txRef: "5igSig", explorerUrl: explorerTx("5igSig"), settledAt: 1_000 });
  }
}

const provider: Provider = { id: "p1", slug: "pokedex", name: "PokéDex", description: "", network: "solana-devnet", x402Enabled: true, status: "online", qualityScore: 95, reputationScore: 80, successRate: 100, latencyMs: 300, requestCount: 0, isDemo: false };
const service: Service = { id: "s1", providerId: "p1", capability: "data.lookup", endpoint: "/api/gw/pokedex/data.lookup", priceMicro: 3_000, capabilityMatch: 1, inputSchema: "{}", outputSchema: "{}" };
const call = (rail: PaymentRail, headers: Record<string, string>, produce: () => Promise<unknown> = () => Promise.resolve({ name: "pikachu" })) =>
  handleSimCall({ provider, service, payTo: SELLER, demoFailFirstCall: false, headers, body: {}, rail, failedOnce: new Set(), produce, live: { settleMicro: 2_000 } });

describe("live rail configuration", () => {
  it("is off unless PAYMENT_MODE is live and a payer key is set", () => {
    expect(liveConfig({})).toBeNull();
    expect(liveConfig({ PAYMENT_MODE: "live" })).toBeNull();
    expect(liveConfig({ PAYMENT_MODE: "simulated", SOLANA_PAYER_SECRET_KEY: "k" })).toBeNull();
    expect(liveConfig({ PAYMENT_MODE: "live", SOLANA_PAYER_SECRET_KEY: "k" })).toEqual({ facilitatorUrl: "https://x402.org/facilitator", rpcUrl: "https://api.devnet.solana.com", payerSecret: "k" });
  });
  it("tells real addresses from the demo providers' placeholders", () => {
    expect(isSolanaAddress(SELLER)).toBe(true);
    expect(isSolanaAddress("TEST_SELLER_NO_WALLET")).toBe(false);
    expect(isSolanaAddress("DEMO_AGENT_WALLET")).toBe(false);
  });
  it("links settlements to the devnet explorer", () => {
    expect(explorerTx("abc")).toBe("https://explorer.solana.com/tx/abc?cluster=devnet");
  });
});

describe("wire protocol", () => {
  it("uses the x402 header on the live rail and the sim header otherwise", () => {
    expect(paymentHeader("live")).toBe(X402_PAYMENT_HEADER);
    expect(paymentHeader("simulated")).toBe(SIM_PAYMENT_HEADER);
  });
  it("keeps `live` and the on-chain amount when a 402 is parsed", () => {
    const base = { scheme: "exact", network: "solana-devnet", asset: "USDC", amountMicro: 3_000, payTo: SELLER, resource: "/r", description: "d" };
    expect(parsePaymentRequired({ accepts: [{ ...base, live: true, settleMicro: 2_000 }] })).toEqual({ ...base, live: true, settleMicro: 2_000 });
    expect(parsePaymentRequired({ accepts: [base] })).toEqual(base);
    expect(parsePaymentRequired({ accepts: [{ ...base, live: "yes", settleMicro: -5 }] })).toEqual(base);
  });
});

describe("hybrid rail", () => {
  const live = new FakeLiveRail();
  const rail = new HybridPaymentRail(new DemoPaymentRail(clock), live);
  const req: PaymentRequirements = { scheme: "exact", network: "solana-devnet", asset: "USDC", amountMicro: 3_000, payTo: SELLER, resource: "/r", description: "d" };

  it("pays demo providers on the simulation and real sellers on the live rail", async () => {
    expect((await rail.requestPayment(req, wallet)).mode).toBe("simulated");
    expect((await rail.requestPayment({ ...req, live: true }, wallet)).mode).toBe("live");
  });
  it("never accepts a simulated payment for a live requirement, or the reverse", async () => {
    const sim = await rail.requestPayment(req, wallet);
    const real = await rail.requestPayment({ ...req, live: true }, wallet);
    expect(await rail.verifyPayment(sim, { ...req, live: true })).toEqual({ ok: false, reason: "wrong_rail" });
    expect(await rail.verifyPayment(real, req)).toEqual({ ok: false, reason: "wrong_rail" });
    await expect(rail.settlePayment(sim, { ...req, live: true })).rejects.toThrow("wrong_rail");
  });
});

describe("a real seller's gateway call on the live rail", () => {
  it("answers 402 with live requirements: the buyer price, and the seller price to move on-chain", async () => {
    const out = await call(new FakeLiveRail(), {});
    expect(out.status).toBe(402);
    expect(out.json).toMatchObject({ simulated: false, accepts: [{ amountMicro: 3_000, settleMicro: 2_000, payTo: SELLER, live: true, description: "PokéDex · data.lookup" }] });
  });
  it("ignores a simulated payment header", async () => {
    expect((await call(new FakeLiveRail(), { [SIM_PAYMENT_HEADER]: "sim_auth_x" })).status).toBe(402);
  });
  it("verifies, calls the API, then settles the seller price and returns the signature", async () => {
    const rail = new FakeLiveRail();
    const out = await call(rail, { [X402_PAYMENT_HEADER]: "signed-tx" });
    expect(out.status).toBe(200);
    expect(out.json).toMatchObject({ result: { name: "pikachu" }, settlement: { mode: "live", txRef: "5igSig", explorerUrl: "https://explorer.solana.com/tx/5igSig?cluster=devnet" } });
    expect(rail.settledMicro).toEqual([2_000]);
  });
  it("does not settle when the seller's API fails", async () => {
    const rail = new FakeLiveRail();
    const out = await call(rail, { [X402_PAYMENT_HEADER]: "signed-tx" }, () => Promise.reject(new Error("upstream_404")));
    expect(out.status).toBe(502);
    expect(rail.settledMicro).toEqual([]);
  });
  it("returns no result when the payment does not land", async () => {
    const rail = new FakeLiveRail();
    rail.failSettle = true;
    const out = await call(rail, { [X402_PAYMENT_HEADER]: "signed-tx" });
    expect(out.status).toBe(402);
    expect(out.json).toMatchObject({ reason: "settlement_failed: blockhash_expired" });
    expect(JSON.stringify(out.json)).not.toContain("pikachu");
  });
});
