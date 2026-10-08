import { generateKeyPairSync, sign } from "node:crypto";
import { getBase58Decoder } from "@solana/kit";
import { describe, expect, it } from "vitest";
import { assertSameSite, safeNext } from "@/lib/auth/account";
import { hashPassword, normalizeEmail, passwordProblem, verifyPassword } from "@/lib/auth/password";
import { issuedAtFresh, verifyWalletSignature, walletMessage } from "@/lib/auth/wallet-proof";
import { anonymousKeysAllowed } from "@/lib/security/keys";
import { incomingUsdc, MAX_DEPOSIT_MICRO } from "@/lib/x402/deposits";
import { LIVE_ASSET } from "@/lib/x402/solana";

describe("passwords", () => {
  it("hash and verify, with a different salt every time", async () => {
    const a = await hashPassword("correct horse battery");
    const b = await hashPassword("correct horse battery");
    expect(a).not.toBe(b);
    expect(a.startsWith("scrypt$65536$8$1$")).toBe(true);
    expect(await verifyPassword("correct horse battery", a)).toBe(true);
    expect(await verifyPassword("correct horse batterY", a)).toBe(false);
    expect(await verifyPassword("anything", "not-a-hash")).toBe(false);
  });
  it("keeps verifying a hash made with other parameters", async () => {
    // a hash is self-describing: raising the cost later must not lock anyone out
    const { scryptSync, randomBytes } = await import("node:crypto");
    const salt = randomBytes(16);
    const key = scryptSync("old password here", salt, 32, { N: 2 ** 14, r: 8, p: 1 });
    expect(await verifyPassword("old password here", `scrypt$16384$8$1$${salt.toString("base64")}$${key.toString("base64")}`)).toBe(true);
  });
  it("asks for length, not symbols", () => {
    expect(passwordProblem("short", "a@b.co")).toMatch(/at least 10/);
    expect(passwordProblem("x".repeat(129), "a@b.co")).toMatch(/at most 128/);
    expect(passwordProblem("password123", "a@b.co")).toMatch(/common/);
    expect(passwordProblem("password1234", "a@b.co")).toMatch(/common/);
    expect(passwordProblem("aaaaaaaaaaaa", "a@b.co")).toMatch(/repetitive/);
    expect(passwordProblem("franciscoRocks99", "francisco@x.com")).toMatch(/email/);
    expect(passwordProblem("three random words here", "a@b.co")).toBeNull();
  });
  it("treats emails case-insensitively", () => {
    expect(normalizeEmail("  Chico@Example.COM ")).toBe("chico@example.com");
  });
});

describe("where sign-in sends you", () => {
  it("only to paths on this site", () => {
    expect(safeNext("/dashboard/apis")).toBe("/dashboard/apis");
    expect(safeNext("https://evil.example")).toBe("/dashboard");
    expect(safeNext("//evil.example")).toBe("/dashboard");
    expect(safeNext("/\\evil.example")).toBe("/dashboard");
    expect(safeNext("/api/reset")).toBe("/dashboard");
    expect(safeNext(null)).toBe("/dashboard");
  });
});

describe("cross-site requests", () => {
  const post = (headers: Record<string, string>) => new Request("https://rialto.example.com/api/account/agents", { method: "POST", headers });
  it("are refused, while same-site and header-less ones pass", () => {
    expect(() => assertSameSite(post({ origin: "https://rialto.example.com", host: "rialto.example.com" }))).not.toThrow();
    expect(() => assertSameSite(post({}))).not.toThrow();
    expect(() => assertSameSite(post({ origin: "https://evil.example", host: "rialto.example.com" }))).toThrow(/Cross-site/);
    expect(() => assertSameSite(post({ "sec-fetch-site": "cross-site" }))).toThrow(/Cross-site/);
    expect(() => assertSameSite(post({ origin: "http://rialto.example.com:3000", "x-forwarded-host": "rialto.example.com" }))).toThrow();
    expect(() => assertSameSite(new Request("https://rialto.example.com/api/account", { headers: { origin: "https://evil.example" } }))).not.toThrow(); // reads are not state changes
  });
});

describe("keys without an account", () => {
  it("are for development; production needs the switch", () => {
    expect(anonymousKeysAllowed({ NODE_ENV: "development" })).toBe(true);
    expect(anonymousKeysAllowed({ NODE_ENV: "production" })).toBe(false);
    expect(anonymousKeysAllowed({ NODE_ENV: "production", ALLOW_ANONYMOUS_KEYS: "1" })).toBe(true);
  });
});

