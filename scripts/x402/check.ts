// Checks the live rail against whatever SOLANA_NETWORK names, and with --pay makes one real
// two-payment purchase straight through the facilitator: the buyer's wallet signs $0.001 to the test
// seller and the commission to PLATFORM_FEE_PAYTO, the facilitator verifies and settles both.
// No server involved: this is the rail itself. (`npm run e2e:live` adds the server.)
//
//   npm run x402:check            wallets, balances, facilitator
//   npm run x402:check -- --pay   also pay once and print the explorer links
import { existsSync } from "node:fs";
import { realClock } from "../../lib/agent/clock";
import { liveGateway } from "../../lib/x402";
import { BuyerPaymentRail, signerFromSecret } from "../../lib/x402/live-client";
import type { PaymentRequirements } from "../../lib/x402/rail";
import { explorerAddress, isSolanaAddress, liveConfig, usdcBalance } from "../../lib/x402/solana";

if (existsSync(".env")) process.loadEnvFile(".env");
const usd = (micro: number | null): string => (micro === null ? "no USDC account" : `${(micro / 1_000_000).toFixed(6)} USDC`);

async function main(): Promise<void> {
  const cfg = liveConfig();
  const gateway = liveGateway(realClock(0));
  if (!cfg || !gateway) {
    console.log('Live rail is off: it needs PAYMENT_MODE="live" and PLATFORM_FEE_PAYTO (an address). Run "npm run x402:keys -- --live".');
    process.exit(1);
  }
  const secret = process.env.SOLANA_WALLET_KEY?.trim();
  const seller = process.env.SOLANA_PAY_TO?.trim() ?? "";
  if (!secret || !isSolanaAddress(seller)) {
    console.log("SOLANA_WALLET_KEY (the buyer) and SOLANA_PAY_TO (the test seller) are needed: npm run x402:keys");
    process.exit(1);
  }
  const signer = await signerFromSecret(secret);
  const [buyerUsdc, sellerUsdc, feeUsdc] = await Promise.all([usdcBalance(cfg.rpcUrl, signer.address), usdcBalance(cfg.rpcUrl, seller), usdcBalance(cfg.rpcUrl, cfg.feePayTo)]);
  console.log(`network       ${cfg.network.name}${cfg.network.testMoney ? " (test money)" : " (REAL money)"}`);
  console.log(`facilitator   ${cfg.facilitatorUrl}`);
  console.log(`buyer         ${signer.address}  ${usd(buyerUsdc)}`);
  console.log(`test seller   ${seller}  ${usd(sellerUsdc)}`);
  console.log(`fee goes to   ${cfg.feePayTo}  ${usd(feeUsdc)}`);

  const req: PaymentRequirements = { scheme: "exact", network: cfg.network.name, asset: "USDC", amountMicro: 1_500, settleMicro: 1_000, feePayTo: cfg.feePayTo, payTo: seller, resource: "/x402-check", description: "Rialto live rail check", live: true };
  req.x402 = await gateway.legsFor(req);
  console.log(`fee payer     ${String(req.x402.seller.extra.feePayer)} (the facilitator pays the SOL fees)`);

  const ready = buyerUsdc !== null && buyerUsdc >= req.amountMicro && sellerUsdc !== null && feeUsdc !== null;
  if (!ready) {
    console.log("\nNot ready to pay:");
    if (buyerUsdc === null || buyerUsdc < req.amountMicro) console.log(`  - put USDC in the buyer wallet: ${signer.address}`);
    if (sellerUsdc === null) console.log(`  - send one drop of USDC to the seller so its USDC account exists: ${seller}`);
    if (feeUsdc === null) console.log(`  - send one drop of USDC to the fee address so its USDC account exists: ${cfg.feePayTo}`);
    if (cfg.network.testMoney) console.log("  Faucet: https://faucet.circle.com (network: Solana Devnet)");
    process.exit(process.argv.includes("--pay") ? 1 : 0);
  }
  if (!process.argv.includes("--pay")) {
    console.log("\nReady. Add --pay to make one real purchase ($0.001 to the seller, $0.0005 commission).");
    return;
  }

  const auth = await new BuyerPaymentRail(signer, cfg.rpcUrl).requestPayment(req);
  console.log(`\nsigned        two payments by ${auth.payer}`);
  const feeHeader = Object.values(auth.headers ?? {})[0] ?? "";
  const [v1, v2] = await Promise.all([gateway.verifyLeg(auth.payload, req.x402.seller), req.x402.fee ? gateway.verifyLeg(feeHeader, req.x402.fee) : Promise.resolve({ ok: true as const, payer: signer.address })]);
  console.log(`verified      seller ${v1.ok ? "yes" : `NO: ${v1.reason}`} · fee ${v2.ok ? "yes" : `NO: ${v2.reason}`}`);
  if (!v1.ok || !v2.ok) process.exit(1);
  const s1 = await gateway.settleLeg(auth.payload, req.x402.seller);
  console.log(`seller paid   ${s1.txRef}\n              ${s1.explorerUrl}`);
  if (req.x402.fee) {
    const s2 = await gateway.settleLeg(feeHeader, req.x402.fee);
    console.log(`fee paid      ${s2.txRef}\n              ${s2.explorerUrl}`);
  }
  console.log(`seller        ${explorerAddress(seller, cfg.network)}`);
}
main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
