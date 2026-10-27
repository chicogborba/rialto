import { prisma } from "@/lib/db/client";
import { HttpError } from "@/lib/http";

/**
 * The buying agent's verdict on what it got: 1 (unusable) to 5 (exactly what was asked). A paid call
 * that "worked" can still return the wrong thing; only the buyer, having looked at it, can tell. Each
 * purchase can be rated once, by the agent that bought it, for a week. The rating is kept on the
 * purchase, averaged on the provider, and nudges the provider's reputation (which routing weighs),
 * a little more than an automatic success or failure does.
 */

export const RATING_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;

export interface RateInput {
  /** the purchase (transaction id), or the run of an execute_service call, or neither for the latest one */
  purchaseId?: string;
  runId?: string;
  score: number;
  note?: string;
}

export interface Rated {
  purchaseId: string;
  provider: string;
  score: number;
  providerRating: { average: number; count: number };
  reputation: number;
}

export async function ratePurchase(agentId: string, input: RateInput, now = new Date()): Promise<Rated> {
  const score = Math.round(input.score);
  if (!(score >= 1 && score <= 5)) throw new HttpError(400, "invalid_score", "Score from 1 (unusable) to 5 (exactly right).");
  const since = new Date(now.getTime() - RATING_WINDOW_MS);
  const where = { agentId, status: "settled", createdAt: { gte: since } };
  const tx = input.purchaseId
    ? await prisma.transaction.findFirst({ where: { ...where, id: input.purchaseId } })
    : input.runId
      ? await prisma.transaction.findFirst({ where: { ...where, runId: input.runId, rating: null }, orderBy: { createdAt: "desc" } })
      : await prisma.transaction.findFirst({ where: { ...where, rating: null }, orderBy: { createdAt: "desc" } });
  if (!tx) throw new HttpError(404, "not_found", "No paid purchase of yours from the last 7 days to rate (it must have been charged, and rated only once).");
  if (tx.rating !== null) throw new HttpError(409, "already_rated", "This purchase was already rated.");
  const note = input.note?.trim().slice(0, 280) || null;

  return prisma.$transaction(async (db) => {
    // the rating check and the write are one statement, so two calls cannot both rate it
    const took = await db.transaction.updateMany({ where: { id: tx.id, rating: null }, data: { rating: score, ratingNote: note, ratedAt: now } });
    if (took.count === 0) throw new HttpError(409, "already_rated", "This purchase was already rated.");
    const p = await db.provider.findUniqueOrThrow({ where: { id: tx.providerId } });
    const count = p.ratingCount + 1;
    const average = round2((p.ratingAvg * p.ratingCount + score) / count);
    const reputation = round1(p.reputationScore * 0.97 + ((score - 1) / 4) * 100 * 0.03);
    await db.provider.update({ where: { id: p.id }, data: { ratingAvg: average, ratingCount: count, reputationScore: reputation } });
    return { purchaseId: tx.id, provider: p.name, score, providerRating: { average, count }, reputation };
  });
}
