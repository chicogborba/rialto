import { signupAllowed } from "@/lib/security/rate-limit";
import { CreateBuyerSchema, createBuyer } from "@/lib/db/accounts";
import { HttpError, handle, readJson } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Create a buyer account. The key is returned ONCE; only its hash is stored. */
export async function POST(req: Request): Promise<Response> {
  return handle(async () => {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
    if (!signupAllowed(ip)) throw new HttpError(429, "rate_limited", "Too many signups from this address");
    const parsed = CreateBuyerSchema.safeParse(await readJson(req));
    if (!parsed.success) throw new HttpError(400, "invalid_body", parsed.error.issues[0]?.message ?? "Invalid body");
    const created = await createBuyer(parsed.data.name);
    return Response.json({ ...created, balanceUsd: created.balanceMicro / 1_000_000, mode: "simulated", note: "Save this key now; it is shown only once." }, { status: 201 });
  });
}
