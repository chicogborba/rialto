import { SEED_PROVIDERS, SEED_SERVICES } from "../../prisma/seed-data";
import { createInProcessExecutor } from "@/lib/providers/in-process-executor";
import { defaultPolicy } from "@/lib/wallet/policy";
import { DemoPaymentRail } from "@/lib/x402/demo-rail";
import type { Candidate, Clock, Constraints, SpendingPolicy, WalletState } from "@/lib/types";
import { testClock } from "./clock";
import { DemoAgentPlanner } from "./demo-planner";
import type { RunEvent } from "./events";
import { runAgent, type RunDeps, type TransactionRecord } from "./run";

/** In-memory RunDeps over the seed data. Used by tests, the run recorder and seed history. No DB, no HTTP. */

export function seedCandidates(): Candidate[] {
  return SEED_SERVICES.map((seedService) => {
    const seedProvider = SEED_PROVIDERS.find((p) => p.id === seedService.providerId);
    if (!seedProvider) throw new Error(`seed provider missing for ${seedService.id}`);
    // Strip seed-only fields so events never carry internal data.
    const { payTo: _payTo, ...provider } = seedProvider;
    const { demoFailFirstCall: _fail, ...service } = seedService;
    return { provider, service };
  });
}

export interface Harness {
  deps: RunDeps;
  wallet: WalletState;
  ledger: TransactionRecord[];
  candidates: Candidate[];
}

export function createHarness(policy: SpendingPolicy = defaultPolicy(), clock: Clock = testClock()): Harness {
  const rail = new DemoPaymentRail(clock);
  const candidates = seedCandidates();
  const wallet: WalletState = { balanceMicro: 10_000_000, sessionSpendMicro: 0, policy };
  const ledger: TransactionRecord[] = [];
  const failFirst = new Set(SEED_SERVICES.filter((s) => s.demoFailFirstCall).map((s) => s.id));
  const payTo = new Map(SEED_PROVIDERS.map((p) => [p.id, p.payTo]));
  const deps: RunDeps = {
    planner: new DemoAgentPlanner(),
    rail,
    clock,
    registry: { listCandidates: () => Promise.resolve(candidates), history: () => Promise.resolve({}) },
    wallet: {
      get: () => Promise.resolve({ ...wallet }),
      debit: (amt) => {
        wallet.balanceMicro -= amt;
        wallet.sessionSpendMicro += amt;
        return Promise.resolve({ ...wallet });
      },
    },
    executor: createInProcessExecutor(candidates, rail, (id) => payTo.get(id) ?? id, failFirst),
    ledger: {
      record: (tx) => {
        ledger.push(tx);
        return Promise.resolve();
      },
    },
  };
  return { deps, wallet, ledger, candidates };
}

export async function collectRun(
  goal: string,
  constraints: Constraints,
  h: Harness = createHarness(constraints.policy),
  runId = "run_test",
): Promise<{ events: RunEvent[]; h: Harness }> {
  const events: RunEvent[] = [];
  for await (const e of runAgent({ goal, constraints, runId }, h.deps)) events.push(e);
  return { events, h };
}
