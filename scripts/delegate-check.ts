// Checks paying from an existing wallet through an allowance, against whatever SOLANA_NETWORK names:
// the buyer (SOLANA_WALLET_KEY) approves Rialto's spender (RIALTO_SPENDER_KEY) for a few cents, the
// spender signs one x402 purchase from the buyer's USDC account ($0.001 to SOLANA_PAY_TO plus the
// commission), the facilitator verifies and settles both legs, then the buyer revokes the allowance.
// What the dashboard does with Phantom, done here with keys so it can run unattended.
//
//   npm run delegate:check
import { existsSync } from "node:fs";
import { createSolanaRpc, getBase64Encoder, getTransactionDecoder, getBase64EncodedWireTransaction, signTransaction, type Signature } from "@solana/kit";
import { realClock } from "../lib/agent/clock";
import { liveGateway } from "../lib/x402";
import { buildApproveTransaction, buildRevokeTransaction, DelegatePaymentRail, readAllowance } from "../lib/x402/delegate";
import { secretBytes, signerFromSecret } from "../lib/x402/live-client";
import type { PaymentRequirements } from "../lib/x402/rail";
import { isSolanaAddress, liveConfig } from "../lib/x402/solana";

if (existsSync(".env")) process.loadEnvFile(".env");

/** What the buyer's wallet does with the transaction Rialto prepared: add the owner's signature and send it. */
async function ownerSignsAndSends(rpcUrl: string, wire: string, ownerSecret: string): Promise<string> {
  const rpc = createSolanaRpc(rpcUrl);
  const tx = getTransactionDecoder().decode(getBase64Encoder().encode(wire));
  const key = await crypto.subtle.importKey("pkcs8", pkcs8(secretBytes(ownerSecret).slice(0, 32)), "Ed25519", false, ["sign"]);
  const pub = await crypto.subtle.importKey("raw", secretBytes(ownerSecret).slice(32), "Ed25519", true, ["verify"]);
  const signed = await signTransaction([{ privateKey: key, publicKey: pub }], tx);
  const sig = await rpc.sendTransaction(getBase64EncodedWireTransaction(signed), { encoding: "base64", preflightCommitment: "confirmed" }).send();
  for (let i = 0; i < 40; i++) {
    const { value } = await rpc.getSignatureStatuses([sig as Signature]).send();
    const s = value[0];
    if (s?.err) throw new Error(`transaction failed: ${JSON.stringify(s.err)}`);
    if (s?.confirmationStatus === "confirmed" || s?.confirmationStatus === "finalized") return sig;
    await new Promise((r) => setTimeout(r, 750));
  }
  throw new Error(`not confirmed: ${sig}`);
}

function pkcs8(seed: Uint8Array): ArrayBuffer {
  const prefix = Uint8Array.from([0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x04, 0x22, 0x04, 0x20]);
  const out = new Uint8Array(prefix.length + seed.length);
  out.set(prefix);
  out.set(seed, prefix.length);
  return out.buffer;
}

const usd = (micro: number | null): string => (micro === null ? "no USDC account" : `${(micro / 1_000_000).toFixed(6)} USDC`);

async function main(): Promise<void> {
  const cfg = liveConfig();
  const gateway = liveGateway(realClock(0));
  const ownerSecret = process.env.SOLANA_WALLET_KEY?.trim();
  const spenderSecret = process.env.RIALTO_SPENDER_KEY?.trim();
  const seller = process.env.SOLANA_PAY_TO?.trim() ?? "";
  if (!cfg || !gateway || !ownerSecret || !spenderSecret || !isSolanaAddress(seller)) {
    console.log("Needs PAYMENT_MODE=live, PLATFORM_FEE_PAYTO, SOLANA_WALLET_KEY (the buyer), RIALTO_SPENDER_KEY (Rialto's spender, with a little SOL) and SOLANA_PAY_TO.");
    process.exit(1);
  }
  const owner = (await signerFromSecret(ownerSecret)).address;
  const spender = await signerFromSecret(spenderSecret);
  const mint = cfg.network.usdc;
  console.log(`network   ${cfg.network.name} · facilitator ${cfg.facilitatorUrl}`);
  console.log(`buyer     ${owner}`);
  console.log(`spender   ${spender.address}`);

  const approve = await buildApproveTransaction({ rpcUrl: cfg.rpcUrl, owner, mint, spender, amountMicro: 10_000 });
  console.log(`approve   ${await ownerSignsAndSends(cfg.rpcUrl, approve, ownerSecret)}`);
  const before = await readAllowance(cfg.rpcUrl, owner, mint);
  console.log(`allowance ${usd(before.delegatedMicro)} to ${before.delegate} · balance ${usd(before.balanceMicro)}`);

  const req: PaymentRequirements = { scheme: "exact", network: cfg.network.name, asset: "USDC", amountMicro: 2_000, settleMicro: 1_000, feePayTo: cfg.feePayTo, payTo: seller, resource: "/delegate-check", description: "Rialto allowance check", live: true };
  req.x402 = await gateway.legsFor(req);
  const auth = await new DelegatePaymentRail(spender, owner, cfg.rpcUrl).requestPayment(req);
  const feeHeader = Object.values(auth.headers ?? {})[0] ?? "";
  const [v1, v2] = await Promise.all([gateway.verifyLeg(auth.payload, req.x402.seller), req.x402.fee ? gateway.verifyLeg(feeHeader, req.x402.fee) : Promise.resolve({ ok: true as const, payer: "" })]);
  console.log(`verified  seller ${v1.ok ? `yes (payer ${v1.payer})` : `NO: ${v1.reason}`} · fee ${v2.ok ? "yes" : `NO: ${v2.reason}`}`);
  if (v1.ok && v2.ok) {
    const s1 = await gateway.settleLeg(auth.payload, req.x402.seller);
    console.log(`seller    ${s1.explorerUrl}`);
    if (req.x402.fee) console.log(`fee       ${(await gateway.settleLeg(feeHeader, req.x402.fee)).explorerUrl}`);
    const after = await readAllowance(cfg.rpcUrl, owner, mint);
    console.log(`allowance ${usd(after.delegatedMicro)} left · balance ${usd(after.balanceMicro)}`);
  }

  const revoke = await buildRevokeTransaction({ rpcUrl: cfg.rpcUrl, owner, mint, spender });
  console.log(`revoke    ${await ownerSignsAndSends(cfg.rpcUrl, revoke, ownerSecret)}`);
  const end = await readAllowance(cfg.rpcUrl, owner, mint);
  console.log(`allowance ${end.delegate ? `${usd(end.delegatedMicro)} to ${end.delegate}` : "none"}`);
  if (!v1.ok || !v2.ok) process.exit(1);
}
main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
