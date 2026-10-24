import { beforeEach, describe, expect, it } from "vitest";
import { handleLiveCall, type LiveCallArgs } from "@/lib/gateway/live-call";
import { handleSimCall } from "@/lib/providers/sim-provider";
import { DemoPaymentRail } from "@/lib/x402/demo-rail";
import type { LiveGateway } from "@/lib/x402/live-server";
import { BuyerPaymentRail, secretBytes } from "@/lib/x402/live-client";
import type { PaymentRequirements, Settlement, X402Leg } from "@/lib/x402/rail";
import { FEE_PAYMENT_HEADER, FEE_REQUIRED_HEADER, parsePaymentRequired, paymentHeader, SIM_PAYMENT_HEADER, X402_PAYMENT_HEADER } from "@/lib/x402/sim-protocol";
import { explainRefusal, explorerAddress, explorerTx, isSolanaAddress, liveConfig, solanaNetwork } from "@/lib/x402/solana";
import type { Clock, Provider, Service } from "@/lib/types";

const clock: Clock = { now: () => 1_000, id: (p) => `${p}_1`, sleep: () => Promise.resolve() };
const SELLER = "AavcvScqne4DsEUd2m3MHhtEHFrQUwVYppocc1xKzbgR";
const FEE = "CsyMmfi7kqkEwbeVZYn6fVMVH4KMm62D1eDZxnTCeX6t";
const BUYER = "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU";

