import { createPublicKey, verify } from "node:crypto";
import { getBase58Encoder } from "@solana/kit";

/**
 * Proof that someone holds a Solana wallet: they sign a message that names this account and this
 * address, and we check the ed25519 signature against the address itself (a Solana address IS the
 * public key). The message is rebuilt on the server from what we know, never taken from the
 * client, and is only valid for a few minutes.
 */
export const PROOF_MAX_AGE_MS = 10 * 60_000;

export function walletMessage(email: string, address: string, issuedAt: string): string {
  return [
    "Rialto wants to link this Solana wallet to your account.",
    "Signing does not cost anything and does not let anyone move your funds.",
    "",
    `Account: ${email}`,
    `Wallet: ${address}`,
    `Issued: ${issuedAt}`,
  ].join("\n");
}

// DER prefix of an ed25519 public key (SubjectPublicKeyInfo); the 32 key bytes follow
const SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

/** True when `signature` (base64) is `address`'s signature over `message`. */
export function verifyWalletSignature(address: string, message: string, signatureBase64: string): boolean {
  try {
    const raw = Buffer.from(getBase58Encoder().encode(address));
    if (raw.length !== 32) return false;
    const key = createPublicKey({ key: Buffer.concat([SPKI_PREFIX, raw]), format: "der", type: "spki" });
    const signature = Buffer.from(signatureBase64, "base64");
    return signature.length === 64 && verify(null, Buffer.from(message, "utf8"), key, signature);
  } catch {
    return false;
  }
}

export function issuedAtFresh(issuedAt: string, now = Date.now()): boolean {
  const at = Date.parse(issuedAt);
  return Number.isFinite(at) && now - at >= -60_000 && now - at <= PROOF_MAX_AGE_MS;
}
