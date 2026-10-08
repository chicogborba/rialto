import { requireUser } from "@/lib/auth/account";
import { AgentNameSchema, createAgentFor } from "@/lib/db/users";
import { HttpError, handle, readJson } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Create an agent: a key for Claude Code or Codex. The key is returned once; only its hash is stored. */
export async function POST(req: Request): Promise<Response> {
  return handle(async () => {
    const { user } = await requireUser(req);
    const parsed = AgentNameSchema.safeParse(await readJson(req));
    if (!parsed.success) throw new HttpError(400, "invalid_body", "Give the agent a name (1 to 40 characters).");
    const created = await createAgentFor(user.id, parsed.data.name);
    return Response.json({ ...created, note: "Save this key now; it is shown only once." }, { status: 201 });
  });
}
