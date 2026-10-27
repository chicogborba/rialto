import type { PrismaClient } from "@prisma/client";
import { afterEach, describe, expect, it } from "vitest";
import { applySettings, maskSecret, normaliseSetting, settingDef } from "@/lib/admin/settings";
import { computeStats } from "@/lib/admin/stats";
import { isAdminUser } from "@/lib/admin/auth";
import { splitFromSellerPrice } from "@/lib/billing/fees";
import { BUILT_IN_INTEGRATIONS } from "@/lib/gateway/integrations";
import { OPERATOR_SELLER, operatorMarginPct, operatorSellerPrice } from "@/lib/gateway/operator";
import { encryptSecret } from "@/lib/security/secrets";

describe("what Rialto charges for its own integrations", () => {
  it("is fal's cost plus the margin, rounded up to a tenth of a cent", () => {
    expect(operatorSellerPrice(30_000, {})).toBe(35_000); // $0.030 × 1.15 = $0.0345 → $0.035
    expect(operatorSellerPrice(200_000, {})).toBe(230_000);
    expect(operatorSellerPrice(30_000, { OPERATOR_MARGIN_PCT: "50" })).toBe(45_000);
    expect(operatorSellerPrice(30_000, { OPERATOR_MARGIN_PCT: "0" })).toBe(30_000);
  });
  it("never sells under $0.001, and ignores a nonsense margin", () => {
    expect(operatorSellerPrice(360, {})).toBe(1_000);
    expect(operatorMarginPct({ OPERATOR_MARGIN_PCT: "-5" })).toBe(15);
    expect(operatorMarginPct({ OPERATOR_MARGIN_PCT: "abc" })).toBe(15);
  });
  it("always leaves Rialto more than the API costs", () => {
    for (const i of BUILT_IN_INTEGRATIONS) {
      const seller = operatorSellerPrice(i.costMicro, {});
      const { buyerMicro } = splitFromSellerPrice(seller, { bps: 500, minMicro: 1_000 });
      expect(i.costMicro, i.slug).toBeGreaterThan(0);
      expect(buyerMicro - i.costMicro, i.slug).toBeGreaterThan(0);
    }
  });
});

describe("settings typed in /admin", () => {
  const def = (key: string) => {
    const d = settingDef(key);
    if (!d) throw new Error(key);
    return d;
  };
  it("checks addresses, numbers and URLs", () => {
    expect(normaliseSetting(def("PLATFORM_FEE_PAYTO"), " GW1joGToHBm2z9qXiHro8vP8agJvoGLqvAVjRJQrVDrz ")).toBe("GW1joGToHBm2z9qXiHro8vP8agJvoGLqvAVjRJQrVDrz");
    expect(() => normaliseSetting(def("PLATFORM_FEE_PAYTO"), "0xabc")).toThrow(/Solana address/);
    expect(normaliseSetting(def("OPERATOR_MARGIN_PCT"), "25")).toBe("25");
    expect(() => normaliseSetting(def("PLATFORM_FEE_BPS"), "9000")).toThrow(/0 to 5000/);
    expect(() => normaliseSetting(def("SOLANA_RPC_URL"), "http://rpc.example.com")).toThrow(/https/);
    expect(normaliseSetting(def("SOLANA_RPC_URL"), "https://mainnet.helius-rpc.com/?api-key=x")).toMatch(/^https:/);
    expect(normaliseSetting(def("FAL_KEY"), "   ")).toBe("");
  });
  it("never shows a key in full", () => {
    expect(maskSecret("abcd1234:secretsecretsecret")).toBe("abc…cret");
    expect(maskSecret("short")).toBe("••••");
    expect(maskSecret("")).toBe("");
  });

  const saved = { ...process.env };
  afterEach(() => {
    for (const k of ["FAL_KEY", "OPERATOR_MARGIN_PCT", "PLATFORM_FEE_PAYTO"]) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });
  it("override the environment while the process runs, secrets decrypted", async () => {
    const rows = [
      { key: "FAL_KEY", value: encryptSecret("fal-from-admin"), secret: true },
      { key: "OPERATOR_MARGIN_PCT", value: "40", secret: false },
      { key: "NOT_A_SETTING", value: "x", secret: false },
    ];
    const prisma = { setting: { findMany: async () => rows } } as unknown as PrismaClient;
    const keys = await applySettings(prisma);
    expect(keys.sort()).toEqual(["FAL_KEY", "OPERATOR_MARGIN_PCT"]);
    expect(process.env.FAL_KEY).toBe("fal-from-admin");
    expect(operatorMarginPct()).toBe(40);
    expect(process.env.NOT_A_SETTING).toBeUndefined();
  });
});

