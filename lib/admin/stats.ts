import type { PrismaClient } from "@prisma/client";
import { partsOf, type LookParts } from "@/lib/agent/look";
import { OPERATOR_SELLER } from "@/lib/gateway/operator";
import { explorerTx } from "@/lib/x402/solana";

/**
 * The operator's numbers: what was bought, by whom, when, and what Rialto kept after paying the
 * upstream APIs. Computed from the transactions themselves (they carry the split and the cost), so
 * nothing here can drift from what the ledger says.
 */
export type Range = "24h" | "7d" | "30d" | "90d";
export type ModeFilter = "all" | "live" | "simulated";

const RANGE_MS: Record<Range, number> = { "24h": 24 * 3600_000, "7d": 7 * 86_400_000, "30d": 30 * 86_400_000, "90d": 90 * 86_400_000 };
export const isRange = (v: string | null): v is Range => v !== null && v in RANGE_MS;
export const isMode = (v: string | null): v is ModeFilter => v === "all" || v === "live" || v === "simulated";

export interface Money {
  /** what buyers paid, settled calls only */
  grossMicro: number;
  /** commission kept by Rialto */
  feeMicro: number;
  /** what Rialto's own integrations sold, at seller price (fal cost + margin) */
  operatorSalesMicro: number;
  /** what those calls cost upstream (fal & co.) */
  upstreamCostMicro: number;
  /** fee + operator sales − upstream cost */
  profitMicro: number;
  /** what third-party sellers received */
  sellersMicro: number;
}

export interface Bucket {
  /** ISO start of the bucket */
  at: string;
  purchases: number;
  failed: number;
  grossMicro: number;
  profitMicro: number;
  buyers: number;
}

export interface Stats {
  range: Range;
  mode: ModeFilter;
  generatedAt: string;
  totals: Money & { purchases: number; failed: number; successRate: number; avgTicketMicro: number };
  users: { total: number; newInRange: number; activeInRange: number; buyingInRange: number; walletBuyersInRange: number; admins: number };
  series: { unit: "hour" | "day"; buckets: Bucket[] };
  /** purchases by hour of the day and by weekday, in the time zone asked for */
  peaks: { byHour: number[]; byWeekday: number[]; busiestHour: number | null; busiestWeekday: number | null; tz: string };
  topApis: { providerId: string; name: string; capability: string; operator: boolean; purchases: number; grossMicro: number; profitMicro: number }[];
  topBuyers: { who: string; kind: "user" | "wallet" | "agent"; purchases: number; grossMicro: number }[];
}

interface TxRow {
  createdAt: Date;
  status: string;
  amountMicro: number;
  feeMicro: number;
  sellerMicro: number;
  costMicro: number;
  agentId: string;
  providerId: string;
  capability: string;
  provider: { name: string; seller: { name: string } | null };
}

const MAX_ROWS = 100_000;

function money(rows: TxRow[]): Money {
  const m: Money = { grossMicro: 0, feeMicro: 0, operatorSalesMicro: 0, upstreamCostMicro: 0, profitMicro: 0, sellersMicro: 0 };
  for (const t of rows) {
    if (t.status !== "settled") continue;
    m.grossMicro += t.amountMicro;
    m.feeMicro += t.feeMicro;
    m.upstreamCostMicro += t.costMicro;
    if (t.provider.seller?.name === OPERATOR_SELLER) m.operatorSalesMicro += t.sellerMicro;
    else m.sellersMicro += t.sellerMicro;
  }
  m.profitMicro = m.feeMicro + m.operatorSalesMicro - m.upstreamCostMicro;
  return m;
}

const profitOf = (t: TxRow): number => (t.status !== "settled" ? 0 : t.feeMicro + (t.provider.seller?.name === OPERATOR_SELLER ? t.sellerMicro : 0) - t.costMicro);

