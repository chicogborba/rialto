import { z } from "zod";
import { realClock } from "@/lib/agent/clock";
import { resolveConstraints } from "@/lib/agent/constraints";
import { DemoAgentPlanner } from "@/lib/agent/demo-planner";
import type { RunEvent } from "@/lib/agent/events";
import { runAgent, type RunDeps } from "@/lib/agent/run";
import { buyerFromRequest } from "@/lib/auth/session";
import { createRun, persistentDepsFor, getWallet, listCandidates, getHistory } from "@/lib/db/repo";
import { errorResponse, internalBase } from "@/lib/http";
import { createHttpExecutor } from "@/lib/providers/http-executor";
import { anonymousRunAllowed } from "@/lib/security/rate-limit";
import { getRail } from "@/lib/x402";
import type { WalletState } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const WeightsSchema = z.object({
  quality: z.number().min(0),
  price: z.number().min(0),
  latency: z.number().min(0),
  trust: z.number().min(0),
});

const BodySchema = z.object({
  goal: z.string().trim().min(3).max(500),
  budgetMicro: z.number().int().min(0).max(10_000_000).optional(),
  preset: z.enum(["balanced", "accuracy", "cost", "speed", "custom"]).optional(),
  weights: WeightsSchema.optional(),
  speed: z.number().min(0).max(3).optional(),
  /** landing demo: in-memory wallet copy, no DB writes */
  ephemeral: z.boolean().optional(),
});

export async function POST(req: Request): Promise<Response> {
  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "invalid_body", issues: parsed.error.issues }, { status: 400 });
  }
  const body = parsed.data;

  let buyer;
  try {
    buyer = await buyerFromRequest(req);
  } catch (e) {
    return errorResponse(e);
  }
  if (!buyer.authed && !anonymousRunAllowed(req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local")) {
    return Response.json({ error: "rate_limited", message: "Too many runs from this address. Wait a moment, or connect your own agent." }, { status: 429 });
  }
  let wallet: WalletState;
  try {
    wallet = await getWallet(buyer.agentId);
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "wallet_unavailable" }, { status: 503 });
  }

  const clock = realClock(body.speed ?? 1);
  const rail = getRail(clock);
  const constraints = resolveConstraints({
    goal: body.goal,
    policy: wallet.policy,
    budgetMicro: body.budgetMicro,
    preset: body.preset,
    weights: body.weights,
  });
  const runId = clock.id("run");
  const executor = createHttpExecutor(internalBase(req));

  let deps: RunDeps;
  if (body.ephemeral) {
    const mem = { ...wallet };
    deps = {
      planner: new DemoAgentPlanner(),
      rail,
      clock,
      registry: { listCandidates, history: getHistory },
      wallet: {
        get: () => Promise.resolve({ ...mem }),
        debit: (amt) => {
          mem.balanceMicro -= amt;
          mem.sessionSpendMicro += amt;
          return Promise.resolve({ ...mem });
        },
      },
      executor,
    };
  } else {
    await createRun({ runId, goal: body.goal, constraints, mode: rail.mode, agentId: buyer.agentId });
    deps = { planner: new DemoAgentPlanner(), rail, clock, executor, ...persistentDepsFor(buyer.agentId) };
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let open = true;
      const send = (e: RunEvent) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`));
        } catch {
          open = false; // client went away — keep running so the DB run still finishes
        }
      };
      try {
        for await (const e of runAgent({ goal: body.goal, constraints, runId }, deps)) send(e);
      } catch (err) {
        send({
          seq: -1,
          ts: Date.now(),
          runId,
          type: "run.failed",
          stepId: null,
          error: err instanceof Error ? err.message : "run_crashed",
        });
      } finally {
        if (open) controller.close();
      }
    },
    cancel() {
      /* handled by `open` flag */
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}
