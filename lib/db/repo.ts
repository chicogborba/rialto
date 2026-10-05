import { RegisterProviderSchema, type RegisterProviderInput } from "@/lib/provider-schema";
import { isCapabilityId } from "@/lib/agent/capabilities";
import type { RunEvent } from "@/lib/agent/events";
import type { RunDeps, TransactionRecord } from "@/lib/agent/run";
import type {
  ProviderWithServices,
  ReputationPoint,
  StatsResponse,
  TransactionDetail,
  TransactionRow,
  TxStatus,
  WalletResponse,
} from "@/lib/api-types";
import type { ReputationUpdate } from "@/lib/reputation/update";
import { slugify, SCHEMAS } from "../../prisma/seed-data";
import { toMicro } from "@/lib/money";
import { parsePaymentRequired } from "@/lib/x402/sim-protocol";
import { PolicySchema, parsePolicy } from "@/lib/wallet/policy-schema";
import type {
  Candidate,
  CapabilityId,
  Constraints,
  MicroUsdc,
  PaymentMode,
  ProviderHistory,
  ProviderStatus,
  SpendingPolicy,
  WalletState,
} from "@/lib/types";
import { currentMode } from "@/lib/x402";
import { prisma } from "./client";
import { toProvider, toService } from "./mappers";

const AGENT_ID = "agent_default";

function asMode(m: string): PaymentMode {
  return m === "live" ? "live" : "simulated";
}
function asTxStatus(s: string): TxStatus {
  return s === "failed_not_charged" || s === "rejected_by_policy" ? s : "settled";
}

// ---------- registry ----------

export async function listCandidates(): Promise<Candidate[]> {
  const services = await prisma.service.findMany({ include: { provider: true }, orderBy: { id: "asc" } });
  const out: Candidate[] = [];
  for (const s of services) {
    const service = toService(s);
    if (service) out.push({ provider: toProvider(s.provider), service });
  }
  return out;
}

/** Recent (last 20) success rate per provider from local transactions. */
export async function getHistory(): Promise<ProviderHistory> {
  const txs = await prisma.transaction.findMany({
    where: { status: { in: ["settled", "failed_not_charged"] } },
    orderBy: { createdAt: "desc" },
    take: 400,
    select: { providerId: true, status: true },
  });
  const per = new Map<string, { ok: number; n: number }>();
  for (const t of txs) {
    const cur = per.get(t.providerId) ?? { ok: 0, n: 0 };
    if (cur.n >= 20) continue;
    cur.n += 1;
    if (t.status === "settled") cur.ok += 1;
    per.set(t.providerId, cur);
  }
  const hist: ProviderHistory = {};
  for (const [id, v] of per) hist[id] = { recentSuccessRate: v.ok / v.n, samples: v.n };
  return hist;
}

export async function listProviders(capability?: CapabilityId): Promise<ProviderWithServices[]> {
  const rows = await prisma.provider.findMany({
    include: { services: true },
    orderBy: [{ isDemo: "asc" }, { name: "asc" }],
  });
  const out: ProviderWithServices[] = [];
  for (const r of rows) {
    const services = r.services.map(toService).filter((s) => s !== null);
    if (capability && !services.some((s) => s.capability === capability)) continue;
    out.push({ provider: toProvider(r), services, unproven: !r.isDemo && r.requestCount === 0 });
  }
  return out;
}

export async function getProviderBySlug(slug: string) {
  return prisma.provider.findUnique({ where: { slug }, include: { services: true } });
}

export async function setProviderStatus(id: string, status: ProviderStatus): Promise<boolean> {
  const res = await prisma.provider.updateMany({ where: { id }, data: { status } });
  return res.count > 0;
}

export { RegisterProviderSchema, type RegisterProviderInput };

export async function registerProvider(input: RegisterProviderInput): Promise<ProviderWithServices> {
  let slug = slugify(input.name) || "provider";
  const taken = await prisma.provider.count({ where: { slug: { startsWith: slug } } });
  if (taken > 0) slug = `${slug}${taken + 1}`;
  const caps = input.capabilities.filter(isCapabilityId);
  const created = await prisma.provider.create({
    data: {
      slug,
      name: input.name,
      description: input.description,
      network: input.network,
      x402Enabled: input.x402Enabled,
      status: "online",
      qualityScore: input.quality,
      reputationScore: 50,
      successRate: 100,
      latencyMs: input.latencyMs,
      requestCount: 0,
      isDemo: false,
      payTo: "UNSET",
      services: {
        create: caps.map((capability: CapabilityId) => ({
          capability,
          endpoint: input.endpoint,
          priceMicro: toMicro(input.priceUsd),
          capabilityMatch: 1,
          inputSchema: SCHEMAS[capability].input,
          outputSchema: SCHEMAS[capability].output,
        })),
      },
    },
    include: { services: true },
  });
  return {
    provider: toProvider(created),
    services: created.services.map(toService).filter((s) => s !== null),
    unproven: true,
  };
}

export async function applyReputation(providerId: string, update: ReputationUpdate): Promise<void> {
  await prisma.provider.update({ where: { id: providerId }, data: update });
}

