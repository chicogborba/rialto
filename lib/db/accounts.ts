import { z } from "zod";
import { isCapabilityId } from "@/lib/agent/capabilities";
import { feeConfigFromEnv, splitFromSellerPrice } from "@/lib/billing/fees";
import { HttpError } from "@/lib/http";
import { toMicro } from "@/lib/money";
import { assertPublicUrl, UnsafeUpstreamError } from "@/lib/security/ssrf";
import { generateKey } from "@/lib/security/keys";
import { encryptSecret } from "@/lib/security/secrets";
import { defaultPolicy } from "@/lib/wallet/policy";
import { randomBytes } from "node:crypto";
import { SCHEMAS, slugify } from "../../prisma/seed-data";
import { prisma } from "./client";
import { topUpWallet } from "./repo";
import type { CapabilityId } from "@/lib/types";

const TEST_CREDIT_MICRO = Number(process.env.TEST_CREDIT_MICRO ?? 1_000_000);
const MIN_PAYOUT_MICRO = Number(process.env.MIN_PAYOUT_MICRO ?? 10_000);
const MAX_APIS_PER_SELLER = 20;

// ---------- buyers ----------

export const CreateBuyerSchema = z.object({ name: z.string().trim().min(1).max(40).default("My agent") });

export async function createBuyer(name: string): Promise<{ agentId: string; apiKey: string; balanceMicro: number }> {
  const k = generateKey("buyer");
  const id = `agent_${randomBytes(8).toString("hex")}`;
  await prisma.agent.create({
    data: { id, name, balanceMicro: 0, policy: JSON.stringify(defaultPolicy()), keyHash: k.hash, keyPrefix: k.prefix },
  });
  // simulated-mode starter credit so the first call works; real deposits arrive with the live rail
  const w = await topUpWallet(id, TEST_CREDIT_MICRO, "starter test credit");
  return { agentId: id, apiKey: k.key, balanceMicro: w.balanceMicro };
}

// ---------- sellers ----------

export const CreateSellerSchema = z.object({
  name: z.string().trim().min(2).max(40),
  email: z.string().trim().email().optional(),
  /** Solana address that receives payouts */
  payoutAddress: z.string().trim().regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/, "Not a valid Solana address"),
});

export async function createSeller(input: z.infer<typeof CreateSellerSchema>): Promise<{ sellerId: string; apiKey: string }> {
  const k = generateKey("seller");
  const seller = await prisma.seller.create({
    data: { name: input.name, email: input.email, payoutAddress: input.payoutAddress, keyHash: k.hash, keyPrefix: k.prefix },
  });
  return { sellerId: seller.id, apiKey: k.key };
}

export const SellerApiSchema = z.object({
  name: z.string().trim().min(2).max(40),
  description: z.string().trim().min(5).max(200),
  capability: z.string().refine(isCapabilityId, "Unknown capability"),
  upstreamUrl: z.string().trim().url().max(500),
  method: z.enum(["GET", "POST"]).default("GET"),
  bodyTemplate: z.string().max(2000).optional(),
  /** secret headers sent upstream, e.g. { "x-api-key": "…" }; stored encrypted, never returned */
  headers: z.record(z.string().regex(/^[A-Za-z0-9-]{1,40}$/), z.string().max(500)).refine((h) => Object.keys(h).length <= 5, "At most 5 headers").optional(),
  resultPick: z.string().max(500).optional(),
  priceUsd: z.number().min(0.0001).max(5),
  latencyMs: z.number().int().min(1).max(60_000).default(500),
  quality: z.number().min(0).max(100).default(80),
});
export type SellerApiInput = z.infer<typeof SellerApiSchema>;

export async function registerSellerApi(sellerId: string, input: SellerApiInput) {
  const seller = await prisma.seller.findUnique({ where: { id: sellerId }, include: { _count: { select: { providers: true } } } });
  if (!seller) throw new HttpError(404, "no_seller", "Seller not found");
  if (seller._count.providers >= MAX_APIS_PER_SELLER) throw new HttpError(400, "limit", `You can publish up to ${MAX_APIS_PER_SELLER} APIs`);
  try {
    await assertPublicUrl(input.upstreamUrl.replace(/\{\w+\}/g, "x"));
  } catch (e) {
    if (e instanceof UnsafeUpstreamError) throw new HttpError(400, "unsafe_upstream", e.message);
    throw e;
  }
  const capability = input.capability as CapabilityId;
  const split = splitFromSellerPrice(toMicro(input.priceUsd), feeConfigFromEnv());

  let slug = slugify(input.name) || "api";
  const taken = await prisma.provider.count({ where: { slug: { startsWith: slug } } });
  if (taken > 0) slug = `${slug}${taken + 1}`;

  const provider = await prisma.provider.create({
    data: {
      slug,
      name: input.name,
      description: input.description,
      network: "solana-devnet",
      x402Enabled: true,
      status: "online",
      qualityScore: input.quality,
      reputationScore: 50,
      successRate: 100,
      latencyMs: input.latencyMs,
      requestCount: 0,
      isDemo: false,
      payTo: seller.payoutAddress,
      sellerId,
      services: {
        create: {
          capability,
          endpoint: `/api/gw/${slug}/${capability}`,
          priceMicro: split.buyerMicro,
          sellerPriceMicro: split.sellerMicro,
          capabilityMatch: 1,
          upstreamUrl: input.upstreamUrl,
          upstreamMethod: input.method,
          upstreamBody: input.bodyTemplate ?? null,
          upstreamHeaders: input.headers && Object.keys(input.headers).length ? encryptSecret(JSON.stringify(input.headers)) : null,
          resultPick: input.resultPick || null,
          inputSchema: SCHEMAS[capability].input,
          outputSchema: SCHEMAS[capability].output,
        },
      },
    },
    include: { services: true },
  });
  return { provider, split };
}

