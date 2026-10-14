import type { CapabilityId } from "@/lib/types";
import type { Route } from "@/lib/agent/scenarios";
import { toDollars } from "@/lib/money";
import type { Candidate } from "@/lib/types";

/** A failure the agent should read as an instruction, not as a crash. */
export class ToolError extends Error {}

const usd = (micro: number) => toDollars(micro);

/** Said to an agent that asked the hosted endpoint to buy from a seller that is paid on-chain. */
export const SIGNER_HELP =
  "This seller is paid on-chain, straight from YOUR Solana wallet to theirs: Rialto never holds your money, so the hosted endpoint cannot pay it. Use the local signer instead (it keeps your key on your machine): add the Rialto MCP server with `npm run mcp` from the repo and SOLANA_WALLET_KEY set (see the README, \"Connect your agent\"). Everything else (discover, compare, plan) works here.";

/** What the caller pinned down: a capability, a provider, or both. A provider alone brings its capability. */
export function resolveRoute(args: { capability?: CapabilityId; provider?: string }, candidates: Candidate[]): Route {
  if (!args.provider) return { capability: args.capability };
  const needle = args.provider.trim().toLowerCase();
  const offered = candidates.filter((c) => c.provider.id === args.provider || c.provider.slug === needle || c.provider.name.toLowerCase() === needle);
  if (offered.length === 0) throw new ToolError(`Unknown provider "${args.provider}". Use discover_services to see the providers of a capability.`);
  const hit = offered.find((c) => c.service.capability === args.capability) ?? (args.capability ? null : offered[0]);
  if (!hit) throw new ToolError(`${offered[0].provider.name} does not offer ${args.capability}; it offers ${offered.map((c) => c.service.capability).join(", ")}.`);
  return { capability: hit.service.capability, providerId: hit.provider.id };
}

/**
 * Why nobody qualified, and what to do about it. The usual reason is money: video, music and 3D cost
 * more than the default budget of a run or the wallet's limit per call.
 */
export function noProviderMessage(capability: CapabilityId, rejected: { candidate: Candidate; reason: string }[], maxPerRequestMicro: number): string {
  if (rejected.length === 0) return `Nobody on Rialto offers ${capability} yet. Call discover_services without arguments to see what is available.`;
  const reasons = rejected.map((r) => `${r.candidate.provider.name}=${r.reason}`).join(", ");
  const cheapest = Math.min(...rejected.map((r) => r.candidate.service.priceMicro));
  const hints: string[] = [];
  if (rejected.some((r) => r.reason === "over_budget")) hints.push(`pass budgetUsd of at least ${usd(cheapest)}`);
  if (rejected.every((r) => r.reason === "over_max_per_request")) hints.push(`the wallet allows ${usd(maxPerRequestMicro)} per call and the cheapest costs ${usd(cheapest)}: the owner must raise "may spend per call" in the agent's spending limits`);
  return `No qualified provider for ${capability}: ${reasons}.${hints.length ? ` To fix: ${hints.join("; ")}.` : ""}`;
}
