import { signupAllowed } from "@/lib/security/rate-limit";
import { CreateSellerSchema, createSeller } from "@/lib/db/accounts";
import { HttpError, handle, readJson } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Create a seller account. The key is returned ONCE; only its hash is stored. */
export async function POST(req: Request): Promise<Response> {
  return handle(async () => {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
    if (!signupAllowed(ip)) throw new HttpError(429, "rate_limited", "Too many signups from this address");
    const parsed = CreateSellerSchema.safeParse(await readJson(req));
    if (!parsed.success) throw new HttpError(400, "invalid_body", parsed.error.issues[0]?.message ?? "Invalid body");
    return Response.json({ ...(await createSeller(parsed.data)), note: "Save this key now; it is shown only once." }, { status: 201 });
  });
}
