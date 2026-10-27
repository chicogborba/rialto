import { randomBytes } from "node:crypto";
import { z } from "zod";
import { hashPassword, normalizeEmail, passwordProblem, spendLoginTime, verifyPassword } from "@/lib/auth/password";
import { HttpError } from "@/lib/http";
import { generateKey } from "@/lib/security/keys";
import { appetite } from "@/lib/agent/appetite";
import { LookPartsSchema, partsOf, type LookParts } from "@/lib/agent/look";
import { defaultPolicy } from "@/lib/wallet/policy";
import { PolicySchema, parsePolicy } from "@/lib/wallet/policy-schema";
import { prisma } from "./client";
import { listTransactionsForAgents } from "./repo";

/** Test money every new account starts with, so the first call works before any deposit. */
export const WELCOME_CREDIT_MICRO = Number(process.env.WELCOME_CREDIT_MICRO ?? process.env.TEST_CREDIT_MICRO ?? 1_000_000);
export const MAX_AGENTS_PER_USER = 10;

const EMAIL = z.string().trim().max(254).email("That does not look like an email address.");
export const SignupSchema = z.object({ email: EMAIL, password: z.string().max(200), name: z.string().trim().min(1, "Tell us your name.").max(60) });
export const LoginSchema = z.object({ email: EMAIL, password: z.string().max(200) });

// ---------- people ----------

/** The user for these credentials, or null. Takes the same time whether or not the email exists. */
export async function authenticate(emailInput: string, password: string): Promise<{ id: string; email: string; name: string } | null> {
  const user = await prisma.user.findUnique({ where: { email: normalizeEmail(emailInput) } });
  if (!user) {
    await spendLoginTime(password);
    return null;
  }
  return (await verifyPassword(password, user.passwordHash)) ? { id: user.id, email: user.email, name: user.name } : null;
}

export async function changePassword(userId: string, current: string, next: string, keepSessionId: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !(await verifyPassword(current, user.passwordHash))) throw new HttpError(400, "wrong_password", "Your current password is not right.");
  const problem = passwordProblem(next, user.email);
  if (problem) throw new HttpError(400, "weak_password", problem);
  const passwordHash = await hashPassword(next);
  // every other device is signed out: a password change is what you do when you suspect one
  await prisma.$transaction([prisma.user.update({ where: { id: userId }, data: { passwordHash } }), prisma.session.deleteMany({ where: { userId, id: { not: keepSessionId } } })]);
}

export async function renameUser(userId: string, name: string): Promise<void> {
  await prisma.user.update({ where: { id: userId }, data: { name } });
}

// ---------- agents (buyer keys) ----------

export const AgentNameSchema = z.object({ name: z.string().trim().min(1).max(40).default("My agent"), look: LookPartsSchema.optional(), appetite: z.number().int().min(1).max(5).optional() });

/** The default limits, raised or lowered to suit how keen the agent is to buy. */
function policyFor(level: number) {
  const a = appetite(level);
  return { ...defaultPolicy(), maxPerRequestMicro: a.perCallMicro, sessionBudgetMicro: a.sessionMicro };
}

export async function createAgentFor(userId: string, name: string, opts: { look?: LookParts; appetite?: number } = {}): Promise<{ agentId: string; apiKey: string }> {
  const count = await prisma.agent.count({ where: { userId, revokedAt: null } });
  if (count >= MAX_AGENTS_PER_USER) throw new HttpError(400, "limit", `You can have up to ${MAX_AGENTS_PER_USER} agents. Revoke one you no longer use.`);
  const k = generateKey("buyer");
  const agentId = `agent_${randomBytes(8).toString("hex")}`;
  const level = appetite(opts.appetite).level;
  await prisma.agent.create({ data: { id: agentId, name, balanceMicro: 0, policy: JSON.stringify(policyFor(level)), keyHash: k.hash, keyPrefix: k.prefix, userId, appetite: level, look: opts.look ? JSON.stringify(opts.look) : null } });
  return { agentId, apiKey: k.key };
}

async function ownedAgent(userId: string, agentId: string) {
  const agent = await prisma.agent.findFirst({ where: { id: agentId, userId, revokedAt: null } });
  if (!agent) throw new HttpError(404, "not_found", "No such agent on your account.");
  return agent;
}

