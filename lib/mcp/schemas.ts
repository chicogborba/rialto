import { z } from "zod";
import { ALL_CAPABILITIES } from "@/lib/agent/capabilities";
import type { CapabilityId } from "@/lib/types";

export const PresetSchema = z.enum(["balanced", "accuracy", "cost", "speed"]);
export const WeightsShape = z.object({ quality: z.number().min(0), price: z.number().min(0), latency: z.number().min(0), trust: z.number().min(0) });
export const CapabilitySchema = z.enum(ALL_CAPABILITIES as [CapabilityId, ...CapabilityId[]]);

export const discoverInput = {
  capability: CapabilitySchema.optional().describe("Leave out to list every capability on Rialto with how many providers offer it."),
  maxPriceUsd: z.number().min(0).optional(),
};

export const compareInput = {
  serviceIds: z.array(z.string()).min(1),
  preset: PresetSchema.optional(),
  weights: WeightsShape.optional(),
};

export const reputationInput = { provider: z.string().describe("Provider slug, id or name") };

export const planInput = {
  goal: z.string().min(3).describe("What you need, in words. This text is what the provider receives: put the prompt here, text to speak or translate in double quotes, and the https link of any file the provider should work on (an image to edit, audio to transcribe)."),
  budgetUsd: z.number().min(0).optional().describe("The most this run may spend. Default $0.10; raise it for video, music or 3D."),
  preset: PresetSchema.optional(),
  capability: CapabilitySchema.optional().describe("Name the capability instead of letting Rialto read it from the goal's wording. See discover_services."),
  provider: z.string().optional().describe("Use this provider only (slug, id or name from discover_services). Without it Rialto picks the best one for your preset."),
};
export type GoalArgs = { goal: string; budgetUsd?: number; preset?: z.infer<typeof PresetSchema>; capability?: CapabilityId; provider?: string };


export const transactionsInput = { limit: z.number().int().min(1).max(100).optional() };

export const rateInput = {
  runId: z.string().optional().describe("The runId execute_service returned. Without it (and without purchaseId) your latest unrated purchase is rated."),
  purchaseId: z.string().optional().describe("A transaction id from get_transactions, to rate one purchase in particular."),
  score: z.number().int().min(1).max(5).describe("1 unusable, 2 poor, 3 usable, 4 good, 5 exactly what you asked for."),
  note: z.string().max(280).optional().describe("One short reason, e.g. 'background not transparent'."),
};
