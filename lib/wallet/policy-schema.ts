import { z } from "zod";
import type { SpendingPolicy } from "@/lib/types";

export const PolicySchema = z.object({
  maxPerRequestMicro: z.number().int().min(0),
  sessionBudgetMicro: z.number().int().min(0),
  allowedNetworks: z.array(z.literal("solana-devnet")),
  allowedProviderIds: z.union([z.literal("any"), z.array(z.string())]),
  minQuality: z.number().min(0).max(100),
  requireX402: z.boolean(),
});

export function parsePolicy(json: string): SpendingPolicy {
  return PolicySchema.parse(JSON.parse(json));
}