export async function rotateAgentKey(userId: string, agentId: string): Promise<{ apiKey: string }> {
  await ownedAgent(userId, agentId);
  const k = generateKey("buyer");
  await prisma.agent.update({ where: { id: agentId }, data: { keyHash: k.hash, keyPrefix: k.prefix } });
  return { apiKey: k.key };
}

export async function updateAgent(userId: string, agentId: string, patch: { name?: string; policy?: z.infer<typeof PolicySchema>; look?: LookParts; appetite?: number }): Promise<void> {
  await ownedAgent(userId, agentId);
  await prisma.agent.update({
    where: { id: agentId },
    data: {
      ...(patch.name ? { name: patch.name } : {}),
      ...(patch.policy ? { policy: JSON.stringify(PolicySchema.parse(patch.policy)) } : {}),
      ...(patch.look ? { look: JSON.stringify(LookPartsSchema.parse(patch.look)) } : {}),
      ...(patch.appetite ? { appetite: appetite(patch.appetite).level } : {}),
    },
  });
}

/** Retires the key and gives whatever the agent still holds back to the account. */
export async function revokeAgent(userId: string, agentId: string): Promise<{ returnedMicro: number }> {
  return prisma.$transaction(async (db) => {
    const agent = await db.agent.findFirst({ where: { id: agentId, userId, revokedAt: null } });
    if (!agent) throw new HttpError(404, "not_found", "No such agent on your account.");
    const returnedMicro = agent.balanceMicro;
    await db.agent.update({ where: { id: agentId }, data: { keyHash: null, keyPrefix: null, revokedAt: new Date(), balanceMicro: 0 } });
    if (returnedMicro > 0) {
      await db.user.update({ where: { id: userId }, data: { balanceMicro: { increment: returnedMicro } } });
      await db.ledgerEntry.createMany({
        data: [
          { kind: "reclaim", agentId, amountMicro: -returnedMicro, note: "agent revoked" },
          { kind: "reclaim", userId, amountMicro: returnedMicro, note: `from ${agent.name} (revoked)` },
        ],
      });
    }
    return { returnedMicro };
  });
}

/** Moves money from the account to one of its agents. The balance check and the debit are one statement. */
export async function fundAgent(userId: string, agentId: string, amountMicro: number): Promise<void> {
  if (!Number.isInteger(amountMicro) || amountMicro <= 0) throw new HttpError(400, "invalid_amount", "Enter an amount greater than zero.");
  await prisma.$transaction(async (db) => {
    const agent = await db.agent.findFirst({ where: { id: agentId, userId, revokedAt: null } });
    if (!agent) throw new HttpError(404, "not_found", "No such agent on your account.");
    const took = await db.user.updateMany({ where: { id: userId, balanceMicro: { gte: amountMicro } }, data: { balanceMicro: { decrement: amountMicro } } });
    if (took.count === 0) throw new HttpError(400, "insufficient", "Your account does not have that much. Deposit first.");
    await db.agent.update({ where: { id: agentId }, data: { balanceMicro: { increment: amountMicro } } });
    await db.ledgerEntry.createMany({
      data: [
        { kind: "allocate", userId, amountMicro: -amountMicro, note: `to ${agent.name}` },
        { kind: "allocate", agentId, amountMicro, note: "from your account" },
      ],
    });
  });
}

/** Takes unspent money back from an agent to the account. */
export async function reclaimFromAgent(userId: string, agentId: string, amountMicro: number): Promise<void> {
  if (!Number.isInteger(amountMicro) || amountMicro <= 0) throw new HttpError(400, "invalid_amount", "Enter an amount greater than zero.");
  await prisma.$transaction(async (db) => {
    const agent = await db.agent.findFirst({ where: { id: agentId, userId, revokedAt: null } });
    if (!agent) throw new HttpError(404, "not_found", "No such agent on your account.");
    const took = await db.agent.updateMany({ where: { id: agentId, balanceMicro: { gte: amountMicro } }, data: { balanceMicro: { decrement: amountMicro } } });
    if (took.count === 0) throw new HttpError(400, "insufficient", "That agent does not have that much.");
    await db.user.update({ where: { id: userId }, data: { balanceMicro: { increment: amountMicro } } });
    await db.ledgerEntry.createMany({
      data: [
        { kind: "reclaim", agentId, amountMicro: -amountMicro, note: "back to your account" },
        { kind: "reclaim", userId, amountMicro, note: `from ${agent.name}` },
      ],
    });
  });
}

