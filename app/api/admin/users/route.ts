import { z } from "zod";
import { isAdminUser, requireAdmin, superadminEmails } from "@/lib/admin/auth";
import { listUsers, micro, toCsv } from "@/lib/admin/stats";
import { prisma } from "@/lib/db/client";
import { HttpError, handle, readJson } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Every account. `?format=csv` downloads them for a spreadsheet. */
export async function GET(req: Request): Promise<Response> {
  return handle(async () => {
    const { user } = await requireAdmin(req);
    const rows = await listUsers(prisma, isAdminUser);
    if (new URL(req.url).searchParams.get("format") !== "csv") return Response.json({ rows });
    console.log(`[admin] ${user.email} exported ${rows.length} users`);
    const csv = toCsv(
      ["email", "name", "verified", "role", "joined", "last_seen", "agents", "purchases", "spent_usd", "pays_from_wallet", "paid_at_wallet", "apis_sold"],
      rows.map((u) => [u.email, u.name, u.verified, u.admin ? "admin" : "user", u.createdAt, u.lastSeenAt, u.agents, u.purchases, micro(u.spentMicro), u.payWallet, u.wallet, u.sellsApis]),
    );
    return new Response(csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="rialto-users-${new Date().toISOString().slice(0, 10)}.csv"`, "cache-control": "no-store" } });
  });
}

const Body = z.object({ id: z.string().min(1), role: z.enum(["user", "admin"]) });

/** Makes someone an operator, or takes it back. Nobody can demote themselves, and SUPERADMIN_EMAILS always stay admins. */
export async function POST(req: Request): Promise<Response> {
  return handle(async () => {
    const { user } = await requireAdmin(req);
    const parsed = Body.safeParse(await readJson(req));
    if (!parsed.success) throw new HttpError(400, "invalid_body", "Send { id, role }.");
    const target = await prisma.user.findUnique({ where: { id: parsed.data.id }, select: { id: true, email: true } });
    if (!target) throw new HttpError(404, "unknown_user", "No such user.");
    if (parsed.data.role === "user" && target.id === user.id) throw new HttpError(400, "self", "You cannot remove your own access.");
    if (parsed.data.role === "user" && superadminEmails().has(target.email)) throw new HttpError(400, "superadmin", "This email is an admin through SUPERADMIN_EMAILS on the server.");
    await prisma.user.update({ where: { id: target.id }, data: { role: parsed.data.role } });
    console.log(`[admin] ${user.email} set ${target.email} to ${parsed.data.role}`);
    return Response.json({ ok: true });
  });
}
