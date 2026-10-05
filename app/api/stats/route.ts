import { getStats } from "@/lib/db/repo";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  return Response.json(await getStats());
}
