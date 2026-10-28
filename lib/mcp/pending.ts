/**
 * Purchases that outlive the agent's tool call. Some APIs (3D models, video, long music) take
 * minutes; an MCP client gives up on a tool call long before that, and the agent would be charged
 * for a result it never received. So execute_service waits a while, then answers "pending" with the
 * run's id while the purchase carries on; get_result hands over the result once it is in. The
 * charge is unchanged: it still only happens when the API delivers.
 *
 * Kept in memory, per process (like the rate limits). A result is also in the database with its
 * purchase, so get_result can still find it after a restart.
 */

interface Job {
  agentId: string;
  started: number;
  done: boolean;
  value?: unknown;
  error?: Error;
}

const g = globalThis as unknown as { __rialtoJobs?: Map<string, Job> };
const jobs = (g.__rialtoJobs ??= new Map<string, Job>());
/** how long a finished job's result is kept for get_result */
const KEEP_MS = 60 * 60_000;
const PENDING = Symbol("pending");

/** How long execute_service waits before answering "pending" (MCP clients time out around a minute). */
export function waitMs(env: Record<string, string | undefined> = process.env): number {
  const s = Number(env.MCP_WAIT_SECONDS);
  return (Number.isFinite(s) && s > 0 ? s : 45) * 1000;
}

function sweep(now: number): void {
  for (const [id, job] of jobs) if (now - job.started > KEEP_MS) jobs.delete(id);
}

export interface Pending {
  status: "pending";
  runId: string;
  next: string;
}

/**
 * The result of `work` if it is ready within `ms`; otherwise a "pending" answer, and the work goes
 * on to be collected with get_result. Errors within the wait are thrown as usual.
 */
export async function resultOrPending<T>(agentId: string, runId: string, work: Promise<T>, ms = waitMs()): Promise<T | Pending> {
  const job: Job = { agentId, started: Date.now(), done: false };
  const tracked = work.then(
    (value) => {
      job.done = true;
      job.value = value;
      return value;
    },
    (error: unknown) => {
      job.done = true;
      job.error = error instanceof Error ? error : new Error(String(error));
      throw job.error;
    },
  );
  let timer: ReturnType<typeof setTimeout> | undefined;
  const first = await Promise.race([tracked, new Promise<typeof PENDING>((resolve) => (timer = setTimeout(() => resolve(PENDING), ms)))]).finally(() => clearTimeout(timer));
  if (first !== PENDING) return first as T;
  tracked.catch(() => undefined); // collected later by get_result
  sweep(Date.now());
  jobs.set(runId, job);
  return {
    status: "pending",
    runId,
    next: `Still generating (this API can take a few minutes). Call get_result with runId "${runId}" in about 30 seconds, and again until it is ready. You are charged only if it delivers.`,
  };
}

/** What get_result finds for a run: the finished result, its error, "pending", or nothing (unknown here). */
export function jobFor(agentId: string, runId: string): { state: "done"; value: unknown } | { state: "failed"; error: Error } | { state: "pending" } | null {
  const job = jobs.get(runId);
  if (!job || job.agentId !== agentId) return null;
  if (!job.done) return { state: "pending" };
  return job.error ? { state: "failed", error: job.error } : { state: "done", value: job.value };
}
