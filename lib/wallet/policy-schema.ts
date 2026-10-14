import { z } from "zod";
import type { SpendingPolicy } from "@/lib/types";

export const PolicySchema = z.object({
  maxPerRequestMicro: z.number().int().min(0),
  sessionBudgetMicro: z.number().int().min(0),
  allowedNetworks: z.array(z.enum(["solana-devnet", "solana-mainnet"])),
  allowedProviderIds: z.union([z.literal("any"), z.array(z.string())]),
  minQuality: z.number().min(0).max(100),
  requireX402: z.boolean(),
});

/**
 * The network is the server's setting, not an agent's: a policy saved while the server ran on devnet
 * must keep working after it moves to mainnet, so both names are always allowed.
 */
export function parsePolicy(json: string): SpendingPolicy {
  const policy = PolicySchema.parse(JSON.parse(json));
  return { ...policy, allowedNetworks: ["solana-devnet", "solana-mainnet"] };
}
