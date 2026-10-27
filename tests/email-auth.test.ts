import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const directory = mkdtempSync(path.join(tmpdir(), "rialto-email-test-"));
const databaseUrl = `file:${path.join(directory, "test.db")}`;
const db = new PrismaClient({ datasourceUrl: databaseUrl });
const password = "three random market words";
let signup: typeof import("@/app/api/auth/signup/route").POST;
let verify: typeof import("@/app/api/auth/verify-email/route").POST;
let forgot: typeof import("@/app/api/auth/forgot-password/route").POST;
let reset: typeof import("@/app/api/auth/reset-password/route").POST;
let login: typeof import("@/app/api/auth/login/route").POST;
let session: typeof import("@/lib/auth/account");
let passwords: typeof import("@/lib/auth/password");
let sent: { to: string[]; text: string; html: string; subject: string }[];
let address = 0;
const testEmail = () => `buyer-${address}@example.com`;

function request(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/auth/test", { method: "POST", headers: { host: "localhost", origin: "http://localhost", "content-type": "application/json", "x-forwarded-for": `test-${address}`, ...headers }, body: JSON.stringify(body) });
}

const lastCode = () => {
  const code = sent.at(-1)?.text.match(/\n\n(\d{6})\n\n/)?.[1];
  expect(code).toMatch(/^\d{6}$/);
  return code!;
};

async function registered(email = testEmail()) {
  expect((await signup(request({ email, password, name: "Buyer" }))).status).toBe(202);
  const code = lastCode();
  const response = await verify(request({ email, code }));
  expect(response.status).toBe(201);
  const { user } = await response.json();
  return { user: user as { id: string; email: string }, cookie: response.headers.get("set-cookie")!, code };
}

beforeAll(async () => {
  writeFileSync(path.join(directory, "test.db"), "");
  execFileSync(process.execPath, [path.resolve("node_modules/prisma/build/index.js"), "db", "push", "--skip-generate"], { env: { ...process.env, DATABASE_URL: databaseUrl }, stdio: "pipe" });
  vi.doMock("@/lib/db/client", () => ({ prisma: db }));
  signup = (await import("@/app/api/auth/signup/route")).POST;
  verify = (await import("@/app/api/auth/verify-email/route")).POST;
  forgot = (await import("@/app/api/auth/forgot-password/route")).POST;
  reset = (await import("@/app/api/auth/reset-password/route")).POST;
  login = (await import("@/app/api/auth/login/route")).POST;
  session = await import("@/lib/auth/account");
  passwords = await import("@/lib/auth/password");
}, 30_000);

beforeEach(async () => {
  vi.unstubAllEnvs();
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("RESEND_API_KEY", "test-sending-key");
  vi.stubEnv("EMAIL_FROM", "Rialto <no-reply@galleriarialto.com>");
  vi.stubEnv("EMAIL_TRANSPORT", "resend");
  vi.stubEnv("SECRETS_KEY", "test-email-code-secret");
  vi.stubEnv("PAYMENT_MODE", "simulated");
  await db.emailChallenge.deleteMany();
  await db.ledgerEntry.deleteMany();
  await db.user.deleteMany();
  address++;
  sent = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
    expect(url).toBe("https://api.resend.com/emails");
    const headers = new Headers(init.headers);
    expect(headers.get("authorization")).toBe("Bearer test-sending-key");
    expect(headers.get("idempotency-key")).toMatch(/^email-code\//);
    sent.push(JSON.parse(init.body as string));
    return Response.json({ id: "email-test" });
  }));
});

