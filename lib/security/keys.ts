import { createHash, randomBytes } from "node:crypto";

export type KeyKind = "buyer" | "seller";

export interface NewKey {
  /** shown to the user exactly once */
  key: string;
  /** safe to display, e.g. "rl_buyer_k3J9" */
  prefix: string;
  /** what we store */
  hash: string;
}

const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

function base62(bytes: number): string {
  const buf = randomBytes(bytes);
  let out = "";
  for (const b of buf) out += ALPHABET[b % ALPHABET.length];
  return out;
}

export function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export function generateKey(kind: KeyKind): NewKey {
  const key = `rl_${kind}_${base62(32)}`;
  return { key, prefix: key.slice(0, 13), hash: hashKey(key) };
}

export function kindOfKey(key: string): KeyKind | null {
  if (key.startsWith("rl_buyer_")) return "buyer";
  if (key.startsWith("rl_seller_")) return "seller";
  return null;
}

/** "Bearer rl_buyer_…" → the raw key, or null. */
export function bearerFrom(header: string | null | undefined): string | null {
  const m = header?.match(/^Bearer\s+(\S+)$/i);
  return m ? m[1] : null;
}

/**
 * Keys made without an account (POST /api/agents, POST /api/sellers) are for development and the
 * scripts. On a public server they are off: people sign up, and the account owns the keys. Set
 * ALLOW_ANONYMOUS_KEYS=1 to switch them back on.
 */
export function anonymousKeysAllowed(env: Record<string, string | undefined> = process.env): boolean {
  return env.ALLOW_ANONYMOUS_KEYS === "1" || env.NODE_ENV !== "production";
}
