import { z } from "zod";
import { requireUser } from "@/lib/auth/account";
import { changePassword } from "@/lib/db/users";
import { HttpError, handle, readJson } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const Body = z.object({ current: z.string().max(200), next: z.string().max(200) });

/** Change the password. Every other device is signed out. */
export async function POST(req: Request): Promise<Response> {
  return handle(async () => {
    const { user, sessionId } = await requireUser(req);
    const parsed = Body.safeParse(await readJson(req));
    if (!parsed.success) throw new HttpError(400, "invalid_body", "Send your current and your new password.");
    await changePassword(user.id, parsed.data.current, parsed.data.next, sessionId);
    return Response.json({ ok: true });
  });
}