// ---------- wallet ----------

/**
 * Registers the Solana address this account is paid at. An API already published keeps working:
 * its payout address follows.
 */
export async function setWallet(userId: string, address: string): Promise<void> {
  await prisma.$transaction(async (db) => {
    await db.user.update({ where: { id: userId }, data: { walletAddress: address } });
    const seller = await db.seller.findUnique({ where: { userId }, select: { id: true } });
    if (seller) {
      await db.seller.update({ where: { id: seller.id }, data: { payoutAddress: address } });
      await db.provider.updateMany({ where: { sellerId: seller.id }, data: { payTo: address } });
    }
  });
}

/** The seller profile of this account, made on first use. Needs a registered wallet to be paid at. */
export async function ensureSellerFor(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true, walletAddress: true, seller: { select: { id: true, payoutAddress: true } } } });
  if (!user) throw new HttpError(401, "signed_out", "Sign in to continue.");
  if (!user.walletAddress) throw new HttpError(400, "wallet_required", "Add the Solana wallet you want to be paid at first (Wallet tab).");
  if (user.seller) return user.seller.id;
  // the seller key of a profile that belongs to an account is never handed out: the session is the credential
  const k = generateKey("seller");
  const seller = await prisma.seller.create({ data: { name: user.name, email: user.email, payoutAddress: user.walletAddress, keyHash: k.hash, keyPrefix: k.prefix, userId } });
  return seller.id;
}

// ---------- the dashboard's view of an account ----------

export interface AccountView {
  user: { id: string; email: string; name: string; createdAt: string; balanceMicro: number; wallet: { address: string } | null; payWallet: string | null };
  agents: { id: string; name: string; keyPrefix: string | null; balanceMicro: number; sessionSpendMicro: number; policy: ReturnType<typeof parsePolicy>; createdAt: string; look: LookParts; appetite: number }[];
  seller: { apis: number; online: number; balanceMicro: number; paidOutMicro: number } | null;
  sessions: { id: string; createdAt: string; lastUsedAt: string; userAgent: string | null; current: boolean }[];
  ledger: { id: number; at: string; kind: string; amountMicro: number; note: string | null }[];
}

export async function accountView(userId: string, currentSessionId: string): Promise<AccountView> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      agents: { where: { revokedAt: null }, orderBy: { createdAt: "asc" } },
      seller: { include: { providers: { select: { status: true } } } },
      sessions: { orderBy: { lastUsedAt: "desc" }, take: 10 },
    },
  });
  if (!user) throw new HttpError(401, "signed_out", "Sign in to continue.");
  const agentIds = user.agents.map((a) => a.id);
  const ledger = await prisma.ledgerEntry.findMany({ where: { OR: [{ userId }, ...(agentIds.length ? [{ agentId: { in: agentIds } }] : [])] }, orderBy: { id: "desc" }, take: 25 });
  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt.toISOString(),
      balanceMicro: user.balanceMicro,
      wallet: user.walletAddress ? { address: user.walletAddress } : null,
      payWallet: user.payWallet,
    },
    agents: user.agents.map((a) => ({ id: a.id, name: a.name, keyPrefix: a.keyPrefix, balanceMicro: a.balanceMicro, sessionSpendMicro: a.sessionSpendMicro, policy: parsePolicy(a.policy), createdAt: a.createdAt.toISOString(), look: partsOf(a.look, a.id), appetite: appetite(a.appetite).level })),
    seller: user.seller ? { apis: user.seller.providers.length, online: user.seller.providers.filter((p) => p.status === "online").length, balanceMicro: user.seller.balanceMicro, paidOutMicro: user.seller.paidOutMicro } : null,
    sessions: user.sessions.map((s) => ({ id: s.id, createdAt: s.createdAt.toISOString(), lastUsedAt: s.lastUsedAt.toISOString(), userAgent: s.userAgent, current: s.id === currentSessionId })),
    ledger: ledger.map((l) => ({ id: l.id, at: l.createdAt.toISOString(), kind: l.kind, amountMicro: l.amountMicro, note: l.note })),
  };
}

export async function accountActivity(userId: string, limit = 20) {
  const agents = await prisma.agent.findMany({ where: { userId }, select: { id: true } });
  return listTransactionsForAgents(agents.map((a) => a.id), limit);
}