export async function getSellerOverview(sellerId: string) {
  const [seller, apis, txs, ledger] = await Promise.all([
    prisma.seller.findUnique({ where: { id: sellerId } }),
    prisma.provider.findMany({ where: { sellerId }, include: { services: true }, orderBy: { createdAt: "desc" } }),
    prisma.transaction.findMany({ where: { sellerId }, orderBy: { createdAt: "desc" }, take: 200, select: { status: true, sellerMicro: true, feeMicro: true, amountMicro: true, providerId: true, createdAt: true, capability: true } }),
    prisma.ledgerEntry.findMany({ where: { sellerId }, orderBy: { id: "desc" }, take: 20 }),
  ]);
  if (!seller) throw new HttpError(404, "no_seller", "Seller not found");
  const settled = txs.filter((t) => t.status === "settled");
  const perApi = new Map<string, { calls: number; earnedMicro: number }>();
  for (const t of settled) {
    const cur = perApi.get(t.providerId) ?? { calls: 0, earnedMicro: 0 };
    cur.calls += 1;
    cur.earnedMicro += t.sellerMicro;
    perApi.set(t.providerId, cur);
  }
  return {
    seller: { id: seller.id, name: seller.name, payoutAddress: seller.payoutAddress, keyPrefix: seller.keyPrefix, balanceMicro: seller.balanceMicro, paidOutMicro: seller.paidOutMicro },
    totals: {
      calls: settled.length,
      failedNotCharged: txs.filter((t) => t.status === "failed_not_charged").length,
      earnedMicro: settled.reduce((s, t) => s + t.sellerMicro, 0),
      platformFeeMicro: settled.reduce((s, t) => s + t.feeMicro, 0),
      grossMicro: settled.reduce((s, t) => s + t.amountMicro, 0),
    },
    apis: apis.map((p) => ({
      id: p.id,
      slug: p.slug,
      name: p.name,
      status: p.status,
      reputation: p.reputationScore,
      services: p.services.map((s) => ({ capability: s.capability, sellerPriceMicro: s.sellerPriceMicro, buyerPriceMicro: s.priceMicro, upstreamUrl: s.upstreamUrl, hasSecretHeaders: Boolean(s.upstreamHeaders), resultPick: s.resultPick })),
      ...(perApi.get(p.id) ?? { calls: 0, earnedMicro: 0 }),
    })),
    ledger: ledger.map((l) => ({ id: l.id, at: l.createdAt.toISOString(), kind: l.kind, amountMicro: l.amountMicro, note: l.note })),
    minPayoutMicro: MIN_PAYOUT_MICRO,
  };
}

/** Simulated payout. With the live rail this becomes an on-chain USDC transfer from the treasury. */
export async function requestPayout(sellerId: string, amountMicro?: number) {
  const seller = await prisma.seller.findUnique({ where: { id: sellerId } });
  if (!seller) throw new HttpError(404, "no_seller", "Seller not found");
  const amount = amountMicro ?? seller.balanceMicro;
  if (!Number.isInteger(amount) || amount < MIN_PAYOUT_MICRO) throw new HttpError(400, "below_minimum", `Minimum payout is ${MIN_PAYOUT_MICRO / 1_000_000} USDC`);
  const ref = `sim_payout_${randomBytes(12).toString("hex")}`;
  return prisma.$transaction(async (db) => {
    const res = await db.seller.updateMany({ where: { id: sellerId, balanceMicro: { gte: amount } }, data: { balanceMicro: { decrement: amount }, paidOutMicro: { increment: amount } } });
    if (res.count === 0) throw new HttpError(400, "insufficient", "Not enough balance to pay out that amount");
    const payout = await db.payout.create({ data: { sellerId, amountMicro: amount, address: seller.payoutAddress, status: "paid", mode: "simulated", txRef: ref } });
    await db.ledgerEntry.create({ data: { kind: "payout", sellerId, amountMicro: -amount, note: ref } });
    return payout;
  });
}
