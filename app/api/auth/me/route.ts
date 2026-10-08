import { userFromRequest } from "@/lib/auth/account";
import { handle } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Who is signed in. 401 when nobody is. */
export async function GET(req: Request): Promise<Response> {
  return handle(async () => {
    const signedIn = await userFromRequest(req);
    if (!signedIn) return Response.json({ error: { code: "signed_out", message: "Not signed in." } }, { status: 401 });
    return Response.json({ user: signedIn.user });
  });
}
