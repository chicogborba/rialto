import { prisma } from "@/lib/db/client";
import { requireUser, type SignedIn } from "@/lib/auth/account";
import { HttpError } from "@/lib/http";

/** Emails that are admins whatever their row says (`SUPERADMIN_EMAILS`, comma separated): how the first admin gets in. */
export function superadminEmails(env: Record<string, string | undefined> = process.env): Set<string> {
  return new Set((env.SUPERADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean));
}

export function isAdminUser(user: { email: string; role: string }): boolean {
  return user.role === "admin" || superadminEmails().has(user.email.toLowerCase());
}

/** The signed-in operator, or 401/403. Every /api/admin route starts here. */
export async function requireAdmin(req: Request): Promise<SignedIn> {
  const signedIn = await requireUser(req);
  const row = await prisma.user.findUnique({ where: { id: signedIn.user.id }, select: { email: true, role: true } });
  if (!row || !isAdminUser(row)) throw new HttpError(403, "not_admin", "This page is for Rialto's operators.");
  return signedIn;
}
