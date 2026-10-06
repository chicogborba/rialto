import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * Encrypts seller-provided upstream credentials at rest (AES-256-GCM).
 * Production requires SECRETS_KEY (base64, 32 bytes). Development falls back to a fixed key so the
 * demo works out of the box — never use that fallback with real credentials.
 */
function key(): Buffer {
  const raw = process.env.SECRETS_KEY;
  if (raw) {
    const buf = Buffer.from(raw, "base64");
    if (buf.length !== 32) throw new Error("SECRETS_KEY must be 32 bytes, base64-encoded");
    return buf;
  }
  if (process.env.NODE_ENV === "production") throw new Error("SECRETS_KEY is required in production");
  return createHash("sha256").update("switchyard-dev-only-key").digest();
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), enc].map((b) => b.toString("base64")).join(".");
}

export function decryptSecret(blob: string): string {
  const [iv, tag, enc] = blob.split(".").map((p) => Buffer.from(p, "base64"));
  if (!iv || !tag || !enc) throw new Error("malformed secret");
  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}
