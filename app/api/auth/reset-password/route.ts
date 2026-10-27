import { assertSameSite, clearSessionCookie, clientIp } from "@/lib/auth/account";
import { resetPassword, ResetPasswordSchema } from "@/lib/auth/email-codes";
import { HttpError, handle, readJson } from "@/lib/http";
import { emailCodeAllowed } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request): Promise<Response> {
  return handle(async () => {
    assertSameSite(req);
    const body = ResetPasswordSchema.safeParse(await readJson(req));
    if (!body.success) throw new HttpError(400, "invalid_body", body.error.issues[0]?.message ?? "Enter your code and new password.");
    if (!emailCodeAllowed(clientIp(req), body.data.email)) throw new HttpError(429, "rate_limited", "Too many attempts. Wait a minute and try again.");
    await resetPassword(body.data.email, body.data.code, body.data.password);
    return Response.json({ ok: true }, { headers: { "set-cookie": clearSessionCookie(req) } });
  });
}
