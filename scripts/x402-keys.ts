// Creates the wallets a local live-rail test needs, and writes them to .env (git-ignored):
//   SOLANA_WALLET_KEY   the BUYER's wallet: it signs the payments (this is what an agent's machine holds)
//   SOLANA_PAY_TO       the test seller's payout address (PokéDex), with its key in SOLANA_TEST_SELLER_SECRET_KEY
//   PLATFORM_FEE_PAYTO  where Rialto's commission is paid: only an address, never a key on the server
// Prints only public addresses. Existing values are kept.
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
  // an older .env named the buyer's wallet after what it used to be: the platform's payer
  if (!read("SOLANA_WALLET_KEY")) write("SOLANA_WALLET_KEY", read("SOLANA_PAYER_SECRET_KEY") || newSecret());
  if (!read("SOLANA_PAY_TO")) {
    const seller = newSecret();
    write("SOLANA_TEST_SELLER_SECRET_KEY", seller);
    write("SOLANA_PAY_TO", await addressOf(seller));
  }
  if (!read("PLATFORM_FEE_PAYTO")) write("PLATFORM_FEE_PAYTO", read("SOLANA_PAY_TO"));
  if (process.argv.includes("--live")) write("PAYMENT_MODE", "live");
  writeFileSync(file, text);

  console.log(`Wallets (keys are in ${file}, which git ignores):\n`);
  console.log(`  buyer (signs)      ${await addressOf(read("SOLANA_WALLET_KEY"))}`);
  console.log(`  test seller        ${read("SOLANA_PAY_TO")}`);
  console.log(`  fee goes to        ${read("PLATFORM_FEE_PAYTO")}   (the test seller, here; use your own wallet's address for a real deployment)`);
  console.log(`  network            ${read("SOLANA_NETWORK") || "devnet"}`);
  console.log(`  PAYMENT_MODE       ${read("PAYMENT_MODE") || "simulated"}`);
  console.log("\nOn devnet, fund the buyer with USDC at https://faucet.circle.com (network: Solana Devnet), and send the");
  console.log("seller one drop so its USDC account exists. Nothing here needs SOL: the facilitator pays the fees.");
  console.log("Then: npm run x402:check -- --pay");
}
void main();
