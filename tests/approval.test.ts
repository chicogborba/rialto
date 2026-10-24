import { describe, expect, it } from "vitest";
import { getSetComputeUnitLimitInstruction, getSetComputeUnitPriceInstruction, getSetLoadedAccountsDataSizeLimitInstruction } from "@solana-program/compute-budget";
import { findAssociatedTokenPda, getApproveCheckedInstruction, TOKEN_PROGRAM_ADDRESS } from "@solana-program/token";
import { address, appendTransactionMessageInstructions, blockhash, compileTransaction, createNoopSigner, createTransactionMessage, generateKeyPairSigner, partiallySignTransaction, pipe, setTransactionMessageFeePayer, setTransactionMessageLifetimeUsingBlockhash, type Instruction } from "@solana/kit";
import { checkApproval } from "@/lib/wallet/allowance";

const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

/** What the server prepares and the wallet signs: the wallet's signature first, nothing from the spender yet. */
async function signedByWallet(extra: Instruction[] = [], feePayer?: string) {
  const owner = await generateKeyPairSigner();
  const spender = await generateKeyPairSigner();
  const [source] = await findAssociatedTokenPda({ owner: owner.address, mint: address(USDC), tokenProgram: TOKEN_PROGRAM_ADDRESS });
  const approve = getApproveCheckedInstruction({ source, mint: address(USDC), delegate: spender.address, owner: createNoopSigner(owner.address), amount: BigInt(5_000_000), decimals: 6 });
  const message = pipe(
    createTransactionMessage({ version: 0 }),
    (m) => setTransactionMessageFeePayer(address(feePayer ?? spender.address), m),
    (m) => setTransactionMessageLifetimeUsingBlockhash({ blockhash: blockhash("EETubP5AKHgjPAhzPAFcb8BAY1hMH639CWCFTqi3hq1k"), lastValidBlockHeight: BigInt(1) }, m),
    (m) => appendTransactionMessageInstructions([getSetComputeUnitLimitInstruction({ units: 10_000 }), getSetLoadedAccountsDataSizeLimitInstruction({ accountDataSizeLimit: 512 * 1024 }), approve, ...extra], m),
  );
  const tx = await partiallySignTransaction([owner.keyPair], compileTransaction(message));
  return { tx, owner: owner.address as string, spender: spender.address as string };
}

describe("an approval signed by the buyer's wallet", () => {
  it("is accepted when it is exactly what Rialto prepared", async () => {
    const { tx, owner, spender } = await signedByWallet();
    await expect(checkApproval(tx, owner, spender, USDC)).resolves.toBe("approve");
  });
  it("is refused when anything else rides on the spender's fee", async () => {
    // a System Program transfer (instruction 2) the spender would end up paying the fee for
    const transfer: Instruction = { programAddress: address("11111111111111111111111111111111"), accounts: [], data: new Uint8Array([2, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0]) };
    const { tx, owner, spender } = await signedByWallet([transfer]);
    await expect(checkApproval(tx, owner, spender, USDC)).rejects.toThrow(/unexpected instruction/);
  });
  it("is refused with a priority fee that would drain the spender", async () => {
    const { tx, owner, spender } = await signedByWallet([getSetComputeUnitPriceInstruction({ microLamports: BigInt(10_000_000) })]);
    await expect(checkApproval(tx, owner, spender, USDC)).rejects.toThrow(/priority fee/);
  });
  it("is refused when someone else pays the fee or signed it", async () => {
    const other = await generateKeyPairSigner();
    const a = await signedByWallet([], other.address);
    await expect(checkApproval(a.tx, a.owner, a.spender, USDC)).rejects.toThrow(/fee payer/);
    const b = await signedByWallet();
    await expect(checkApproval(b.tx, other.address, b.spender, USDC)).rejects.toThrow();
  });
});
