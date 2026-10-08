import { anonymousKeysAllowed } from "@/lib/security/keys";
import { signupAllowed } from "@/lib/security/rate-limit";
import { CreateSellerSchema, createSeller } from "@/lib/db/accounts";
import { HttpError, handle, readJson } from "@/lib/http";
import { canReceiveLive } from "@/lib/x402/status";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Create a seller account. The key is returned ONCE; only its hash is stored. */
export async function POST(req: Request): Promise<Response> {
  return handle(async () => {
    if (!anonymousKeysAllowed()) throw new HttpError(403, "accounts_required", "Create an account at /signup: it gives you agents and API keys.");
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
    if (!signupAllowed(ip)) throw new HttpError(429, "rate_limited", "Too many signups from this address");
    const parsed = CreateSellerSchema.safeParse(await readJson(req));
    if (!parsed.success) throw new HttpError(400, "invalid_body", parsed.error.issues[0]?.message ?? "Invalid body");
    // on the live rail a seller is paid on-chain per call, which needs a USDC account to pay into
    if (!(await canReceiveLive(parsed.data.payoutAddress))) {
      throw new HttpError(400, "payout_wallet_not_ready", "That address has no USDC account on Solana devnet yet, so it cannot be paid. Send it any amount of devnet USDC once (https://faucet.circle.com), then sign up again.");
    }
    return Response.json({ ...(await createSeller(parsed.data)), note: "Save this key now; it is shown only once." }, { status: 201 });
  });
}
