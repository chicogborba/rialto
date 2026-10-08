import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/db/client";
import { HttpError } from "@/lib/http";
import { allow } from "@/lib/security/rate-limit";

/**
 * Sign-in for people (as opposed to API keys for agents): a random token in an HttpOnly cookie,
 * stored on the server as its sha256. Logging out, changing the password or revoking a session
 * deletes the row, so nothing a stolen copy of the cookie could do survives that.
 */
export const SESSION_COOKIE = "rialto_session";
const SESSION_MS = 30 * 24 * 3600_000;
/** the expiry slides forward when the session is used, at most this often */
const TOUCH_MS = 3600_000;

const sha256 = (value: string): string => createHash("sha256").update(value).digest("hex");

export function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
}

function isHttps(req: Request): boolean {
  if (req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() === "https") return true;
  if (new URL(req.url).protocol === "https:") return true;
  return process.env.NODE_ENV === "production" && (process.env.NEXT_PUBLIC_APP_URL ?? "").startsWith("https://");
}

function cookieValue(req: Request, name: string): string | null {
  for (const part of (req.headers.get("cookie") ?? "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return null;
}

function setCookie(req: Request, value: string, maxAgeSeconds: number): string {
  return [`${SESSION_COOKIE}=${encodeURIComponent(value)}`, "Path=/", "HttpOnly", "SameSite=Lax", `Max-Age=${maxAgeSeconds}`, ...(isHttps(req) ? ["Secure"] : [])].join("; ");
}

/** Creates a session for `userId` and returns the Set-Cookie header that carries it. */
export async function startSession(userId: string, req: Request): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await prisma.session.create({
    data: { userId, tokenHash: sha256(token), expiresAt: new Date(Date.now() + SESSION_MS), userAgent: req.headers.get("user-agent")?.slice(0, 200) ?? null },
  });
  // keep the table from growing: forget sessions that have expired
  void prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } }).catch(() => undefined);
  return setCookie(req, token, SESSION_MS / 1000);
}

export const clearSessionCookie = (req: Request): string => setCookie(req, "", 0);

export interface SignedIn {
  sessionId: string;
  user: { id: string; email: string; name: string };
}

/** Who is signed in on this request, or null. Never throws for a missing or stale cookie. */
export async function userFromRequest(req: Request): Promise<SignedIn | null> {
  const token = cookieValue(req, SESSION_COOKIE);
  if (!token) return null;
  const session = await prisma.session.findUnique({ where: { tokenHash: sha256(token) }, include: { user: { select: { id: true, email: true, name: true } } } });
  if (!session) return null;
  const now = Date.now();
  if (session.expiresAt.getTime() <= now) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }
  if (now - session.lastUsedAt.getTime() > TOUCH_MS) {
    await prisma.session.update({ where: { id: session.id }, data: { lastUsedAt: new Date(now), expiresAt: new Date(now + SESSION_MS) } }).catch(() => undefined);
  }
  return { sessionId: session.id, user: session.user };
}

/**
 * Browsers attach the cookie to cross-site requests too; this refuses the ones that did not start
 * on this site. SameSite=Lax already blocks most; this covers the rest. Requests without an Origin
 * (curl, scripts, server to server) cannot be forged from another site and pass.
 */
export function assertSameSite(req: Request): void {
  if (req.method === "GET" || req.method === "HEAD") return;
  if (req.headers.get("sec-fetch-site") === "cross-site") throw new HttpError(403, "cross_site", "Cross-site requests are not allowed.");
  const origin = req.headers.get("origin");
  if (!origin) return;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  let theirs: string;
  try {
    theirs = new URL(origin).host;
  } catch {
    throw new HttpError(403, "cross_site", "Bad Origin header.");
  }
  if (host && theirs !== host) throw new HttpError(403, "cross_site", "Cross-site requests are not allowed.");
}

export async function requireUser(req: Request): Promise<SignedIn> {
  assertSameSite(req);
  const signedIn = await userFromRequest(req);
  if (!signedIn) throw new HttpError(401, "signed_out", "Sign in to continue.");
  return signedIn;
}

/** Where to send someone after signing in: a path on this site, never another address. */
export function safeNext(next: string | null | undefined, fallback = "/dashboard"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\") || next.startsWith("/api/")) return fallback;
  return next;
}

/** Sign-in attempts: per address and per email, strict in production, loose while developing. */
export function loginAllowed(ip: string, email: string): boolean {
  if (process.env.NODE_ENV !== "production") return allow(`login-ip:${ip}`, 500, 50) && allow(`login:${email}`, 500, 50);
  return allow(`login-ip:${ip}`, 20, 1 / 6) && allow(`login:${email}`, 6, 1 / 60);
}
