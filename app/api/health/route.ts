import { prisma } from "@/lib/db/client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Liveness for the container and the proxy: the server answers and the database is there. */
export async function GET(): Promise<Response> {
  try {
    const providers = await prisma.provider.count();
    return Response.json({ ok: true, providers });
  } catch {
    return Response.json({ ok: false, error: "database_unavailable" }, { status: 503 });
  }
}
