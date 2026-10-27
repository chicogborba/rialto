import { sellerFromRequest } from "@/lib/auth/session";
import { SellerApiSchema } from "@/lib/db/accounts";
import { callUpstream, isTripoTaskEndpoint, timeoutFor, UpstreamError } from "@/lib/gateway/upstream";
import { HttpError, handle, readJson } from "@/lib/http";
import { allow } from "@/lib/security/rate-limit";
import { encryptSecret } from "@/lib/security/secrets";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DraftSchema = SellerApiSchema.pick({ capability: true, upstreamUrl: true, method: true, bodyTemplate: true, headers: true, resultPick: true });

/**
 * Dry run of an API that is not published yet: call the endpoint exactly as the gateway would, so a
 * seller sees what buyers will get before setting a price. No payment, nothing saved. The same SSRF
 * guard as the gateway applies, and a seller gets a handful of tries a minute.
 */
export async function POST(req: Request): Promise<Response> {
  return handle(async () => {
    const { sellerId } = await sellerFromRequest(req);
    if (!allow(`api-try:${sellerId}`, 8, 8 / 60)) throw new HttpError(429, "rate_limited", "Too many tries. Wait a minute.");
    const body = (await readJson(req)) as Record<string, unknown>;
    const parsed = DraftSchema.safeParse(body);
    if (!parsed.success) throw new HttpError(400, "invalid_body", `${parsed.error.issues[0]?.path.join(".") || "body"}: ${parsed.error.issues[0]?.message ?? "invalid"}`);
    const d = parsed.data;
    const goal = typeof body.goal === "string" && body.goal.trim() ? body.goal.trim().slice(0, 500) : "test";
    const t0 = Date.now();
    try {
      const result = await callUpstream(
        {
          url: d.upstreamUrl,
          method: d.method,
          bodyTemplate: d.method === "POST" ? (d.bodyTemplate ?? null) : null,
          encryptedHeaders: d.headers && Object.keys(d.headers).length ? encryptSecret(JSON.stringify(d.headers)) : null,
          resultPick: d.resultPick || null,
          taskMode: d.capability === "model.3d" && isTripoTaskEndpoint(d.upstreamUrl) ? "tripo-v2" : undefined,
          timeoutMs: timeoutFor(null, d.capability === "model.3d" || d.capability === "video.generate" ? 120_000 : 20_000),
        },
        { goal },
      );
      return Response.json({ ok: true, latencyMs: Date.now() - t0, result });
    } catch (e) {
      return Response.json({ ok: false, latencyMs: Date.now() - t0, error: e instanceof UpstreamError ? e.message : "upstream_error" });
    }
  });
}
