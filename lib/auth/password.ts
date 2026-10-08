import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

/**
 * Password hashing with scrypt (built into Node, no dependency). The parameters are stored in the
 * hash, so they can be raised later without locking anyone out: old hashes keep verifying with
 * the parameters they were made with.
 */
const COST = { N: 2 ** 16, r: 8, p: 1 };
const KEY_BYTES = 32;
const MAX_MEM = 256 * 1024 * 1024;

function derive(password: string, salt: Buffer, N: number, r: number, p: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password.normalize("NFKC"), salt, KEY_BYTES, { N, r, p, maxmem: MAX_MEM }, (err, key) => (err ? reject(err) : resolve(key)));
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt, COST.N, COST.r, COST.p);
  return ["scrypt", COST.N, COST.r, COST.p, salt.toString("base64"), key.toString("base64")].join("$");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, n, r, p, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const want = Buffer.from(hash, "base64");
  const got = await derive(password, Buffer.from(salt, "base64"), Number(n), Number(r), Number(p)).catch(() => null);
  return got !== null && got.length === want.length && timingSafeEqual(got, want);
}

/** A hash nobody can match, to spend the same time on an unknown email as on a wrong password. */
let decoy: Promise<string> | null = null;
export function spendLoginTime(password: string): Promise<boolean> {
  decoy ??= hashPassword(randomBytes(12).toString("hex"));
  return decoy.then((h) => verifyPassword(password, h));
}

const COMMON = new Set([
  "password", "password1", "password12", "password123", "password1234", "1234567890", "12345678910", "qwertyuiop", "qwerty12345",
  "iloveyou123", "letmein1234", "welcome1234", "admin12345", "abc1234567", "1q2w3e4r5t", "0123456789", "senha12345", "mudar12345",
]);

/** Why a password is not acceptable, or null when it is. Length matters more than symbols. */
export function passwordProblem(password: string, email: string): string | null {
  if (password.length < 10) return "Use at least 10 characters.";
  if (password.length > 128) return "Use at most 128 characters.";
  const lower = password.toLowerCase();
  if (COMMON.has(lower)) return "That password is too common.";
  if (new Set(lower).size < 5) return "That password is too repetitive.";
  const local = email.split("@")[0]?.toLowerCase() ?? "";
  if (local.length >= 4 && lower.includes(local)) return "Do not put your email in your password.";
  return null;
}

export const normalizeEmail = (email: string): string => email.trim().toLowerCase();
