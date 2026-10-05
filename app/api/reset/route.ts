import { prisma } from "@/lib/db/client";
import { seedDatabase } from "@/lib/db/seed";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Wipes and reseeds the local demo database. */
export async function POST(): Promise<Response> {
  await seedDatabase(prisma);
  return Response.json({ ok: true });
}
