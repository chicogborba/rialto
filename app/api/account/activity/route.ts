import { requireUser } from "@/lib/auth/account";
import { accountActivity } from "@/lib/db/users";
import { handle } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** The latest calls made by this account's agents. */
export async function GET(req: Request): Promise<Response> {
  return handle(async () => {
    const { user } = await requireUser(req);
    return Response.json({ rows: await accountActivity(user.id, 25) });
  });
}
