import { assertSameSite, clientIp } from "@/lib/auth/account";
import { ForgotPasswordSchema, requestPasswordReset } from "@/lib/auth/email-codes";
import { HttpError, handle, readJson } from "@/lib/http";
import { emailRequestAllowed } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request): Promise<Response> {
  return handle(async () => {
    assertSameSite(req);
    const body = ForgotPasswordSchema.safeParse(await readJson(req));
    if (!body.success) throw new HttpError(400, "invalid_body", "Enter a valid email address.");
    if (!emailRequestAllowed(clientIp(req), body.data.email)) throw new HttpError(429, "rate_limited", "Too many requests. Please try again later.");
    await requestPasswordReset(body.data.email);
    return Response.json({ ok: true, message: "If an account exists for that email, we have sent a password reset code." });
  });
}
