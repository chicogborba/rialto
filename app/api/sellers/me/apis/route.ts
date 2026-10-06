import { sellerFromRequest } from "@/lib/auth/session";
import { registerSellerApi, SellerApiSchema } from "@/lib/db/accounts";
import { HttpError, handle, readJson } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Publish an API: the platform will call `upstreamUrl` for buyers and pay you `priceUsd` per successful call. */
export async function POST(req: Request): Promise<Response> {
  return handle(async () => {
    const { sellerId } = await sellerFromRequest(req);
    const parsed = SellerApiSchema.safeParse(await readJson(req));
    if (!parsed.success) throw new HttpError(400, "invalid_body", `${parsed.error.issues[0]?.path.join(".") || "body"}: ${parsed.error.issues[0]?.message ?? "invalid"}`);
    const { provider, split } = await registerSellerApi(sellerId, parsed.data);
    return Response.json(
      {
        id: provider.id,
        slug: provider.slug,
        capability: parsed.data.capability,
        youEarnUsd: split.sellerMicro / 1_000_000,
        buyersPayUsd: split.buyerMicro / 1_000_000,
        platformFeeUsd: split.feeMicro / 1_000_000,
        status: "online",
      },
      { status: 201 },
    );
  });
}
