import { generateKeyPairSync } from "node:crypto";
import { getBase58Decoder } from "@solana/kit";
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

const Body = z.object({ changes: z.record(z.string(), z.string()).default({}), generate: z.literal("RIALTO_SPENDER_KEY").optional() });

/** A new Solana key pair as a base58 64-byte secret (seed + public key), the format the rest of the code reads. */
function newSecretKey(): string {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const seed = privateKey.export({ format: "der", type: "pkcs8" }).subarray(-32);
  const pub = publicKey.export({ format: "der", type: "spki" }).subarray(-32);
  return getBase58Decoder().decode(Buffer.concat([seed, pub]));
}

/** Saves settings (an empty value clears one back to the environment) and applies them at once. */
export async function PUT(req: Request): Promise<Response> {
  return handle(async () => {
    const { user } = await requireAdmin(req);
    const parsed = Body.safeParse(await readJson(req));
    if (!parsed.success) throw new HttpError(400, "invalid_body", "Nothing to save.");
    // the spender's key is made here, so nobody has to paste a private key into a browser
    if (parsed.data.generate) parsed.data.changes[parsed.data.generate] = newSecretKey();
    if (Object.keys(parsed.data.changes).length === 0) throw new HttpError(400, "invalid_body", "Nothing to save.");
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
