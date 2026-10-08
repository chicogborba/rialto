import type { PaymentRequirements } from "@/lib/x402/rail";
import type { CapabilityId, MicroUsdc, PaymentMode, Provider, Service, WalletState } from "@/lib/types";
import type { RunEvent } from "@/lib/agent/events";

export interface ProviderWithServices {
  provider: Provider;
  services: Service[];
  /** registered by a user, no history yet */
  unproven: boolean;
}

export interface WalletResponse {
  wallet: WalletState;
  mode: PaymentMode;
  agentName: string;
}

export type TxStatus = "settled" | "failed_not_charged" | "rejected_by_policy";

export interface TransactionRow {
  id: string;
  createdAt: string;
  agentId: string;
  runId: string;
  stepId: string;
  capability: CapabilityId;
  providerId: string;
  providerName: string;
  amountMicro: MicroUsdc;
  network: string;
  status: TxStatus;
  mode: PaymentMode;
  txRef: string | null;
  /** block explorer link for payments made on the live rail; null on the simulation */
  explorerUrl: string | null;
  latencyMs: number | null;
}

export interface TransactionDetail extends TransactionRow {
  role: string;
  requirements: PaymentRequirements | null;
  result: unknown;
  error: string | null;
  provider: Provider;
  events: RunEvent[];
}

export interface StatsResponse {
  totalSpendMicro: MicroUsdc;
  runs: number;
  servicesPurchased: number;
  avgCostMicro: MicroUsdc;
  avgLatencyMs: number;
  successRate: number;
  providerDiversity: { used: number; total: number };
  savings: {
    premiumBaselineMicro: MicroUsdc;
    cheapestBaselineMicro: MicroUsdc;
    actualMicro: MicroUsdc;
    savedMicro: MicroUsdc;
    avgQualityDelta: number;
  };
  spendByCapability: { capability: CapabilityId; spendMicro: MicroUsdc; count: number }[];
  costPerRun: { runId: string; createdAt: string; costMicro: MicroUsdc; premiumMicro: MicroUsdc }[];
}

export interface ReputationPoint {
  at: string;
  reputation: number;
}
