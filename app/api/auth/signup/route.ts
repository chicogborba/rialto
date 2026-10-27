import { assertSameSite, clientIp } from "@/lib/auth/account";
import { requestSignup } from "@/lib/auth/email-codes";
import { SignupSchema } from "@/lib/db/users";
import { HttpError, handle, readJson } from "@/lib/http";
import { signupAllowed } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Send a confirmation code. Only verification creates the account and session. */
export async function POST(req: Request): Promise<Response> {
  return handle(async () => {
    assertSameSite(req);
    if (!signupAllowed(clientIp(req))) throw new HttpError(429, "rate_limited", "Too many sign-ups from this address. Try again in a few minutes.");
    const parsed = SignupSchema.safeParse(await readJson(req));
    if (!parsed.success) throw new HttpError(400, "invalid_body", parsed.error.issues[0]?.message ?? "Invalid details.");
    await requestSignup(parsed.data);
    return Response.json({ verificationRequired: true }, { status: 202 });
  });
}
