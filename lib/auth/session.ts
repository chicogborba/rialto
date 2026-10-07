import { prisma } from "@/lib/db/client";
import { DEFAULT_AGENT_ID } from "@/lib/db/repo";
import { HttpError } from "@/lib/http";
import { bearerFrom, hashKey, kindOfKey } from "@/lib/security/keys";
import { allow } from "@/lib/security/rate-limit";

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

export async function sellerFromRequest(req: Request): Promise<SellerCtx> {
  const key = bearerFrom(req.headers.get("authorization"));
  if (!key) throw new HttpError(401, "missing_key", "Send your seller key as `Authorization: Bearer rl_seller_…`");
  if (kindOfKey(key) !== "seller") throw new HttpError(401, "wrong_key", "That is not a seller key");
  const seller = await prisma.seller.findUnique({ where: { keyHash: hashKey(key) }, select: { id: true } });
  if (!seller) throw new HttpError(401, "invalid_key", "Unknown or revoked key");
  if (!allow(`seller:${seller.id}`, 30, 5)) throw new HttpError(429, "rate_limited", "Too many requests, slow down");
  return { sellerId: seller.id };
}
