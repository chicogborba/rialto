"use client";

/**
 * The browser wallets installed on this page (Phantom, Solflare, Backpack, …), found through the
 * Wallet Standard every current Solana wallet implements: the app announces itself and each wallet
 * registers. No wallet SDK needed.
 */
export interface StdAccount {
  address: string;
  publicKey: Uint8Array;
  chains: readonly string[];
}

export interface StdWallet {
  name: string;
  icon: string;
  chains: readonly string[];
  accounts: readonly StdAccount[];
  features: Record<string, unknown>;
}

interface ConnectFeature {
  connect(input?: { silent?: boolean }): Promise<{ accounts: readonly StdAccount[] }>;
}
interface SignTransactionFeature {
  signTransaction(...inputs: { transaction: Uint8Array; account: StdAccount; chain?: string }[]): Promise<readonly { signedTransaction: Uint8Array }[]>;
}

const canPay = (w: StdWallet): boolean => "standard:connect" in w.features && "solana:signTransaction" in w.features;

/** Calls `onChange` with the usable wallets now and whenever another one registers. Returns a cleanup. */
export function watchWallets(onChange: (wallets: StdWallet[]) => void): () => void {
  const found = new Set<StdWallet>();
  const register = (...wallets: StdWallet[]) => {
    for (const w of wallets) if (canPay(w)) found.add(w);
    onChange([...found]);
    return () => {
      for (const w of wallets) found.delete(w);
      onChange([...found]);
    };
  };
  const api = Object.freeze({ register });
  const listener = (e: Event) => {
    const callback = (e as CustomEvent<(api: { register: typeof register }) => void>).detail;
    try {
      callback(api);
    } catch {
      // a broken wallet must not break the page
    }
  };
  window.addEventListener("wallet-standard:register-wallet", listener);
  window.dispatchEvent(new CustomEvent("wallet-standard:app-ready", { detail: api }));
  return () => window.removeEventListener("wallet-standard:register-wallet", listener);
}

export async function connect(wallet: StdWallet): Promise<StdAccount> {
  const { accounts } = await (wallet.features["standard:connect"] as ConnectFeature).connect();
  const account = accounts[0] ?? wallet.accounts[0];
  if (!account) throw new Error(`${wallet.name} did not share an account.`);
  return account;
}

const toBytes = (b64: string): Uint8Array => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
const toBase64 = (bytes: Uint8Array): string => {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
};

/** Asks the wallet to add its signature to a transaction Rialto prepared; returns it, still unsent. */
export async function signPrepared(wallet: StdWallet, account: StdAccount, transactionBase64: string, chain: string): Promise<string> {
  const feature = wallet.features["solana:signTransaction"] as SignTransactionFeature;
  const [out] = await feature.signTransaction({ transaction: toBytes(transactionBase64), account, chain });
  if (!out) throw new Error(`${wallet.name} returned nothing.`);
  return toBase64(out.signedTransaction);
}

/** On a phone without the extension: open this page inside Phantom's own browser. */
export const openInPhantom = (url: string): string => `https://phantom.app/ul/browse/${encodeURIComponent(url)}?ref=${encodeURIComponent(new URL(url).origin)}`;
