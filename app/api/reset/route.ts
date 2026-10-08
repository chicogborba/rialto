import { prisma } from "@/lib/db/client";
import { seedDatabase } from "@/lib/db/seed";
import { HttpError, handle } from "@/lib/http";
import { isAdmin } from "@/lib/security/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Wipes and reseeds the demo database. Open while developing; in production it needs the admin token. */
export async function POST(req: Request): Promise<Response> {
  return handle(async () => {
    if (!isAdmin(req)) throw new HttpError(403, "forbidden", "Resetting the demo is turned off on this server.");
    await seedDatabase(prisma);
    return Response.json({ ok: true });
  });
}
