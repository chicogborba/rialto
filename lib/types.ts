/** Shared domain types. Money is always integer micro-USDC (1 USDC = 1_000_000). */

export type MicroUsdc = number;
export type PaymentMode = "simulated" | "live";
export type Network = "solana-devnet";

export type CapabilityId =
  | "image.sprites"
  | "vision.damage_detection"
  | "market.quotes"
  | "news.search"
  | "filings.sec"
  | "web.search"
  | "llm.analysis"
  | "text.translate"
  | "text.summarize";

export type ProviderStatus = "online" | "degraded" | "offline";

export interface Provider {
  id: string;
  slug: string;
  name: string;
  description: string;
  network: Network;
  x402Enabled: boolean;
  status: ProviderStatus;
  /** 0–100 benchmark */
  qualityScore: number;
  /** 0–100 */
  reputationScore: number;
  /** 0–100 */
  successRate: number;
  /** expected p50 */
  latencyMs: number;
  requestCount: number;
  isDemo: boolean;
}

export interface Service {
  id: string;
  providerId: string;
  capability: CapabilityId;
  /** "/api/x/{slug}/{capability}" */
  endpoint: string;
  priceMicro: MicroUsdc;
  /** 0–1, 1 = native, <1 = adjacent capability */
  capabilityMatch: number;
  inputSchema: string;
  outputSchema: string;
}

export interface Candidate {
  provider: Provider;
  service: Service;
}

/** Weights sum to 1. */
export interface Weights {
  quality: number;
  price: number;
  latency: number;
  trust: number;
}
export type PriorityPreset = "balanced" | "accuracy" | "cost" | "speed" | "custom";

export interface SpendingPolicy {
  maxPerRequestMicro: MicroUsdc;
  sessionBudgetMicro: MicroUsdc;
  allowedNetworks: Network[];
  allowedProviderIds: string[] | "any";
  minQuality: number;
  requireX402: boolean;
}

export interface WalletState {
  balanceMicro: MicroUsdc;
  sessionSpendMicro: MicroUsdc;
  policy: SpendingPolicy;
}

export interface Constraints {
  budgetMicro: MicroUsdc;
  weights: Weights;
  preset: PriorityPreset;
  policy: SpendingPolicy;
}

export type RejectionReason =
  | "offline"
  | "x402_disabled"
  | "over_max_per_request"
  | "over_budget"
  | "below_min_quality"
  | "network_not_allowed"
  | "provider_not_allowed";

export interface NormalizedScores {
  quality: number;
  price: number;
  latency: number;
  trust: number;
}

export interface ScoredCandidate {
  candidate: Candidate;
  normalized: NormalizedScores;
  /** 0.9–1.0 */
  historyFactor: number;
  /** 0–1 final */
  score: number;
  /** 1 = best */
  rank: number;
}

export interface DecisionExplanation {
  pros: string[];
  cons: string[];
  summary: string;
}

export interface RejectedCandidate {
  candidate: Candidate;
  reason: RejectionReason;
}

export interface PlanStep {
  id: string;
  capability: CapabilityId;
  dependsOn: string[];
  selected: ScoredCandidate;
  /** ranked, excluding selected. Fallback order. */
  alternatives: ScoredCandidate[];
  rejected: RejectedCandidate[];
  secondSource: ScoredCandidate | null;
  secondSourceReason: string | null;
  explanation: DecisionExplanation;
  /** number of candidates discovered for this capability */
  discoveredCount: number;
  /** price of the most expensive qualified candidate (premium baseline) */
  premiumPriceMicro: MicroUsdc;
  /** price of the cheapest qualified candidate */
  cheapestPriceMicro: MicroUsdc;
  /** quality of the cheapest qualified candidate */
  cheapestQuality: number;
}

export interface ExecutionPlan {
  goal: string;
  scenario: ScenarioId;
  requiredCapabilities: CapabilityId[];
  steps: PlanStep[];
  reasoning: string;
  estimatedCostMicro: MicroUsdc;
  /** critical path through the DAG */
  estimatedLatencyMs: number;
  /** 0–1 */
  confidence: number;
  plannerKind: "demo" | "llm";
}

export type ScenarioId = "sprites" | "vision" | "research" | "translate" | "generic";

export type ProviderHistory = Record<string, { recentSuccessRate: number; samples: number }>;

export interface AgentPlanner {
  plan(
    goal: string,
    constraints: Constraints,
    available: Candidate[],
    history: ProviderHistory,
  ): Promise<ExecutionPlan>;
}

export interface Clock {
  now(): number;
  sleep(ms: number): Promise<void>;
  id(prefix: string): string;
}

export interface DagNode {
  id: string;
  capability: CapabilityId;
  dependsOn: string[];
}

export class NoQualifiedProviderError extends Error {
  readonly capability: CapabilityId;
  readonly rejected: RejectedCandidate[];
  constructor(capability: CapabilityId, rejected: RejectedCandidate[]) {
    super(`No qualified provider for capability "${capability}"`);
    this.name = "NoQualifiedProviderError";
    this.capability = capability;
    this.rejected = rejected;
  }
}
