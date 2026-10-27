import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getBase64Encoder, getBase64EncodedWireTransaction, getCompiledTransactionMessageDecoder, getTransactionDecoder, generateKeyPairSigner, partiallySignTransaction, type KeyPairSigner } from "@solana/kit";
import { ComputeBudgetInstruction, identifyComputeBudgetInstruction, parseSetComputeUnitLimitInstruction, parseSetLoadedAccountsDataSizeLimitInstruction } from "@solana-program/compute-budget";
import { buildApproveTransaction, buildRevokeTransaction } from "@/lib/x402/delegate";
import { LIVE_ASSET } from "@/lib/x402/solana";
import { RpcBusyError } from "@/lib/x402/rpc-busy";
import { signerFromSecret } from "@/lib/x402/live-client";
import { handle } from "@/lib/http";
import { submit } from "@/lib/wallet/allowance";

const mocks = vi.hoisted(() => ({
  send: vi.fn(),
  status: vi.fn(),
  update: vi.fn(),
  findUser: vi.fn(),
}));

vi.mock("@/lib/db/client", () => ({ prisma: { user: { update: mocks.update, findUnique: mocks.findUser } } }));
vi.mock("@/lib/x402/live-client", async (original) => ({ ...await original<typeof import("@/lib/x402/live-client")>(), signerFromSecret: vi.fn() }));
vi.mock("@/lib/x402/solana", async (original) => ({
  ...await original<typeof import("@/lib/x402/solana")>(),
  solanaRpc: () => ({
    getLatestBlockhash: () => ({ send: async () => ({ value: { blockhash: "EETubP5AKHgjPAhzPAFcb8BAY1hMH639CWCFTqi3hq1k", lastValidBlockHeight: BigInt(1) } }) }),
    sendTransaction: () => ({ send: mocks.send }),
    getSignatureStatuses: () => ({ send: mocks.status }),
  }),
}));

let owner: KeyPairSigner;
let spender: KeyPairSigner;
let transaction: string;

beforeAll(async () => {
  owner = await generateKeyPairSigner();
  spender = await generateKeyPairSigner();
  const prepared = await buildApproveTransaction({ rpcUrl: "http://localhost", owner: owner.address, mint: LIVE_ASSET, spender, amountMicro: 5_000_000 });
  const tx = getTransactionDecoder().decode(getBase64Encoder().encode(prepared));
  transaction = getBase64EncodedWireTransaction(await partiallySignTransaction([owner.keyPair], tx));
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("PAYMENT_MODE", "live");
  vi.stubEnv("PLATFORM_FEE_PAYTO", spender.address);
  vi.stubEnv("RIALTO_SPENDER_KEY", "test-spender");
  globalThis.__rialtoSpender = undefined;
  vi.mocked(signerFromSecret).mockResolvedValue(spender);
  mocks.send.mockResolvedValue("test-signature");
  mocks.status.mockResolvedValue({ value: [{ err: null, confirmationStatus: "confirmed" }] });
  mocks.findUser.mockResolvedValue({ payWallet: null, payWalletAt: null });
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  globalThis.__rialtoSpender = undefined;
});

const send = () => handle(async () => Response.json(await submit("user-1", owner.address, transaction)));

describe("wallet approval submission", () => {
  it("returns a useful rejection when Solana's error context contains BigInts", async () => {
    mocks.send.mockRejectedValue(Object.assign(new Error("Transaction simulation failed"), {
      context: { slot: BigInt(462111106), preflight: { err: "MaxLoadedAccountsDataSizeExceeded", unitsConsumed: BigInt(0) } },
    }));
    const response = await send();
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: { code: "send_failed", message: expect.stringContaining("safety checks") } });
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("still explains an expired blockhash when the rejection contains BigInts", async () => {
    mocks.send.mockRejectedValue(Object.assign(new Error("Transaction simulation failed"), { context: { err: "BlockhashNotFound", slot: BigInt(1) } }));
    const response = await send();
    expect(response.status).toBe(400);
    expect((await response.json()).error.message).toContain("expire");
  });

  it("preserves the retryable response when the RPC is busy", async () => {
    mocks.send.mockRejectedValue(new RpcBusyError(429));
    const response = await send();
    expect(response.status).toBe(503);
    expect(response.headers.get("retry-after")).toBe("10");
    expect((await response.json()).error.code).toBe("solana_busy");
  });

  it("links the wallet only after confirmation", async () => {
    mocks.status.mockImplementationOnce(async () => {
      expect(mocks.update).not.toHaveBeenCalled();
      return { value: [{ err: null, confirmationStatus: "confirmed" }] };
    });
    expect((await send()).status).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith({ where: { id: "user-1" }, data: { payWallet: owner.address, payWalletAt: expect.any(Date) } });
  });

  it("does not link a transaction that failed on-chain", async () => {
    mocks.status.mockResolvedValue({ value: [{ err: { InstructionError: [2, "InvalidAccountData"] }, confirmationStatus: "confirmed" }] });
    const response = await send();
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("failed");
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("does not link a transaction that never confirms", async () => {
    const timeout = globalThis.setTimeout;
    vi.spyOn(globalThis, "setTimeout").mockImplementation(((callback: () => void) => timeout(callback, 0)) as typeof setTimeout);
    mocks.status.mockResolvedValue({ value: [null] });
    const response = await send();
    expect(response.status).toBe(504);
    expect((await response.json()).error.code).toBe("confirmation_timeout");
    expect(mocks.status).toHaveBeenCalledTimes(40);
    expect(mocks.update).not.toHaveBeenCalled();
  });
});

describe("transaction budgets for wallet safety checks", () => {
  it("leaves room for Lighthouse on both approval and revocation", async () => {
    const opts = { rpcUrl: "http://localhost", owner: owner.address, mint: LIVE_ASSET, spender };
    for (const wire of [await buildApproveTransaction({ ...opts, amountMicro: 5_000_000 }), await buildRevokeTransaction(opts)]) {
      const tx = getTransactionDecoder().decode(getBase64Encoder().encode(wire));
      const message = getCompiledTransactionMessageDecoder().decode(tx.messageBytes);
      const compute = message.instructions[0];
      const loaded = message.instructions[1];
      if (!compute.data || !loaded.data) throw new Error("Missing transaction budgets");
      expect(identifyComputeBudgetInstruction(compute.data)).toBe(ComputeBudgetInstruction.SetComputeUnitLimit);
      expect(parseSetComputeUnitLimitInstruction({ data: compute.data, programAddress: message.staticAccounts[compute.programAddressIndex] }).data.units).toBeGreaterThanOrEqual(20_000);
      expect(identifyComputeBudgetInstruction(loaded.data)).toBe(ComputeBudgetInstruction.SetLoadedAccountsDataSizeLimit);
      // The failing production transaction loaded 533,855 bytes; the old 512 KiB limit was too small.
      expect(parseSetLoadedAccountsDataSizeLimitInstruction({ data: loaded.data, programAddress: message.staticAccounts[loaded.programAddressIndex] }).data.accountDataSizeLimit).toBeGreaterThanOrEqual(1024 * 1024);
    }
  });
});
