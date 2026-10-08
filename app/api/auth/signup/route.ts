import { clientIp, startSession } from "@/lib/auth/account";
import { createUser, SignupSchema } from "@/lib/db/users";
import { HttpError, handle, readJson } from "@/lib/http";
import { signupAllowed } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Create an account with an email and a password, and sign in. */
export async function POST(req: Request): Promise<Response> {
  return handle(async () => {
    if (!signupAllowed(clientIp(req))) throw new HttpError(429, "rate_limited", "Too many sign-ups from this address. Try again in a few minutes.");
    const parsed = SignupSchema.safeParse(await readJson(req));
    if (!parsed.success) throw new HttpError(400, "invalid_body", parsed.error.issues[0]?.message ?? "Invalid details.");
    const user = await createUser(parsed.data);
    const cookie = await startSession(user.id, req);
    return Response.json({ user }, { status: 201, headers: { "set-cookie": cookie } });
  });
}