describe("who is an admin", () => {
  it("is the role, or an email the server lists", () => {
    process.env.SUPERADMIN_EMAILS = "Chico@Example.com, other@x.io";
    expect(isAdminUser({ email: "chico@example.com", role: "user" })).toBe(true);
    expect(isAdminUser({ email: "someone@x.io", role: "admin" })).toBe(true);
    expect(isAdminUser({ email: "someone@x.io", role: "user" })).toBe(false);
    delete process.env.SUPERADMIN_EMAILS;
  });
});

describe("the operator's numbers", () => {
  const now = new Date("2026-10-24T18:00:00Z");
  const fal = { name: "FLUX.2 Pro", seller: { name: OPERATOR_SELLER } };
  const third = { name: "PokéDex", seller: { name: "PokéLab" } };
  const tx = (hoursAgo: number, over: Partial<Record<string, unknown>>) => ({
    createdAt: new Date(now.getTime() - hoursAgo * 3600_000),
    status: "settled",
    amountMicro: 0,
    feeMicro: 0,
    sellerMicro: 0,
    costMicro: 0,
    agentId: "agent_a",
    providerId: "p1",
    capability: "image.generate",
    provider: fal,
    ...over,
  });
  const rows = [
    // a fal call: buyer paid 0.036 = 0.035 seller (cost 0.030 + margin) + 0.001 commission
    tx(1, { amountMicro: 36_000, sellerMicro: 35_000, feeMicro: 1_000, costMicro: 30_000 }),
    tx(2, { amountMicro: 36_000, sellerMicro: 35_000, feeMicro: 1_000, costMicro: 30_000, agentId: "wallet:Buyer1111" }),
    // a third-party seller: Rialto keeps only the commission
    tx(3, { amountMicro: 3_000, sellerMicro: 2_000, feeMicro: 1_000, providerId: "p2", provider: third, capability: "data.lookup" }),
    // failed: no money moved
    tx(4, { status: "failed", amountMicro: 36_000 }),
  ];
  const prisma = {
    transaction: { findMany: async () => rows },
    user: { count: async () => 3 },
    session: { findMany: async () => [{ userId: "u2" }] },
    agent: { findMany: async () => [{ id: "agent_a", userId: "u1", user: { email: "a@x.io" } }] },
  } as unknown as PrismaClient;

  it("count profit as commission + margin − what the APIs cost", async () => {
    const s = await computeStats(prisma, { range: "24h", mode: "all", tz: "America/Sao_Paulo", now });
    expect(s.totals.purchases).toBe(3);
    expect(s.totals.failed).toBe(1);
    expect(s.totals.grossMicro).toBe(75_000);
    expect(s.totals.feeMicro).toBe(3_000);
    expect(s.totals.operatorSalesMicro).toBe(70_000);
    expect(s.totals.upstreamCostMicro).toBe(60_000);
    expect(s.totals.profitMicro).toBe(13_000);
    expect(s.totals.sellersMicro).toBe(2_000);
  });
  it("know who bought and when", async () => {
    const s = await computeStats(prisma, { range: "24h", mode: "all", tz: "America/Sao_Paulo", now });
    expect(s.users.buyingInRange).toBe(1);
    expect(s.users.walletBuyersInRange).toBe(1);
    expect(s.users.activeInRange).toBe(2); // u1 bought, u2 signed in
    expect(s.series.unit).toBe("hour");
    expect(s.series.buckets.reduce((n, b) => n + b.purchases, 0)).toBe(3);
    // 17:00Z is 14:00 in São Paulo
    expect(s.peaks.byHour[14]).toBe(1);
    expect(s.peaks.byHour.reduce((a, b) => a + b, 0)).toBe(3);
    expect(s.topApis[0].name).toBe("FLUX.2 Pro");
    expect(s.topApis[0].profitMicro).toBe(12_000);
    expect(s.topBuyers.map((b) => b.kind).sort()).toEqual(["user", "wallet"]);
  });
});

describe("the spender key typed in /admin", () => {
  it("must be a whole Solana secret key", () => {
    const d = settingDef("RIALTO_SPENDER_KEY");
    if (!d) throw new Error("missing");
    expect(() => normaliseSetting(d, "GW1joGToHBm2z9qXiHro8vP8agJvoGLqvAVjRJQrVDrz")).toThrow(/64 bytes/);
    expect(normaliseSetting(d, JSON.stringify(Array.from({ length: 64 }, (_, i) => i)))).toMatch(/^\[0,1,2/);
  });
});

describe("CSV exports from /admin", () => {
  it("quotes every cell and defuses text a spreadsheet would run as a formula", async () => {
    const { toCsv } = await import("@/lib/admin/stats");
    const csv = toCsv(["email", "spent"], [["=HYPERLINK(\"x\")", 1.5], ["a@b.com", null]]);
    expect(csv.split("\r\n")).toEqual(['"email","spent"', '"\'=HYPERLINK(""x"")","1.5"', '"a@b.com",""']);
  });
});
