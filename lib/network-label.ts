/**
 * How the pages talk about the network payments settle on. Safe in client code: it reads only the
 * build-time `NEXT_PUBLIC_SOLANA_NETWORK`, so a deployment on mainnet sets it (and `SOLANA_NETWORK`)
 * to `mainnet` and every page says so, instead of one place saying "test money".
 */
const ON_MAINNET = (process.env.NEXT_PUBLIC_SOLANA_NETWORK ?? "devnet").trim().toLowerCase().startsWith("mainnet");

/** One sentence on what the money is. */
export const MONEY_NOTE = ON_MAINNET ? "Payments settle in real USDC on Solana mainnet." : "This build pays with x402 on Solana devnet: test money.";

/** Footer line of the landing page. */
export const FOOTER_NOTE = ON_MAINNET ? "Rialto · built for Solana · payments settle in USDC on mainnet" : "Rialto · hackathon build · devnet test money, never real funds";

/** Label of the link to a transaction. */
export const EXPLORER_LABEL = ON_MAINNET ? "Solana Explorer" : "Solana Explorer (devnet)";
