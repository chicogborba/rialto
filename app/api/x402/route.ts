import { realClock } from "@/lib/agent/clock";
import { handle } from "@/lib/http";
import { liveStatus } from "@/lib/x402/status";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Which payment rail is on, and (for the live one) the wallet that pays and what it holds. */
export async function GET(): Promise<Response> {
  return handle(async () => Response.json(await liveStatus(realClock(0))));
}