afterAll(async () => {
  await db.$disconnect();
  rmSync(directory, { recursive: true, force: true });
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("email-confirmed signup", () => {
  it("creates no account/session until confirmation; grants credit once and refuses replay", async () => {
    const email = testEmail().toUpperCase();
    const response = await signup(request({ email, password, name: "Buyer" }));
    expect(response.status).toBe(202);
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(await db.user.count()).toBe(0);
    expect(await db.session.count()).toBe(0);
    const code = lastCode();
    const pending = await db.emailChallenge.findFirstOrThrow();
    expect(pending.codeHash).toMatch(/^[a-f0-9]{64}$/);
    expect(pending.passwordHash).not.toContain(password);
    expect(sent[0].to).toEqual([email.toLowerCase()]);
    const verified = await verify(request({ email, code }));
    expect(verified.status).toBe(201);
    expect(verified.headers.get("set-cookie")).toMatch(/HttpOnly/);
    const user = await db.user.findFirstOrThrow();
    expect(user.emailVerifiedAt).not.toBeNull();
    expect(user.balanceMicro).toBeGreaterThan(0);
    expect(await db.ledgerEntry.count({ where: { kind: "welcome_credit" } })).toBe(1);
    expect((await verify(request({ email, code }))).status).toBe(400);
    expect(await db.user.count()).toBe(1);
  });

  it("expires codes and locks a code after five wrong guesses", async () => {
    const email = testEmail();
    await signup(request({ email, password, name: "Buyer" }));
    const code = lastCode();
    const wrong = code === "000000" ? "111111" : "000000";
    for (let i = 0; i < 5; i++) expect((await verify(request({ email, code: wrong }))).status).toBe(400);
    expect((await db.emailChallenge.findFirstOrThrow()).attempts).toBe(5);
    expect((await verify(request({ email, code }))).status).toBe(400);
    await db.emailChallenge.updateMany({ data: { attempts: 0, expiresAt: new Date(Date.now() - 1) } });
    expect((await verify(request({ email, code }))).status).toBe(400);
    expect(await db.user.count()).toBe(0);
  });

  it("enforces the resend cooldown and replaces the previous challenge", async () => {
    const body = { email: testEmail(), password, name: "Buyer" };
    await signup(request(body));
    const previous = await db.emailChallenge.findFirstOrThrow();
    expect((await signup(request(body))).status).toBe(429);
    expect(sent).toHaveLength(1);
    await db.emailChallenge.updateMany({ data: { sentAt: new Date(Date.now() - 61_000) } });
    expect((await signup(request(body))).status).toBe(202);
    expect((await db.emailChallenge.findFirstOrThrow()).id).not.toBe(previous.id);
    expect(sent).toHaveLength(2);
    expect((await verify(request({ email: body.email, code: lastCode() }))).status).toBe(201);
  });

  it("fails closed without delivery configuration and allows retry after a provider failure", async () => {
    const body = { email: testEmail(), password, name: "Buyer" };
    vi.stubEnv("RESEND_API_KEY", "");
    expect((await signup(request(body))).status).toBe(503);
    expect(await db.emailChallenge.count()).toBe(0);
    vi.stubEnv("RESEND_API_KEY", "test-sending-key");
    vi.mocked(fetch).mockResolvedValueOnce(Response.json({ message: "provider error" }, { status: 403 }));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await signup(request(body))).status).toBe(503);
    log.mockRestore();
    expect(await db.emailChallenge.count()).toBe(0);
    expect(await db.user.count()).toBe(0);
    expect((await signup(request(body))).status).toBe(202);
  });

  it("refuses the local preview transport in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("EMAIL_TRANSPORT", "preview");
    expect((await signup(request({ email: testEmail(), password, name: "Buyer" }))).status).toBe(503);
    expect(await db.emailChallenge.count()).toBe(0);
  });
});

describe("password recovery", () => {
  it("uses a separate, single-use code, replaces the password, and revokes every session", async () => {
    const { user, code: signupCode } = await registered();
    await session.startSession(user.id, request({}));
    expect(await db.session.count()).toBe(2);
    expect((await reset(request({ email: user.email, code: signupCode, password: "new random market phrase" }))).status).toBe(400);
    expect((await forgot(request({ email: user.email }))).status).toBe(200);
    const code = lastCode();
    const response = await reset(request({ email: user.email, code, password: "new random market phrase" }));
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toMatch(/Max-Age=0/);
    expect(await db.session.count()).toBe(0);
    expect((await login(request({ email: user.email, password }))).status).toBe(401);
    expect((await login(request({ email: user.email, password: "new random market phrase" }))).status).toBe(200);
    expect((await reset(request({ email: user.email, code, password: "another random market phrase" }))).status).toBe(400);
  });

  it("gives identical public responses for known, unknown, and recently requested addresses", async () => {
    const { user } = await registered();
    const known = await forgot(request({ email: user.email }));
    const unknown = await forgot(request({ email: "nobody@example.com" }));
    const cooldown = await forgot(request({ email: user.email }));
    expect([known.status, unknown.status, cooldown.status]).toEqual([200, 200, 200]);
    const body = await known.json();
    expect(await unknown.json()).toEqual(body);
    expect(await cooldown.json()).toEqual(body);
    expect(sent).toHaveLength(2); // signup + one reset
  });

  it("invalidates a reset requested before a password change, and keeps older accounts usable", async () => {
    const user = await db.user.create({ data: { email: "legacy@example.com", name: "Legacy", passwordHash: await passwords.hashPassword(password) } });
    expect(user.emailVerifiedAt).toBeNull();
    expect((await login(request({ email: user.email, password }))).status).toBe(200);
    await forgot(request({ email: user.email }));
    const code = lastCode();
    await db.user.update({ where: { id: user.id }, data: { passwordHash: await passwords.hashPassword("a changed password phrase") } });
    expect((await reset(request({ email: user.email, code, password: "an old reset attempt phrase" }))).status).toBe(400);
  });

  it("rejects cross-site requests before sending mail or mutating accounts", async () => {
    for (const route of [signup, verify, forgot, reset]) expect((await route(request({}, { origin: "https://evil.example" }))).status).toBe(403);
    expect(sent).toHaveLength(0);
    expect(await db.user.count()).toBe(0);
  });
});
