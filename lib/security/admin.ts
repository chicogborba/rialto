import { timingSafeEqual } from "node:crypto";
import { bearerFrom } from "./keys";

/**
 * Who may wipe the database. While developing, anyone on the machine. In production only a caller
 * that sends `Authorization: Bearer <ADMIN_TOKEN>`; with no ADMIN_TOKEN set, nobody.
 */
export function isAdmin(req: Request, env: Record<string, string | undefined> = process.env): boolean {
  if (env.NODE_ENV !== "production") return true;
  const want = env.ADMIN_TOKEN?.trim();
  const got = bearerFrom(req.headers.get("authorization"));
  if (!want || !got) return false;
  const a = Buffer.from(got);
  const b = Buffer.from(want);
  return a.length === b.length && timingSafeEqual(a, b);
}
