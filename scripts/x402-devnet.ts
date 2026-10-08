// Checks the live rail against Solana devnet, and with --pay makes one real x402 payment of
// $0.001 from the platform wallet to the test seller: sign → facilitator verify → settle.
//
//   npm run x402:check            wallets, balances, facilitator
//   npm run x402:check -- --pay   also pay once and print the explorer link
import { realClock } from "../lib/agent/clock";
import { liveRail } from "../lib/x402";
import type { PaymentRequirements } from "../lib/x402/rail";
import { explorerAddress, isSolanaAddress, liveConfig, usdcBalance } from "../lib/x402/solana";

process.loadEnvFile(".env");
const usd = (micro: number | null): string => (micro === null ? "no USDC account" : `${(micro / 1_000_000).toFixed(6)} USDC`);

async function main(): Promise<void> {
  const cfg = liveConfig();
  const rail = liveRail(realClock(0));
  if (!cfg || !rail) {
    console.log('Live rail is off. Run "npm run x402:keys -- --live" first.');
    process.exit(1);
  }
  const payer = (await rail.payer()).address;
  const seller = process.env.SOLANA_PAY_TO?.trim() ?? "";
  if (!isSolanaAddress(seller)) {
    console.log("SOLANA_PAY_TO is not set.");
    process.exit(1);
  }
  const [payerUsdc, sellerUsdc] = await Promise.all([usdcBalance(cfg.rpcUrl, payer), usdcBalance(cfg.rpcUrl, seller)]);
  console.log(`facilitator   ${cfg.facilitatorUrl}`);
  console.log(`pays sellers  ${payer}  ${usd(payerUsdc)}`);
  console.log(`test seller   ${seller}  ${usd(sellerUsdc)}`);

  const req: PaymentRequirements = { scheme: "exact", network: "solana-devnet", asset: "USDC", amountMicro: 1_000, payTo: seller, resource: "/x402-check", description: "Rialto live rail check", live: true };
  const x402 = await rail.toX402(req);
  console.log(`fee payer     ${String(x402.extra.feePayer)} (the facilitator pays the SOL fees)`);

  const ready = payerUsdc !== null && payerUsdc >= req.amountMicro && sellerUsdc !== null;
  if (!ready) {
    console.log("\nNot ready to pay:");
    if (payerUsdc === null || payerUsdc < req.amountMicro) console.log(`  - fund the paying wallet with devnet USDC: ${payer}`);
    if (sellerUsdc === null) console.log(`  - send one drop of devnet USDC to the seller so its USDC account exists: ${seller}`);
    console.log("  Faucet: https://faucet.circle.com (network: Solana Devnet)");
    process.exit(process.argv.includes("--pay") ? 1 : 0);
  }
  if (!process.argv.includes("--pay")) {
    console.log("\nReady. Add --pay to make one real $0.001 payment.");
    return;
  }

  const auth = await rail.requestPayment(req, { balanceMicro: 0, sessionSpendMicro: 0, policy: { maxPerRequestMicro: 0, sessionBudgetMicro: 0, allowedNetworks: [], allowedProviderIds: [], minQuality: 0, requireX402: true } });
  console.log(`\nsigned        payment of $0.001 by ${auth.payer}`);
  const verified = await rail.verifyPayment(auth, req);
  console.log(`verified      ${verified.ok ? "yes" : `NO: ${verified.reason}`}`);
  if (!verified.ok) process.exit(1);
  const settlement = await rail.settlePayment(auth, req);
  console.log(`settled       ${settlement.txRef}`);
  console.log(`explorer      ${settlement.explorerUrl}`);
  console.log(`seller        ${explorerAddress(seller)}`);
}
main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