/** Hour (0–23) and weekday (0 = Sunday) of `d` in time zone `tz`. */
function local(d: Date, fmt: Intl.DateTimeFormat): { hour: number; weekday: number; dayKey: string } {
  const parts = Object.fromEntries(fmt.formatToParts(d).map((p) => [p.type, p.value]));
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.weekday);
  return { hour: Number(parts.hour) % 24, weekday, dayKey: `${parts.year}-${parts.month}-${parts.day}` };
}

export function safeTimeZone(tz: string | null): string {
  if (!tz) return "UTC";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz;
  } catch {
    return "UTC";
  }
}

export async function computeStats(prisma: PrismaClient, opts: { range: Range; mode: ModeFilter; tz: string; now?: Date }): Promise<Stats> {
  const now = opts.now ?? new Date();
  const since = new Date(now.getTime() - RANGE_MS[opts.range]);
  const modeWhere = opts.mode === "all" ? {} : { mode: opts.mode };

  const [rows, totalUsers, newUsers, admins, sessions, agents] = await Promise.all([
    prisma.transaction.findMany({
      where: { createdAt: { gte: since }, ...modeWhere },
      select: { createdAt: true, status: true, amountMicro: true, feeMicro: true, sellerMicro: true, costMicro: true, agentId: true, providerId: true, capability: true, provider: { select: { name: true, seller: { select: { name: true } } } } },
      orderBy: { createdAt: "asc" },
      take: MAX_ROWS,
    }),
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: since } } }),
    prisma.user.count({ where: { role: "admin" } }),
    prisma.session.findMany({ where: { lastUsedAt: { gte: since } }, select: { userId: true } }),
    prisma.agent.findMany({ where: { userId: { not: null } }, select: { id: true, userId: true, user: { select: { email: true } } } }),
  ]);

  const ownerOf = new Map(agents.map((a) => [a.id, { userId: a.userId as string, email: a.user?.email ?? "" }]));
  const buyingUsers = new Set<string>();
  const wallets = new Set<string>();
  for (const t of rows) {
    if (t.status !== "settled") continue;
    const owner = ownerOf.get(t.agentId);
    if (owner) buyingUsers.add(owner.userId);
    else if (t.agentId.startsWith("wallet:")) wallets.add(t.agentId);
  }
  const active = new Set([...sessions.map((s) => s.userId), ...buyingUsers]);

  // ---- time series
  const unit: "hour" | "day" = opts.range === "24h" ? "hour" : "day";
  const step = unit === "hour" ? 3600_000 : 86_400_000;
  const start = Math.floor(since.getTime() / step) * step;
  const count = Math.ceil((now.getTime() - start) / step);
  const buckets: (Bucket & { who: Set<string> })[] = Array.from({ length: count }, (_, i) => ({ at: new Date(start + i * step).toISOString(), purchases: 0, failed: 0, grossMicro: 0, profitMicro: 0, buyers: 0, who: new Set<string>() }));
  const fmt = new Intl.DateTimeFormat("en-US", { timeZone: opts.tz, hour: "numeric", hourCycle: "h23", weekday: "short", year: "numeric", month: "2-digit", day: "2-digit" });
  const byHour = Array<number>(24).fill(0);
  const byWeekday = Array<number>(7).fill(0);
  const apis = new Map<string, Stats["topApis"][number]>();
  const buyers = new Map<string, Stats["topBuyers"][number]>();

  for (const t of rows) {
    const b = buckets[Math.min(count - 1, Math.max(0, Math.floor((t.createdAt.getTime() - start) / step)))];
    if (t.status !== "settled") {
      b.failed++;
      continue;
    }
    b.purchases++;
    b.grossMicro += t.amountMicro;
    b.profitMicro += profitOf(t);
    b.who.add(t.agentId);
    const l = local(t.createdAt, fmt);
    byHour[l.hour]++;
    if (l.weekday >= 0) byWeekday[l.weekday]++;

    const operator = t.provider.seller?.name === OPERATOR_SELLER;
    const api = apis.get(t.providerId) ?? { providerId: t.providerId, name: t.provider.name, capability: t.capability, operator, purchases: 0, grossMicro: 0, profitMicro: 0 };
    api.purchases++;
    api.grossMicro += t.amountMicro;
    api.profitMicro += profitOf(t);
    apis.set(t.providerId, api);

    const owner = ownerOf.get(t.agentId);
    const key = owner ? `user:${owner.userId}` : t.agentId;
    const who = owner ? owner.email : t.agentId.startsWith("wallet:") ? t.agentId.slice(7) : t.agentId;
    const buyer = buyers.get(key) ?? { who, kind: owner ? ("user" as const) : t.agentId.startsWith("wallet:") ? ("wallet" as const) : ("agent" as const), purchases: 0, grossMicro: 0 };
    buyer.purchases++;
    buyer.grossMicro += t.amountMicro;
    buyers.set(key, buyer);
  }

  const totals = money(rows);
  const purchases = rows.filter((t) => t.status === "settled").length;
  const failed = rows.length - purchases;
  const argmax = (xs: number[]): number | null => (xs.some((x) => x > 0) ? xs.indexOf(Math.max(...xs)) : null);

  return {
    range: opts.range,
    mode: opts.mode,
    generatedAt: now.toISOString(),
    totals: { ...totals, purchases, failed, successRate: rows.length ? purchases / rows.length : 0, avgTicketMicro: purchases ? Math.round(totals.grossMicro / purchases) : 0 },
    users: { total: totalUsers, newInRange: newUsers, activeInRange: active.size, buyingInRange: buyingUsers.size, walletBuyersInRange: wallets.size, admins },
    series: { unit, buckets: buckets.map(({ who, ...b }) => ({ ...b, buyers: who.size })) },
    peaks: { byHour, byWeekday, busiestHour: argmax(byHour), busiestWeekday: argmax(byWeekday), tz: opts.tz },
    topApis: [...apis.values()].sort((a, b) => b.grossMicro - a.grossMicro).slice(0, 12),
    topBuyers: [...buyers.values()].sort((a, b) => b.grossMicro - a.grossMicro).slice(0, 12),
  };
}

