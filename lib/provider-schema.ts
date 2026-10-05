import { z } from "zod";
import { isCapabilityId } from "@/lib/agent/capabilities";

/** Shared by the register form (client validation) and POST /api/providers. */
export const RegisterProviderSchema = z.object({
  name: z.string().trim().min(2, "At least 2 characters").max(40),
  description: z.string().trim().min(5, "At least 5 characters").max(200),
  capabilities: z.array(z.string().refine(isCapabilityId, "Unknown capability")).min(1, "Pick at least one capability"),
  endpoint: z
    .string()
    .url("Must be a valid URL")
    .refine((u) => /^https?:\/\//.test(u), "Must be http(s)"),
  priceUsd: z.number().min(0.0001, "Min $0.0001").max(5, "Max $5"),
  latencyMs: z.number().int().min(1, "Min 1ms").max(60_000),
  quality: z.number().min(0).max(100, "0–100"),
  network: z.literal("solana-devnet").default("solana-devnet"),
  x402Enabled: z.boolean().default(true),
});
export type RegisterProviderInput = z.infer<typeof RegisterProviderSchema>;