/** A fresh wallet: its address (base58 of the public key) and a signer. */
function wallet() {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const raw = Buffer.from(String(publicKey.export({ format: "jwk" }).x), "base64url");
  return { address: getBase58Decoder().decode(raw), signBase64: (message: string) => sign(null, Buffer.from(message), privateKey).toString("base64") };
}

describe("proving you hold a wallet", () => {
  it("accepts the owner's signature of the exact message", () => {
    const w = wallet();
    const message = walletMessage("me@example.com", w.address, "2026-10-08T12:00:00.000Z");
    expect(verifyWalletSignature(w.address, message, w.signBase64(message))).toBe(true);
  });
  it("rejects another wallet's signature, another message, and garbage", () => {
    const mine = wallet();
    const theirs = wallet();
    const message = walletMessage("me@example.com", mine.address, "2026-10-08T12:00:00.000Z");
    expect(verifyWalletSignature(mine.address, message, theirs.signBase64(message))).toBe(false);
    expect(verifyWalletSignature(mine.address, `${message} `, mine.signBase64(message))).toBe(false);
    expect(verifyWalletSignature(mine.address, walletMessage("other@example.com", mine.address, "2026-10-08T12:00:00.000Z"), mine.signBase64(message))).toBe(false);
    expect(verifyWalletSignature(mine.address, message, "not base64!")).toBe(false);
    expect(verifyWalletSignature("not an address", message, mine.signBase64(message))).toBe(false);
  });
  it("only accepts a recent challenge", () => {
    const now = Date.parse("2026-10-08T12:00:00.000Z");
    expect(issuedAtFresh("2026-10-08T11:55:00.000Z", now)).toBe(true);
    expect(issuedAtFresh("2026-10-08T11:49:00.000Z", now)).toBe(false);
    expect(issuedAtFresh("2026-10-08T12:30:00.000Z", now)).toBe(false);
    expect(issuedAtFresh("yesterday", now)).toBe(false);
  });
});

describe("recognising a deposit on-chain", () => {
  const TREASURY = "CsyMmfi7kqkEwbeVZYn6fVMVH4KMm62D1eDZxnTCeX6t";
  const USER = "AavcvScqne4DsEUd2m3MHhtEHFrQUwVYppocc1xKzbgR";
  const bal = (owner: string, amount: number, mint = LIVE_ASSET) => ({ accountIndex: 1, owner, mint, uiTokenAmount: { amount: String(amount) } });
  const tx = (pre: ReturnType<typeof bal>[], post: ReturnType<typeof bal>[], err: unknown = null) => ({ meta: { err, preTokenBalances: pre, postTokenBalances: post } });

  it("credits money that went from one wallet to the platform wallet", () => {
    expect(incomingUsdc(tx([bal(USER, 20_000_000), bal(TREASURY, 1_000_000)], [bal(USER, 19_950_000), bal(TREASURY, 1_050_000)]), TREASURY)).toEqual({ amountMicro: 50_000, from: USER });
  });
  it("ignores money leaving the platform wallet (a payment to a seller)", () => {
    expect(incomingUsdc(tx([bal(TREASURY, 1_000_000), bal(USER, 0)], [bal(TREASURY, 998_000), bal(USER, 2_000)]), TREASURY)).toBeNull();
  });
  it("ignores failed transactions, other tokens and transfers between others", () => {
    const ok = [bal(USER, 100), bal(TREASURY, 0)];
    const after = [bal(USER, 50), bal(TREASURY, 50)];
    expect(incomingUsdc(tx(ok, after, { InstructionError: [0, "Custom"] }), TREASURY)).toBeNull();
    expect(incomingUsdc(tx([bal(USER, 100, "OtherMint"), bal(TREASURY, 0, "OtherMint")], [bal(USER, 50, "OtherMint"), bal(TREASURY, 50, "OtherMint")]), TREASURY)).toBeNull();
    expect(incomingUsdc(tx([bal(USER, 100)], [bal(USER, 50), bal("SomeoneElse", 50)]), TREASURY)).toBeNull();
    expect(incomingUsdc({ meta: null }, TREASURY)).toBeNull();
    expect(incomingUsdc("garbage", TREASURY)).toBeNull();
  });
  it("does not credit when several wallets paid at once, or an absurd amount", () => {
    expect(incomingUsdc(tx([bal("A", 10), bal("B", 10), bal(TREASURY, 0)], [bal("A", 5), bal("B", 5), bal(TREASURY, 10)]), TREASURY)).toBeNull();
    expect(incomingUsdc(tx([bal(USER, MAX_DEPOSIT_MICRO + 1), bal(TREASURY, 0)], [bal(USER, 0), bal(TREASURY, MAX_DEPOSIT_MICRO + 1)]), TREASURY)).toBeNull();
  });
});
