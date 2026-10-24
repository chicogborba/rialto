/** Runs once when the server starts: the settings saved in /admin override the environment from the first request on. */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const [{ prisma }, { applySettings }] = await Promise.all([import("@/lib/db/client"), import("@/lib/admin/settings")]);
  try {
    const keys = await applySettings(prisma);
    if (keys.length) console.log(`[settings] from /admin: ${keys.join(", ")}`);
  } catch (e) {
    // a database without the table yet (first start, before `prisma db push`) keeps the environment
    console.error("[settings] not applied:", e instanceof Error ? e.message : e);
  }
}
