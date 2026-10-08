// Creates the two devnet wallets the live rail needs and writes them to .env (git-ignored):
// the platform wallet that pays sellers, and a test seller that receives the payments.
// Prints only the public addresses. Existing keys are kept.
//
//   npm run x402:keys            create what is missing
//   npm run x402:keys -- --live  also switch PAYMENT_MODE to "live"
import { generateKeyPairSync } from "node:crypto";
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { createKeyPairSignerFromBytes, getBase58Decoder, getBase58Encoder } from "@solana/kit";

const file = ".env";
if (!existsSync(file)) copyFileSync(".env.example", file);
let text = readFileSync(file, "utf8");

const read = (key: string): string => text.match(new RegExp(`^${key}="?([^"\\n#]*)"?`, "m"))?.[1]?.trim() ?? "";
const write = (key: string, value: string): void => {
  const line = `${key}="${value}"`;
  text = new RegExp(`^${key}=.*$`, "m").test(text) ? text.replace(new RegExp(`^${key}=.*$`, "m"), line) : `${text.replace(/\n*$/, "\n")}${line}\n`;
};

/** A new ed25519 keypair as Solana expects it: base58 of seed + public key (64 bytes). */
function newSecret(): string {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const seed = Buffer.from(String(privateKey.export({ format: "jwk" }).d), "base64url");
  const pub = Buffer.from(String(publicKey.export({ format: "jwk" }).x), "base64url");
  return getBase58Decoder().decode(Buffer.concat([seed, pub]));
}
const addressOf = async (secret: string): Promise<string> => (await createKeyPairSignerFromBytes(new Uint8Array(getBase58Encoder().encode(secret)))).address;

async function main(): Promise<void> {
  if (!read("SOLANA_PAYER_SECRET_KEY")) write("SOLANA_PAYER_SECRET_KEY", newSecret());
  if (!read("SOLANA_PAY_TO")) {
    const seller = newSecret();
    write("SOLANA_TEST_SELLER_SECRET_KEY", seller);
    write("SOLANA_PAY_TO", await addressOf(seller));
  }
  if (!read("X402_FACILITATOR_URL")) write("X402_FACILITATOR_URL", "https://x402.org/facilitator");
  if (process.argv.includes("--live")) write("PAYMENT_MODE", "live");
  writeFileSync(file, text);

  console.log(`Devnet wallets (keys are in ${file}, which git ignores):\n`);
  console.log(`  pays sellers   ${await addressOf(read("SOLANA_PAYER_SECRET_KEY"))}`);
  console.log(`  test seller    ${read("SOLANA_PAY_TO")}`);
  console.log(`  PAYMENT_MODE   ${read("PAYMENT_MODE") || "simulated"}`);
  console.log("\nFund BOTH addresses with devnet USDC at https://faucet.circle.com (network: Solana Devnet).");
  console.log("The paying wallet needs the USDC; the seller needs one drop so its USDC account exists.");
  console.log("Neither needs SOL: the x402 facilitator pays the transaction fees.");
  console.log("Then: npm run x402:check");
}
void main();
