import { getProviderBySlug } from "@/lib/db/repo";
import { toProvider, toService } from "@/lib/db/mappers";
import { handleSimCall } from "@/lib/providers/sim-provider";
import { realClock } from "@/lib/agent/clock";
import { getRail } from "@/lib/x402";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

declare global {
  var __simFailedOnce: Set<string> | undefined;
}
const failedOnce = (globalThis.__simFailedOnce ??= new Set<string>());
const rail = getRail(realClock(0));

/** Simulated x402-style provider endpoint for DEMO providers. Real HTTP 402, simulated payment. */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ provider: string; capability: string }> },
): Promise<Response> {
  const { provider: slug, capability } = await ctx.params;
  const row = await getProviderBySlug(slug);
  const svcRow = row?.services.find((s) => s.capability === capability);
  if (!row || !svcRow || !row.isDemo) return Response.json({ error: "unknown_service" }, { status: 404 });
  const service = toService(svcRow);
  if (!service) return Response.json({ error: "unknown_service" }, { status: 404 });

  const body: unknown = await req.json().catch(() => ({}));
  const out = await handleSimCall({
    provider: toProvider(row),
    service,
    payTo: row.payTo,
    demoFailFirstCall: svcRow.demoFailFirstCall,
    headers: Object.fromEntries(req.headers.entries()),
    body,
    rail,
    failedOnce,
  });
  return Response.json(out.json, { status: out.status, headers: out.headers });
}