// ---------- wallet ----------

async function ensureAgent() {
  const a = await prisma.agent.findUnique({ where: { id: AGENT_ID } });
  if (!a) throw new Error("Database not seeded. Run `npm run setup`.");
  return a;
}

export async function getWallet(): Promise<WalletState> {
  const a = await ensureAgent();
  return { balanceMicro: a.balanceMicro, sessionSpendMicro: a.sessionSpendMicro, policy: parsePolicy(a.policy) };
}

export async function getWalletResponse(): Promise<WalletResponse> {
  const a = await ensureAgent();
  return {
    wallet: { balanceMicro: a.balanceMicro, sessionSpendMicro: a.sessionSpendMicro, policy: parsePolicy(a.policy) },
    mode: currentMode(),
    agentName: a.name,
  };
}

export async function debitWallet(amountMicro: MicroUsdc): Promise<WalletState> {
  const a = await prisma.agent.update({
    where: { id: AGENT_ID },
    data: { balanceMicro: { decrement: amountMicro }, sessionSpendMicro: { increment: amountMicro } },
  });
  return { balanceMicro: a.balanceMicro, sessionSpendMicro: a.sessionSpendMicro, policy: parsePolicy(a.policy) };
}

export async function updatePolicy(policy: SpendingPolicy): Promise<void> {
  await prisma.agent.update({ where: { id: AGENT_ID }, data: { policy: JSON.stringify(PolicySchema.parse(policy)) } });
}

export async function newSession(): Promise<void> {
  await prisma.agent.update({ where: { id: AGENT_ID }, data: { sessionSpendMicro: 0 } });
}

// ---------- runs + ledger ----------

export async function createRun(args: { runId: string; goal: string; constraints: Constraints; mode: PaymentMode }) {
  await prisma.run.create({
    data: {
      id: args.runId,
      agentId: AGENT_ID,
      goal: args.goal,
      constraints: JSON.stringify(args.constraints),
      status: "running",
      mode: args.mode,
    },
  });
}

export async function persistEvent(e: RunEvent): Promise<void> {
  await prisma.runEvent.create({
    data: { runId: e.runId, seq: e.seq, type: e.type, payload: JSON.stringify(e), ts: new Date(e.ts) },
  });
  if (e.type === "plan.ready") {
    await prisma.run.update({ where: { id: e.runId }, data: { plan: JSON.stringify(e.plan) } });
  } else if (e.type === "run.completed") {
    await prisma.run.update({
      where: { id: e.runId },
      data: {
        status: "completed",
        result: JSON.stringify(e.result),
        totalCostMicro: e.totalCostMicro,
        premiumBaselineMicro: e.savings.premiumBaselineMicro,
        cheapestBaselineMicro: e.savings.cheapestBaselineMicro,
        qualityDeltaVsCheapest: e.savings.qualityDeltaVsCheapest,
        totalLatencyMs: e.totalLatencyMs,
      },
    });
  } else if (e.type === "run.failed") {
    await prisma.run.update({ where: { id: e.runId }, data: { status: "failed" } });
  }
}

export async function recordTransaction(tx: TransactionRecord): Promise<void> {
  await prisma.transaction.create({
    data: {
      runId: tx.runId,
      stepId: tx.stepId,
      agentId: AGENT_ID,
      providerId: tx.providerId,
      serviceId: tx.serviceId,
      capability: tx.capability,
      amountMicro: tx.amountMicro,
      network: tx.network,
      status: tx.status,
      mode: tx.mode,
      role: tx.role,
      txRef: tx.txRef,
      explorerUrl: tx.explorerUrl,
      latencyMs: tx.latencyMs,
      requirements: JSON.stringify(tx.requirements),
      result: tx.result === null || tx.result === undefined ? null : JSON.stringify(tx.result),
      error: tx.error,
    },
  });
}

/** Persistent deps pieces (ephemeral runs omit ledger/reputation/sink). */
export const persistentDeps: Pick<RunDeps, "registry" | "reputation" | "ledger" | "sink"> & {
  wallet: RunDeps["wallet"];
} = {
  registry: { listCandidates, history: getHistory },
  wallet: { get: getWallet, debit: debitWallet },
  reputation: { apply: applyReputation },
  ledger: { record: recordTransaction },
  sink: { onEvent: persistEvent },
};

// ---------- transactions ----------

type TxWithProvider = Awaited<ReturnType<typeof prisma.transaction.findMany<{ include: { provider: true } }>>>[number];

function toRow(t: TxWithProvider): TransactionRow | null {
  if (!isCapabilityId(t.capability)) return null;
  return {
    id: t.id,
    createdAt: t.createdAt.toISOString(),
    agentId: t.agentId,
    runId: t.runId,
    stepId: t.stepId,
    capability: t.capability,
    providerId: t.providerId,
    providerName: t.provider.name,
    amountMicro: t.amountMicro,
    network: t.network,
    status: asTxStatus(t.status),
    mode: asMode(t.mode),
    txRef: t.txRef,
    latencyMs: t.latencyMs,
  };
}