export interface PurchaseRow {
  id: string;
  at: string;
  buyer: string;
  buyerKind: "user" | "wallet" | "agent";
  api: string;
  capability: string;
  operator: boolean;
  status: string;
  mode: string;
  network: string;
  amountMicro: number;
  feeMicro: number;
  sellerMicro: number;
  costMicro: number;
  profitMicro: number;
  latencyMs: number | null;
  explorerUrl: string | null;
  /** the commission leg's own transaction, when it was recorded */
  feeExplorerUrl: string | null;
  agent: string | null;
  payer: string | null;
  rating: number | null;
  error: string | null;
}

/** The latest purchases, newest first, `before` a cursor for the next page. */
export async function listPurchases(prisma: PrismaClient, opts: { mode: ModeFilter; status?: "settled" | "failed"; before?: Date; take?: number; agentIds?: string[] }): Promise<PurchaseRow[]> {
  const rows = await prisma.transaction.findMany({
    where: {
      ...(opts.agentIds ? { agentId: { in: opts.agentIds } } : {}),
      ...(opts.mode === "all" ? {} : { mode: opts.mode }),
      ...(opts.status === "settled" ? { status: "settled" } : opts.status === "failed" ? { status: { not: "settled" } } : {}),
      ...(opts.before ? { createdAt: { lt: opts.before } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: Math.min(5_000, opts.take ?? 50),
    select: { id: true, createdAt: true, agentId: true, capability: true, status: true, mode: true, network: true, amountMicro: true, feeMicro: true, sellerMicro: true, costMicro: true, latencyMs: true, explorerUrl: true, feeTxRef: true, payer: true, rating: true, error: true, provider: { select: { name: true, seller: { select: { name: true } } } } },
  });
  const agentIds = [...new Set(rows.map((r) => r.agentId).filter((id) => !id.startsWith("wallet:")))];
  const owners = new Map((await prisma.agent.findMany({ where: { id: { in: agentIds } }, select: { id: true, name: true, user: { select: { email: true } } } })).map((a) => [a.id, a]));
  return rows.map((r) => {
    const operator = r.provider.seller?.name === OPERATOR_SELLER;
    const owner = owners.get(r.agentId);
    const settled = r.status === "settled";
    return {
      id: r.id,
      at: r.createdAt.toISOString(),
      buyer: owner?.user?.email ?? (r.agentId.startsWith("wallet:") ? r.agentId.slice(7) : (owner?.name ?? r.agentId)),
      agent: owner?.name ?? null,
      payer: r.payer,
      buyerKind: owner?.user ? "user" : r.agentId.startsWith("wallet:") ? "wallet" : "agent",
      api: r.provider.name,
      capability: r.capability,
      operator,
      status: r.status,
      mode: r.mode,
      network: r.network,
      amountMicro: r.amountMicro,
      feeMicro: r.feeMicro,
      sellerMicro: r.sellerMicro,
      costMicro: r.costMicro,
      profitMicro: settled ? r.feeMicro + (operator ? r.sellerMicro : 0) - r.costMicro : 0,
      latencyMs: r.latencyMs,
      explorerUrl: r.explorerUrl,
      feeExplorerUrl: r.feeTxRef ? explorerTx(r.feeTxRef) : null,
      rating: r.rating,
      error: r.error,
    };
  });
}

export interface UserRow {
  id: string;
  email: string;
  name: string;
  role: string;
  admin: boolean;
  createdAt: string;
  lastSeenAt: string | null;
  agents: number;
  purchases: number;
  spentMicro: number;
  lastPurchaseAt: string | null;
  wallet: string | null;
  /** the wallet their agents pay from (allowance), if linked */
  payWallet: string | null;
  verified: boolean;
  sellsApis: number;
}

/** Everyone with an account, with what they did. */
export async function listUsers(prisma: PrismaClient, isAdmin: (u: { email: string; role: string }) => boolean): Promise<UserRow[]> {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    take: 1_000,
    select: {
      id: true, email: true, name: true, role: true, createdAt: true, walletAddress: true, payWallet: true, emailVerifiedAt: true,
      sessions: { select: { lastUsedAt: true }, orderBy: { lastUsedAt: "desc" }, take: 1 },
      agents: { select: { id: true } },
      seller: { select: { _count: { select: { providers: true } } } },
    },
  });
  const agentToUser = new Map(users.flatMap((u) => u.agents.map((a) => [a.id, u.id] as const)));
  const spend = await prisma.transaction.groupBy({ by: ["agentId"], where: { status: "settled", agentId: { in: [...agentToUser.keys()] } }, _sum: { amountMicro: true }, _count: { _all: true }, _max: { createdAt: true } });
  const perUser = new Map<string, { purchases: number; spentMicro: number; last: Date | null }>();
  for (const s of spend) {
    const userId = agentToUser.get(s.agentId);
    if (!userId) continue;
    const cur = perUser.get(userId) ?? { purchases: 0, spentMicro: 0, last: null };
    cur.purchases += s._count._all;
    cur.spentMicro += s._sum.amountMicro ?? 0;
    const last = s._max.createdAt;
    if (last && (!cur.last || last > cur.last)) cur.last = last;
    perUser.set(userId, cur);
  }
  return users.map((u) => {
    const p = perUser.get(u.id);
    return {
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      admin: isAdmin(u),
      createdAt: u.createdAt.toISOString(),
      lastSeenAt: u.sessions[0]?.lastUsedAt.toISOString() ?? null,
      agents: u.agents.length,
      purchases: p?.purchases ?? 0,
      spentMicro: p?.spentMicro ?? 0,
      lastPurchaseAt: p?.last?.toISOString() ?? null,
      wallet: u.walletAddress,
      payWallet: u.payWallet,
      verified: u.emailVerifiedAt !== null,
      sellsApis: u.seller?._count.providers ?? 0,
    };
  });
}

export interface UserDetail {
  user: UserRow & { termsAcceptedAt: string | null; sessions: number; balanceMicro: number };
  agents: { id: string; name: string; keyPrefix: string | null; look: LookParts; appetite: number; createdAt: string; revoked: boolean; purchases: number; spentMicro: number }[];
  apis: { id: string; name: string; status: string; calls: number }[];
  purchases: PurchaseRow[];
}

/** One account in full: its agents (revoked ones too), the APIs it sells and its latest purchases. */
export async function userDetail(prisma: PrismaClient, id: string, isAdmin: (u: { email: string; role: string }) => boolean): Promise<UserDetail | null> {
  const u = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true, email: true, name: true, role: true, createdAt: true, walletAddress: true, payWallet: true, emailVerifiedAt: true, termsAcceptedAt: true, balanceMicro: true,
      sessions: { select: { lastUsedAt: true }, orderBy: { lastUsedAt: "desc" } },
      agents: { orderBy: { createdAt: "asc" }, select: { id: true, name: true, keyPrefix: true, look: true, appetite: true, createdAt: true, revokedAt: true } },
      seller: { select: { providers: { select: { id: true, name: true, status: true, requestCount: true } } } },
    },
  });
  if (!u) return null;
  const agentIds = u.agents.map((a) => a.id);
  const [spend, purchases] = await Promise.all([
    prisma.transaction.groupBy({ by: ["agentId"], where: { status: "settled", agentId: { in: agentIds } }, _sum: { amountMicro: true }, _count: { _all: true }, _max: { createdAt: true } }),
    agentIds.length ? listPurchases(prisma, { mode: "all", agentIds, take: 30 }) : Promise.resolve([]),
  ]);
  const per = new Map(spend.map((s) => [s.agentId, s]));
  const total = spend.reduce((acc, s) => ({ n: acc.n + s._count._all, micro: acc.micro + (s._sum.amountMicro ?? 0), last: s._max.createdAt && (!acc.last || s._max.createdAt > acc.last) ? s._max.createdAt : acc.last }), { n: 0, micro: 0, last: null as Date | null });
  return {
    user: {
      id: u.id, email: u.email, name: u.name, role: u.role, admin: isAdmin(u), createdAt: u.createdAt.toISOString(),
      lastSeenAt: u.sessions[0]?.lastUsedAt.toISOString() ?? null, agents: u.agents.filter((a) => !a.revokedAt).length,
      purchases: total.n, spentMicro: total.micro, lastPurchaseAt: total.last?.toISOString() ?? null,
      wallet: u.walletAddress, payWallet: u.payWallet, verified: u.emailVerifiedAt !== null, sellsApis: u.seller?.providers.length ?? 0,
      termsAcceptedAt: u.termsAcceptedAt?.toISOString() ?? null, sessions: u.sessions.length, balanceMicro: u.balanceMicro,
    },
    agents: u.agents.map((a) => ({ id: a.id, name: a.name, keyPrefix: a.keyPrefix, look: partsOf(a.look, a.id), appetite: a.appetite, createdAt: a.createdAt.toISOString(), revoked: a.revokedAt !== null, purchases: per.get(a.id)?._count._all ?? 0, spentMicro: per.get(a.id)?._sum.amountMicro ?? 0 })),
    apis: (u.seller?.providers ?? []).map((p) => ({ id: p.id, name: p.name, status: p.status, calls: p.requestCount })),
    purchases,
  };
}

/** Rows as CSV, every field quoted, for a spreadsheet. Text that a spreadsheet would run as a formula is defused. */
export function toCsv(header: string[], rows: (string | number | boolean | null)[][]): string {
  const cell = (v: string | number | boolean | null) => {
    const t = String(v ?? "");
    const safe = typeof v === "string" && /^[=+\-@\t\r]/.test(t) ? `'${t}` : t;
    return `"${safe.replaceAll('"', '""')}"`;
  };
  return [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");
}

export const micro = (m: number): string => (m / 1_000_000).toFixed(6);
