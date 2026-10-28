import { simulationAllowed } from "@/lib/simulation";
import { createHmac, randomBytes, randomInt } from "node:crypto";
import type { EmailChallenge, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { SignupSchema, WELCOME_CREDIT_MICRO } from "@/lib/db/users";
import { emailConfig, sendEmail } from "@/lib/email/send";
import { codeEmail, type EmailPurpose } from "@/lib/email/templates";
import { HttpError } from "@/lib/http";
import { LEGAL_VERSION } from "@/lib/legal";
import { hashPassword, normalizeEmail, passwordProblem } from "./password";

export const CODE_LIFETIME_MS = 10 * 60_000;
export const CODE_RESEND_MS = 60_000;
export const CODE_MAX_ATTEMPTS = 5;
const Email = z.string().trim().max(254).email("Enter a valid email address.");
export const EmailCodeSchema = z.object({ email: Email, code: z.string().regex(/^\d{6}$/, "Enter the six-digit code from your email.") });
export const ForgotPasswordSchema = z.object({ email: Email });
export const ResetPasswordSchema = EmailCodeSchema.extend({ password: z.string().max(200) });

// Development-only fallback. Production uses the already-required encryption secret.
const developmentSecret = randomBytes(32).toString("hex");
function codeHash(id: string, code: string): string {
  const secret = process.env.SECRETS_KEY?.trim();
  if (!secret && process.env.NODE_ENV === "production") throw new HttpError(503, "email_unavailable", "Email confirmation is temporarily unavailable.");
  return createHmac("sha256", secret || developmentSecret).update(`rialto-email:${id}:${code}`).digest("hex");
}

const invalidCode = () => new HttpError(400, "invalid_code", "That code is invalid or has expired. Request a new code and try again.");

async function issueCode(email: string, purpose: EmailPurpose, data: { name?: string; passwordHash?: string; termsVersion?: string; termsAcceptedAt?: Date; userId?: string } = {}): Promise<void> {
  const now = new Date();
  const id = randomBytes(24).toString("hex");
  const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
  const digest = codeHash(id, code);
  await prisma.$transaction(async (db) => {
    const previous = await db.emailChallenge.findUnique({ where: { email_purpose: { email, purpose } } });
    if (previous && now.getTime() - previous.sentAt.getTime() < CODE_RESEND_MS) throw new HttpError(429, "code_cooldown", "Please wait a minute before requesting another code.");
    // A resend invalidates the old code and, for signup, replaces the pending credentials.
    await db.emailChallenge.upsert({
      where: { email_purpose: { email, purpose } },
      create: { id, email, purpose, codeHash: digest, expiresAt: new Date(now.getTime() + CODE_LIFETIME_MS), sentAt: now, ...data },
      update: { id, codeHash: digest, attempts: 0, expiresAt: new Date(now.getTime() + CODE_LIFETIME_MS), sentAt: now, ...data },
    });
    await db.emailChallenge.deleteMany({ where: { expiresAt: { lt: new Date(now.getTime() - 24 * 3600_000) } } });
  });
  try {
    await sendEmail(codeEmail(email, code, purpose), `email-code/${id}`);
  } catch (e) {
    await prisma.emailChallenge.deleteMany({ where: { id } });
    throw e;
  }
}

/** Do not reserve an email or create a session before its owner proves they can read it. */
export async function requestSignup(input: z.infer<typeof SignupSchema>): Promise<void> {
  const email = normalizeEmail(input.email);
  const problem = passwordProblem(input.password, email);
  if (problem) throw new HttpError(400, "weak_password", problem);
  emailConfig();
  if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) throw new HttpError(409, "email_taken", "There is already an account with that email. Sign in instead.");
  await issueCode(email, "signup", { name: input.name, passwordHash: await hashPassword(input.password), termsVersion: LEGAL_VERSION, termsAcceptedAt: new Date() });
}

/** Increment failed attempts outside the consume transaction so a rejection cannot roll them back. */
async function matchingCode(email: string, purpose: EmailPurpose, code: string): Promise<EmailChallenge> {
  const pending = await prisma.emailChallenge.findUnique({ where: { email_purpose: { email: normalizeEmail(email), purpose } } });
  if (!pending || pending.expiresAt.getTime() <= Date.now() || pending.attempts >= CODE_MAX_ATTEMPTS) throw invalidCode();
  const digest = codeHash(pending.id, code);
  if (pending.codeHash !== digest) {
    await prisma.emailChallenge.updateMany({ where: { id: pending.id, attempts: { lt: CODE_MAX_ATTEMPTS } }, data: { attempts: { increment: 1 } } });
    throw invalidCode();
  }
  return pending;
}

async function consumeCode(db: Prisma.TransactionClient, pending: EmailChallenge): Promise<void> {
  const consumed = await db.emailChallenge.deleteMany({ where: { id: pending.id, codeHash: pending.codeHash, attempts: { lt: CODE_MAX_ATTEMPTS }, expiresAt: { gt: new Date() } } });
  if (consumed.count !== 1) throw invalidCode();
}

export async function confirmSignup(email: string, code: string): Promise<{ id: string; email: string; name: string }> {
  const pending = await matchingCode(email, "signup", code);
  if (!pending.name || !pending.passwordHash) throw invalidCode();
  const name = pending.name;
  const passwordHash = pending.passwordHash;
  try {
    return await prisma.$transaction(async (db) => {
      await consumeCode(db, pending);
      const credit = simulationAllowed() ? WELCOME_CREDIT_MICRO : 0;
      const user = await db.user.create({ data: { email: pending.email, name, passwordHash, emailVerifiedAt: new Date(), balanceMicro: credit, welcomeCreditAt: credit ? new Date() : null, termsVersion: pending.termsVersion, termsAcceptedAt: pending.termsAcceptedAt }, select: { id: true, email: true, name: true } });
      if (credit) await db.ledgerEntry.create({ data: { kind: "welcome_credit", userId: user.id, amountMicro: credit, note: "welcome test credit" } });
      return user;
    });
  } catch (e) {
    if (typeof e === "object" && e !== null && "code" in e && e.code === "P2002") throw new HttpError(409, "email_taken", "There is already an account with that email. Sign in instead.");
    throw e;
  }
}

/** Always return the same public response for known and unknown addresses. */
export async function requestPasswordReset(emailInput: string): Promise<void> {
  emailConfig();
  const email = normalizeEmail(emailInput);
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, passwordHash: true } });
  if (!user) return;
  try {
    await issueCode(email, "password_reset", { userId: user.id, passwordHash: user.passwordHash });
  } catch (e) {
    if (!(e instanceof HttpError && e.code === "code_cooldown")) console.error("[email] Password reset delivery failed");
    // Do not reveal whether an account exists through cooldown or delivery errors.
  }
}

export async function resetPassword(email: string, code: string, password: string): Promise<void> {
  const pending = await matchingCode(email, "password_reset", code);
  const problem = passwordProblem(password, pending.email);
  if (problem) throw new HttpError(400, "weak_password", problem);
  const passwordHash = await hashPassword(password);
  await prisma.$transaction(async (db) => {
    await consumeCode(db, pending);
    if (!pending.userId || !pending.passwordHash) throw invalidCode();
    // A password changed since the request invalidates the old reset code.
    const changed = await db.user.updateMany({ where: { id: pending.userId, passwordHash: pending.passwordHash }, data: { passwordHash, emailVerifiedAt: new Date() } });
    if (changed.count !== 1) throw invalidCode();
    await db.session.deleteMany({ where: { userId: pending.userId } });
  });
}
