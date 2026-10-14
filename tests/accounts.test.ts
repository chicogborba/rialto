import { describe, expect, it } from "vitest";
import { assertSameSite, safeNext } from "@/lib/auth/account";
import { hashPassword, normalizeEmail, passwordProblem, verifyPassword } from "@/lib/auth/password";
import { anonymousKeysAllowed } from "@/lib/security/keys";

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
