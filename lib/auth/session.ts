import { prisma } from "@/lib/db/client";
import { DEFAULT_AGENT_ID } from "@/lib/db/repo";
import { HttpError } from "@/lib/http";
import { bearerFrom, hashKey, kindOfKey } from "@/lib/security/keys";
import { allow } from "@/lib/security/rate-limit";
import { ensureSellerFor } from "@/lib/db/users";
import { requireUser, userFromRequest } from "./account";

/**
 * Identity for a request. The API key IS the identity (no passwords yet): buyers use `rl_buyer_…`,
 * sellers `rl_seller_…`. Only the sha256 of a key is stored.
 */

export interface BuyerCtx {
  agentId: string;
  /** false = the built-in local demo agent (no key sent) */
  authed: boolean;
}

export async function buyerFromRequest(req: Request, opts: { requireKey?: boolean } = {}): Promise<BuyerCtx> {
  const key = bearerFrom(req.headers.get("authorization"));
  if (!key) {
    if (opts.requireKey) throw new HttpError(401, "missing_key", "Send your buyer key as `Authorization: Bearer rl_buyer_…`");
    return { agentId: DEFAULT_AGENT_ID, authed: false };
  }
  if (kindOfKey(key) !== "buyer") throw new HttpError(401, "wrong_key", "That is not a buyer key");
  const agent = await prisma.agent.findUnique({ where: { keyHash: hashKey(key) }, select: { id: true } });
  if (!agent) throw new HttpError(401, "invalid_key", "Unknown or revoked key");
  if (!allow(`buyer:${agent.id}`, 30, 5)) throw new HttpError(429, "rate_limited", "Too many requests, slow down");
  return { agentId: agent.id, authed: true };
}

export interface SellerCtx {
  sellerId: string;
}

/**
 * A seller is either a seller key (programmatic publishing) or a signed-in account (the dashboard).
 * An account becomes a seller the first time it needs to be one, paid at the wallet it registered.
 */
export async function sellerFromRequest(req: Request): Promise<SellerCtx> {
  const key = bearerFrom(req.headers.get("authorization"));
  if (!key) {
    if (!(await userFromRequest(req))) throw new HttpError(401, "missing_key", "Sign in, or send your seller key as `Authorization: Bearer rl_seller_…`");
    const { user } = await requireUser(req);
    const sellerId = await ensureSellerFor(user.id);
    if (!allow(`seller:${sellerId}`, 30, 5)) throw new HttpError(429, "rate_limited", "Too many requests, slow down");
    return { sellerId };
  }
  if (kindOfKey(key) !== "seller") throw new HttpError(401, "wrong_key", "That is not a seller key");
  const seller = await prisma.seller.findUnique({ where: { keyHash: hashKey(key) }, select: { id: true } });
  if (!seller) throw new HttpError(401, "invalid_key", "Unknown or revoked key");
  if (!allow(`seller:${seller.id}`, 30, 5)) throw new HttpError(429, "rate_limited", "Too many requests, slow down");
  return { sellerId: seller.id };
}