export async function listTransactions(limit = 50, cursor?: string): Promise<{ rows: TransactionRow[]; next: string | null }> {
  const rows = await prisma.transaction.findMany({
    include: { provider: true },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
  const page = rows.slice(0, limit);
  return {
    rows: page.map(toRow).filter((r) => r !== null),
    next: rows.length > limit ? page[page.length - 1].id : null,
  };
}

export async function getTransactionDetail(id: string): Promise<TransactionDetail | null> {
  const t = await prisma.transaction.findUnique({ where: { id }, include: { provider: true } });
  if (!t) return null;
  const row = toRow(t);
  if (!row) return null;
  const evRows = await prisma.runEvent.findMany({ where: { runId: t.runId }, orderBy: { seq: "asc" } });
  const events: RunEvent[] = [];
  for (const r of evRows) {
    const parsed: unknown = JSON.parse(r.payload);
    if (typeof parsed === "object" && parsed !== null && "stepId" in parsed && parsed.stepId === t.stepId) {
      events.push(parsed as RunEvent);
    }
  }
  const reqJson: unknown = JSON.parse(t.requirements);
  return {
    ...row,
    role: t.role,
    explorerUrl: t.explorerUrl,
    requirements: parsePaymentRequired({ accepts: [reqJson] }),
    result: t.result ? (JSON.parse(t.result) as unknown) : null,
    error: t.error,
    provider: toProvider(t.provider),
    events,
  };
}

export async function reputationSeries(): Promise<Record<string, ReputationPoint[]>> {
  const ev = await prisma.runEvent.findMany({
    where: { type: "reputation.updated" },
    orderBy: [{ ts: "asc" }, { id: "asc" }],
    select: { payload: true, ts: true },
  });
  const out: Record<string, ReputationPoint[]> = {};
  for (const r of ev) {
    const p: unknown = JSON.parse(r.payload);
    if (typeof p === "object" && p !== null && "providerId" in p && "after" in p && typeof p.providerId === "string" && typeof p.after === "number") {
      (out[p.providerId] ??= []).push({ at: r.ts.toISOString(), reputation: p.after });
    }
  }
  return out;
}

export async function recentOutcomes(): Promise<Record<string, TxStatus[]>> {
  const txs = await prisma.transaction.findMany({
    orderBy: { createdAt: "desc" },
    take: 600,
    select: { providerId: true, status: true },
  });
  const out: Record<string, TxStatus[]> = {};
  for (const t of txs) {
    const list = (out[t.providerId] ??= []);
    if (list.length < 20) list.push(asTxStatus(t.status));
  }
  return out;
}

// ---------- stats ----------

export async function getStats(): Promise<StatsResponse> {
  const [txs, runs, providerTotal] = await Promise.all([
    prisma.transaction.findMany({ select: { status: true, amountMicro: true, latencyMs: true, providerId: true, capability: true } }),
    prisma.run.findMany({ where: { status: "completed" }, orderBy: { createdAt: "asc" } }),
    prisma.provider.count(),
  ]);
  const settled = txs.filter((t) => t.status === "settled");
  const attempted = txs.filter((t) => t.status !== "rejected_by_policy");
  const totalSpend = settled.reduce((s, t) => s + t.amountMicro, 0);
  const lat = settled.filter((t) => t.latencyMs !== null);
  const byCap = new Map<CapabilityId, { spendMicro: number; count: number }>();
  for (const t of settled) {
    if (!isCapabilityId(t.capability)) continue;
    const cur = byCap.get(t.capability) ?? { spendMicro: 0, count: 0 };
    cur.spendMicro += t.amountMicro;
    cur.count += 1;
    byCap.set(t.capability, cur);
  }
  const premium = runs.reduce((s, r) => s + r.premiumBaselineMicro, 0);
  const cheapest = runs.reduce((s, r) => s + r.cheapestBaselineMicro, 0);
  const actual = runs.reduce((s, r) => s + r.totalCostMicro, 0);
  return {
    totalSpendMicro: totalSpend,
    runs: runs.length,
    servicesPurchased: settled.length,
    avgCostMicro: settled.length ? Math.round(totalSpend / settled.length) : 0,
    avgLatencyMs: lat.length ? Math.round(lat.reduce((s, t) => s + (t.latencyMs ?? 0), 0) / lat.length) : 0,
    successRate: attempted.length ? Math.round((settled.length / attempted.length) * 1000) / 10 : 100,
    providerDiversity: { used: new Set(settled.map((t) => t.providerId)).size, total: providerTotal },
    savings: {
      premiumBaselineMicro: premium,
      cheapestBaselineMicro: cheapest,
      actualMicro: actual,
      savedMicro: Math.max(0, premium - actual),
      avgQualityDelta: runs.length ? Math.round((runs.reduce((s, r) => s + r.qualityDeltaVsCheapest, 0) / runs.length) * 10) / 10 : 0,
    },
    spendByCapability: [...byCap.entries()].map(([capability, v]) => ({ capability, ...v })),
    costPerRun: runs.slice(-20).map((r) => ({
      runId: r.id,
      createdAt: r.createdAt.toISOString(),
      costMicro: r.totalCostMicro,
      premiumMicro: r.premiumBaselineMicro,
    })),
  };
}

