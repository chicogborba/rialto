import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/repo", () => ({ getWallet: vi.fn() }));
vi.mock("@/lib/wallet/allowance", () => ({ payerForAgent: vi.fn() }));
vi.mock("@/lib/x402", () => ({ currentMode: vi.fn() }));

import { getWallet } from "@/lib/db/repo";
import { payerForAgent } from "@/lib/wallet/allowance";
import { currentMode } from "@/lib/x402";
import { getWalletStatus } from "@/lib/mcp/tools";

const ctx = { agentId: "agent", baseUrl: "http://localhost" };

describe("hosted MCP payment status", () => {
  beforeEach(() => {
    vi.mocked(getWallet).mockResolvedValue({ balanceMicro: 0, sessionSpendMicro: 200_000, policy: { maxPerRequestMicro: 200_000, sessionBudgetMicro: 1_500_000, minQuality: 75, requireX402: true, allowedNetworks: ["solana-mainnet"], allowedProviderIds: "any" } });
    vi.mocked(currentMode).mockReturnValue("live");
    vi.mocked(payerForAgent).mockResolvedValue({ wallet: "linked-wallet", spendableMicro: 5_000_000, spender: {} as never, rpcUrl: "http://localhost" });
  });

  it("reports live payments with a funded wallet even with zero test credit", async () => {
    const status = await getWalletStatus(ctx);
    expect(status).toMatchObject({ mode: "live", payingWallet: { allowanceLeftUsd: 5 }, onChainPayments: { enabled: true, ready: true }, sessionRemainingUsd: 1.3 });
    expect(status).not.toHaveProperty("balanceUsd");
    expect(status).not.toHaveProperty("testCredit");
  });

  it("distinguishes a live platform from an agent without a linked wallet", async () => {
    vi.mocked(payerForAgent).mockResolvedValue(null);
    expect(await getWalletStatus(ctx)).toMatchObject({ mode: "live", payingWallet: { address: null }, onChainPayments: { enabled: true, ready: false } });
  });

  it("does not call an exhausted allowance ready to pay", async () => {
    vi.mocked(payerForAgent).mockResolvedValue({ wallet: "linked-wallet", spendableMicro: 0, spender: {} as never, rpcUrl: "http://localhost" });
    expect(await getWalletStatus(ctx)).toMatchObject({ onChainPayments: { enabled: true, ready: false } });
  });

  it("reports simulation when the live rail is disabled", async () => {
    vi.mocked(currentMode).mockReturnValue("simulated");
    vi.mocked(payerForAgent).mockResolvedValue(null);
    expect(await getWalletStatus(ctx)).toMatchObject({ mode: "simulated", realPayments: "off", onChainPayments: { enabled: false, ready: false } });
  });
});
