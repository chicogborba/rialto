import { listProviders, recentOutcomes, reputationSeries } from "@/lib/db/repo";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  const [providers, series, outcomes] = await Promise.all([listProviders(), reputationSeries(), recentOutcomes()]);
  return Response.json({ providers, series, outcomes });
}
