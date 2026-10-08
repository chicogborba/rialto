import { clientIp, loginAllowed, startSession } from "@/lib/auth/account";
import { normalizeEmail } from "@/lib/auth/password";
import { authenticate, LoginSchema } from "@/lib/db/users";
import { HttpError, handle, readJson } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request): Promise<Response> {
  return handle(async () => {
    const parsed = LoginSchema.safeParse(await readJson(req));
    if (!parsed.success) throw new HttpError(400, "invalid_body", "Enter your email and password.");
    if (!loginAllowed(clientIp(req), normalizeEmail(parsed.data.email))) throw new HttpError(429, "rate_limited", "Too many attempts. Wait a minute and try again.");
    const user = await authenticate(parsed.data.email, parsed.data.password);
    // the same answer for an unknown email and a wrong password
    if (!user) throw new HttpError(401, "bad_credentials", "Wrong email or password.");
    return Response.json({ user }, { headers: { "set-cookie": await startSession(user.id, req) } });
  });
}
