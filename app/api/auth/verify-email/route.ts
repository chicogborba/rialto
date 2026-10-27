import { assertSameSite, clientIp, startSession } from "@/lib/auth/account";
import { confirmSignup, EmailCodeSchema } from "@/lib/auth/email-codes";
import { HttpError, handle, readJson } from "@/lib/http";
import { emailCodeAllowed } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request): Promise<Response> {
  return handle(async () => {
    assertSameSite(req);
    const body = EmailCodeSchema.safeParse(await readJson(req));
    if (!body.success) throw new HttpError(400, "invalid_body", body.error.issues[0]?.message ?? "Enter your email and code.");
    if (!emailCodeAllowed(clientIp(req), body.data.email)) throw new HttpError(429, "rate_limited", "Too many attempts. Wait a minute and try again.");
    const user = await confirmSignup(body.data.email, body.data.code);
    return Response.json({ user }, { status: 201, headers: { "set-cookie": await startSession(user.id, req) } });
  });
}