describe("which network payments settle on", () => {
  it("is devnet unless the server says mainnet", () => {
    expect(solanaNetwork({}).id).toBe("devnet");
    expect(solanaNetwork({ SOLANA_NETWORK: "devnet" }).id).toBe("devnet");
    expect(solanaNetwork({ SOLANA_NETWORK: "mainnet" }).id).toBe("mainnet");
    expect(solanaNetwork({ SOLANA_NETWORK: "Mainnet-Beta" }).id).toBe("mainnet");
    expect(solanaNetwork({ SOLANA_NETWORK: "nonsense" }).id).toBe("devnet");
    expect(solanaNetwork({ NEXT_PUBLIC_SOLANA_NETWORK: "mainnet" }).id).toBe("mainnet");
  });
  it("carries the chain id, the USDC mint and the money kind of each network", () => {
    const dev = solanaNetwork({});
    const main = solanaNetwork({ SOLANA_NETWORK: "mainnet" });
    expect(dev).toMatchObject({ name: "solana-devnet", caip2: "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1", usdc: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU", testMoney: true });
    expect(main).toMatchObject({ name: "solana-mainnet", caip2: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp", usdc: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", testMoney: false });
  });
  it("links the explorer with the cluster only where there is one", () => {
    const main = solanaNetwork({ SOLANA_NETWORK: "mainnet" });
    expect(explorerTx("abc", solanaNetwork({}))).toBe("https://explorer.solana.com/tx/abc?cluster=devnet");
    expect(explorerTx("abc", main)).toBe("https://explorer.solana.com/tx/abc");
    expect(explorerAddress("addr", main)).toBe("https://explorer.solana.com/address/addr");
  });
});

describe("live rail configuration", () => {
  it("needs PAYMENT_MODE=live and an address for the fee, and nothing secret", () => {
    expect(liveConfig({})).toBeNull();
    expect(liveConfig({ PAYMENT_MODE: "live" })).toBeNull();
    expect(liveConfig({ PAYMENT_MODE: "live", PLATFORM_FEE_PAYTO: "not an address" })).toBeNull();
    expect(liveConfig({ PAYMENT_MODE: "simulated", PLATFORM_FEE_PAYTO: FEE })).toBeNull();
    expect(liveConfig({ PAYMENT_MODE: "live", PLATFORM_FEE_PAYTO: FEE })).toMatchObject({ feePayTo: FEE, facilitatorUrl: "https://x402.org/facilitator", rpcUrl: "https://api.devnet.solana.com" });
  });
  it("picks a facilitator and an RPC that serve the network, and lets either be overridden", () => {
    const main = liveConfig({ PAYMENT_MODE: "live", PLATFORM_FEE_PAYTO: FEE, SOLANA_NETWORK: "mainnet" });
    expect(main?.network.id).toBe("mainnet");
    expect(main?.facilitatorUrl).toBe("https://facilitator.payai.network");
    expect(main?.rpcUrl).toBe("https://api.mainnet-beta.solana.com");
    const custom = liveConfig({ PAYMENT_MODE: "live", PLATFORM_FEE_PAYTO: FEE, SOLANA_NETWORK: "mainnet", X402_FACILITATOR_URL: "https://f.example", SOLANA_RPC_URL: "https://rpc.example" });
    expect(custom).toMatchObject({ facilitatorUrl: "https://f.example", rpcUrl: "https://rpc.example" });
  });
  it("tells real addresses from the demo providers' placeholders", () => {
    expect(isSolanaAddress(SELLER)).toBe(true);
    expect(isSolanaAddress("TEST_SELLER_NO_WALLET")).toBe(false);
    expect(isSolanaAddress("DEMO_AGENT_WALLET")).toBe(false);
  });
  it("names the wallet behind a refused payment when it is one of the usual two causes", () => {
    const refused = "invalid_exact_svm_transaction_simulation_failed";
    expect(explainRefusal(refused, null, 5, 2_000)).toBe("payer_insufficient_usdc");
    expect(explainRefusal(refused, 1_999, 5, 2_000)).toBe("payer_insufficient_usdc");
    expect(explainRefusal(refused, 2_000, null, 2_000)).toBe("payee_has_no_usdc_account");
    expect(explainRefusal(refused, 2_000, 0, 2_000)).toBe(refused);
  });
});

describe("the buyer's key", () => {
  it("reads a base58 secret and the JSON array solana-keygen writes", () => {
    const bytes = Array.from({ length: 64 }, (_, i) => i + 1);
    expect(Array.from(secretBytes(JSON.stringify(bytes)))).toEqual(bytes);
    expect(secretBytes("  3yZe7d  ").length).toBeGreaterThan(0);
  });
  it("refuses to pay for a seller that sent no x402 requirements", async () => {
    const rail = new BuyerPaymentRail({ address: BUYER } as never, "https://rpc.example");
    await expect(rail.requestPayment({ scheme: "exact", network: "solana-devnet", asset: "USDC", amountMicro: 3_000, payTo: SELLER, resource: "/r", description: "d" })).rejects.toThrow("no x402 requirements");
  });
});

describe("wire protocol", () => {
  it("uses the x402 header on the live rail and the sim header otherwise", () => {
    expect(paymentHeader("live")).toBe(X402_PAYMENT_HEADER);
    expect(paymentHeader("simulated")).toBe(SIM_PAYMENT_HEADER);
  });
  const leg = (amount: string, payTo: string): X402Leg => ({ scheme: "exact", network: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp", asset: "mint", amount, payTo, maxTimeoutSeconds: 60, extra: { feePayer: "FP" } });
  const base = { scheme: "exact", network: "solana-mainnet", asset: "USDC", amountMicro: 3_000, payTo: SELLER, resource: "/r", description: "d" };
  it("keeps what the buyer has to sign when a 402 is parsed", () => {
    const x402 = { seller: leg("2000", SELLER), fee: leg("1000", FEE) };
    expect(parsePaymentRequired({ accepts: [{ ...base, live: true, settleMicro: 2_000, feePayTo: FEE, x402 }] })).toEqual({ ...base, live: true, settleMicro: 2_000, feePayTo: FEE, x402 });
    expect(parsePaymentRequired({ accepts: [base] })).toEqual(base);
  });
  it("drops what is malformed, and refuses a network it does not know", () => {
    expect(parsePaymentRequired({ accepts: [{ ...base, live: "yes", settleMicro: -5, x402: { seller: { scheme: "nope" } } }] })).toEqual(base);
    expect(parsePaymentRequired({ accepts: [{ ...base, network: "solana-testnet" }] })).toBeNull();
  });
});

const provider: Provider = { id: "p1", slug: "pokedex", name: "PokéDex", description: "", network: "solana-devnet", x402Enabled: true, status: "online", qualityScore: 95, reputationScore: 80, successRate: 100, latencyMs: 300, requestCount: 0, isDemo: false, settlement: "live" };
const service: Service = { id: "s1", providerId: "p1", capability: "data.lookup", endpoint: "/api/gw/pokedex/data.lookup", priceMicro: 3_000, capabilityMatch: 1, inputSchema: "{}", outputSchema: "{}" };

describe("a simulated provider's call", () => {
  it("answers 402 with the simulation's requirements and settles with a sim reference", async () => {
    const rail = new DemoPaymentRail(clock);
    const args = { provider, service, payTo: "DEMO_p1", demoFailFirstCall: false, headers: {}, body: {}, rail, failedOnce: new Set<string>() };
    const unpaid = await handleSimCall(args);
    expect(unpaid.status).toBe(402);
    const req = parsePaymentRequired(unpaid.json) as PaymentRequirements;
    const auth = await rail.requestPayment(req, {} as never);
    const paid = await handleSimCall({ ...args, headers: { [SIM_PAYMENT_HEADER]: auth.payload } });
    expect(paid.status).toBe(200);
    expect(paid.json).toMatchObject({ settlement: { mode: "simulated", explorerUrl: null } });
  });
});

/** Stands in for the facilitator: accepts payloads that start with "ok", names their payer after the suffix. */
class FakeGateway {
  settled: string[] = [];
  failSeller = false;
  failFee = false;
  cfg = { feePayTo: FEE, network: solanaNetwork({}) };
  legsFor(req: PaymentRequirements): Promise<{ seller: X402Leg; fee?: X402Leg }> {
    const sellerMicro = req.settleMicro ?? req.amountMicro;
    const fee = req.amountMicro - sellerMicro;
    const leg = (amount: number, payTo: string): X402Leg => ({ scheme: "exact", network: "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1", asset: "mint", amount: String(amount), payTo, maxTimeoutSeconds: 60, extra: { feePayer: "FP" } });
    return Promise.resolve({ seller: leg(sellerMicro, req.payTo), ...(fee > 0 ? { fee: leg(fee, FEE) } : {}) });
  }
  requiredHeader(): Record<string, string> {
    return { "payment-required": "encoded" };
  }
  verifyLeg(header: string): Promise<{ ok: true; payer: string } | { ok: false; reason: string }> {
    return Promise.resolve(header.startsWith("ok") ? { ok: true, payer: header.split(":")[1] ?? "BUYER" } : { ok: false, reason: "invalid_payment" });
  }
  settleLeg(header: string, wanted: X402Leg): Promise<Settlement> {
    const isFee = wanted.payTo === FEE;
    if (isFee ? this.failFee : this.failSeller) return Promise.reject(new Error("blockhash_expired"));
    this.settled.push(`${isFee ? "fee" : "seller"}:${wanted.amount}`);
    return Promise.resolve({ mode: "live", txRef: isFee ? "feeSig" : "sellerSig", explorerUrl: explorerTx(isFee ? "feeSig" : "sellerSig"), settledAt: 1_000 });
  }
  responseHeader(): Record<string, string> {
    return {};
  }
}

let nonce = 0;
const call = (gw: FakeGateway, headers: Record<string, string>, produce: LiveCallArgs["produce"] = () => Promise.resolve({ name: "pikachu" })) =>
  handleLiveCall({ gateway: gw as unknown as LiveGateway, provider, service, sellerMicro: 2_000, payTo: SELLER, resourceUrl: "https://rialto.test/api/gw/pokedex/data.lookup", headers, body: {}, produce });
/** Payment headers that have never been seen: the gateway refuses a payment it has already served. */
const pay = (payer = "BUYER") => ({ [X402_PAYMENT_HEADER]: `ok:${payer}:${++nonce}`, [FEE_PAYMENT_HEADER]: `ok:${payer}:fee${nonce}` });

describe("a real seller's gateway call on the live rail", () => {
  // the same fake wallet pays in every test: forget its unsettled payments between them
  beforeEach(() => globalThis.__rialtoUnpaidStrikes?.clear());
  it("answers 402 with both payments: the seller's price to the seller, the commission to Rialto", async () => {
    const out = await call(new FakeGateway(), {});
    expect(out.status).toBe(402);
    expect(out.json).toMatchObject({
      simulated: false,
      accepts: [{ amountMicro: 3_000, settleMicro: 2_000, payTo: SELLER, feePayTo: FEE, live: true, description: "PokéDex · data.lookup", x402: { seller: { amount: "2000", payTo: SELLER }, fee: { amount: "1000", payTo: FEE } } }],
    });
    expect(out.headers["payment-required"]).toBeDefined();
    expect(out.headers[FEE_REQUIRED_HEADER]).toBeDefined();
  });
  it("ignores a simulated payment header", async () => {
    expect((await call(new FakeGateway(), { [SIM_PAYMENT_HEADER]: "sim_auth_x" })).status).toBe(402);
  });
  it("asks again when only the seller's payment came, and never calls the API", async () => {
    let called = false;
    const out = await call(new FakeGateway(), { [X402_PAYMENT_HEADER]: `ok:BUYER:${++nonce}` }, () => ((called = true), Promise.resolve({})));
    expect(out.status).toBe(402);
    expect(called).toBe(false);
  });
  it("verifies both, calls the API, then settles the seller first and Rialto second", async () => {
    const gw = new FakeGateway();
    const out = await call(gw, pay());
    expect(out.status).toBe(200);
    expect(out.json).toMatchObject({ result: { name: "pikachu" }, settlement: { txRef: "sellerSig" }, feeSettlement: { txRef: "feeSig" } });
    expect(gw.settled).toEqual(["seller:2000", "fee:1000"]);
    expect(out.outcome).toMatchObject({ status: "settled", payer: "BUYER" });
  });
  it("refuses a payment the facilitator would not accept, on either leg", async () => {
    const bad = await call(new FakeGateway(), { [X402_PAYMENT_HEADER]: `bad:${++nonce}`, [FEE_PAYMENT_HEADER]: `ok:BUYER:${nonce}` });
    expect(bad.json).toMatchObject({ reason: "invalid_payment" });
    const badFee = await call(new FakeGateway(), { [X402_PAYMENT_HEADER]: `ok:BUYER:${++nonce}`, [FEE_PAYMENT_HEADER]: `bad:${nonce}` });
    expect(badFee.json).toMatchObject({ reason: "fee_invalid_payment" });
  });
  it("refuses two payments that come from different wallets", async () => {
    const out = await call(new FakeGateway(), { [X402_PAYMENT_HEADER]: `ok:ALICE:${++nonce}`, [FEE_PAYMENT_HEADER]: `ok:BOB:${nonce}` });
    expect(out.json).toMatchObject({ reason: "payments_from_different_wallets" });
  });
  it("serves a signed payment once", async () => {
    const gw = new FakeGateway();
    const headers = pay();
    expect((await call(gw, headers)).status).toBe(200);
    const again = await call(gw, headers);
    expect(again.status).toBe(402);
    expect(again.json).toMatchObject({ reason: "payment_already_used" });
  });
  it("settles nothing when the seller's API fails, and says so in the outcome", async () => {
    const gw = new FakeGateway();
    const out = await call(gw, pay(), () => Promise.reject(new Error("upstream_404")));
    expect(out.status).toBe(502);
    expect(gw.settled).toEqual([]);
    expect(out.outcome).toMatchObject({ status: "failed_not_charged", error: "upstream_404" });
  });
  it("returns no result, and takes no commission, when the seller's payment does not land", async () => {
    const gw = new FakeGateway();
    gw.failSeller = true;
    const out = await call(gw, pay());
    expect(out.status).toBe(402);
    expect(out.json).toMatchObject({ reason: "settlement_failed: blockhash_expired" });
    expect(JSON.stringify(out.json)).not.toContain("pikachu");
    expect(gw.settled).toEqual([]);
  });
  it("refuses new work to a wallet that left two payments unsettled within the hour", async () => {
    const gw = new FakeGateway();
    let calls = 0;
    const work = () => ((calls += 1), Promise.resolve({ ok: true }));
    gw.failSeller = true;
    await call(gw, { ...pay(), "x-run-id": `run_${++nonce}` }, work);
    await call(gw, { ...pay(), "x-run-id": `run_${++nonce}` }, work);
    gw.failSeller = false;
    const third = await call(gw, { ...pay(), "x-run-id": `run_${++nonce}` }, work);
    expect(third.status).toBe(402);
    expect(JSON.stringify(third.json)).toContain("too_many_unsettled_payments");
    expect(calls).toBe(2);
  });
  it("keeps a finished result when the payment expired meanwhile, and hands it over for the next payment", async () => {
    const gw = new FakeGateway();
    let calls = 0;
    const slow = () => ((calls += 1), Promise.resolve({ video: "https://f.example/v.mp4" }));
    const run = { "x-run-id": `run_${++nonce}` };
    gw.failSeller = true;
    const first = await call(gw, { ...pay(), ...run }, slow);
    expect(first.status).toBe(402);
    expect(JSON.stringify(first.json)).not.toContain("v.mp4");
    gw.failSeller = false;
    const second = await call(gw, { ...pay(), ...run }, slow);
    expect(second.status).toBe(200);
    expect(second.json).toMatchObject({ result: { video: "https://f.example/v.mp4" } });
    expect(calls).toBe(1);
  });
  it("still delivers when only the commission does not land: that loss is Rialto's", async () => {
    const gw = new FakeGateway();
    gw.failFee = true;
    const out = await call(gw, pay());
    expect(out.status).toBe(200);
    expect(out.json).toMatchObject({ settlement: { txRef: "sellerSig" }, feeSettlement: null });
    expect(out.outcome?.fee).toBeNull();
  });
});
