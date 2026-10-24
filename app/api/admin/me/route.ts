import { requireAdmin } from "@/lib/admin/auth";
import { handle } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** 200 for an operator, 401/403 for everyone else: what /admin asks before showing anything. */
export async function GET(req: Request): Promise<Response> {
  return handle(async () => {
    const { user } = await requireAdmin(req);
    return Response.json({ email: user.email, name: user.name });
  });
}
