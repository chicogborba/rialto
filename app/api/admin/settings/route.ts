import { z } from "zod";
import { requireAdmin } from "@/lib/admin/auth";
import { reconcileSettings } from "@/lib/admin/reconcile";
import { listSettings, saveSettings } from "@/lib/admin/settings";
import { prisma } from "@/lib/db/client";
import { HttpError, handle, readJson } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request): Promise<Response> {
  return handle(async () => {
    await requireAdmin(req);
    return Response.json({ settings: await listSettings(prisma) });
  });
}

const Body = z.object({ changes: z.record(z.string(), z.string()) });

/** Saves settings (an empty value clears one back to the environment) and applies them at once. */
export async function PUT(req: Request): Promise<Response> {
  return handle(async () => {
    const { user } = await requireAdmin(req);
    const parsed = Body.safeParse(await readJson(req));
    if (!parsed.success || Object.keys(parsed.data.changes).length === 0) throw new HttpError(400, "invalid_body", "Nothing to save.");
    let keys: string[];
    try {
      keys = await saveSettings(prisma, parsed.data.changes, user.email);
    } catch (e) {
      throw new HttpError(400, "invalid_setting", e instanceof Error ? e.message : "Invalid value");
    }
    const applied = await reconcileSettings(prisma);
    console.log(`[admin] ${user.email} changed ${keys.join(", ")}`);
    return Response.json({ saved: keys, ...applied, settings: await listSettings(prisma) });
  });
}
