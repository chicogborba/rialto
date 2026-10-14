import { decryptSecret } from "@/lib/security/secrets";
import { assertPublicUrl, UnsafeUpstreamError } from "@/lib/security/ssrf";
import { deriveInput, fill, MAX_RESULT_BYTES, MAX_UPSTREAM_BYTES, pick, placeholders } from "./template";

export interface UpstreamConfig {
  url: string;
  method: string;
  bodyTemplate: string | null;
  /** AES-GCM blob of a JSON object of headers */
  encryptedHeaders: string | null;
  resultPick: string | null;
  /** Some upstreams return a task ID and must be polled before the buyer is charged. */
  taskMode?: "tripo-v2";
  /** How long the one request may take (see `timeoutFor`); 8 s when not given. */
  timeoutMs?: number;
}

export class UpstreamError extends Error {}

async function readCapped(res: Response, max: number): Promise<string> {
  if (!res.body) return "";
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > max) {
      await reader.cancel();
      throw new UpstreamError("upstream_response_too_large");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

async function requestJson(url: URL, init: RequestInit, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(url, { ...init, redirect: "manual", signal: AbortSignal.timeout(timeoutMs), cache: "no-store" });
  } catch (e) {
    throw new UpstreamError(e instanceof Error && e.name === "TimeoutError" ? "upstream_timeout" : "upstream_unreachable");
  }
  if (res.status >= 300 && res.status < 400) throw new UpstreamError("upstream_redirect_blocked");
  if (!res.ok) throw new UpstreamError(`upstream_${res.status}`);

  const text = await readCapped(res, MAX_UPSTREAM_BYTES);
  try {
    return JSON.parse(text);
  } catch {
    return { text: text.slice(0, 4000) };
  }
}

const MAX_INPUTS_CHARS = 6_000;
const DEFAULT_TIMEOUT_MS = 8_000;
const MAX_TIMEOUT_MS = 240_000;
/**
 * How long one call to a seller's API may take: 8 s unless the API says it is slower than that
 * (its published typical latency), then four times that latency, up to 4 minutes (a video or a 3D
 * model takes that long).
 */
export function timeoutFor(latencyMs: number | null | undefined): number {
  return Math.min(MAX_TIMEOUT_MS, Math.max(DEFAULT_TIMEOUT_MS, (latencyMs ?? 0) * 4));
}

const TRIPO_WAIT_MS = 45_000;
const TRIPO_POLL_INTERVAL_MS = 2_000;

/** Only this documented Tripo v2 task endpoint gets task polling; all other seller APIs remain one request. */
export function isTripoTaskEndpoint(raw: string): boolean {
  try {
    const url = new URL(raw);
    return url.protocol === "https:" && url.hostname === "api.tripo3d.ai" && url.pathname === "/v2/openapi/task";
  } catch {
    return false;
  }
}

async function waitForTripoTask(url: URL, headers: Record<string, string>, created: unknown): Promise<unknown> {
  const taskId = isRecord(created) && isRecord(created.data) && typeof created.data.task_id === "string" ? created.data.task_id : null;
  if (!taskId) throw new UpstreamError("upstream_task_missing_id");

  const pollUrl = new URL(url);
  pollUrl.pathname = `/v2/openapi/task/${encodeURIComponent(taskId)}`;
  pollUrl.search = "";
  const deadline = Date.now() + TRIPO_WAIT_MS;
  while (Date.now() < deadline) {
    await new Promise<void>((resolve) => setTimeout(resolve, TRIPO_POLL_INTERVAL_MS));
    const response = await requestJson(pollUrl, { method: "GET", headers });
    const task = isRecord(response) && isRecord(response.data) ? response.data : null;
    const status = task && typeof task.status === "string" ? task.status : "";
    if (status === "success") return response;
    if (["failed", "banned", "expired", "cancelled", "unknown"].includes(status)) throw new UpstreamError(`upstream_task_${status}`);
  }
  throw new UpstreamError("upstream_task_timeout");
}

/**
 * Call the seller's real API on behalf of a buyer. Hardened: https + public addresses only (checked
 * again here, after placeholder substitution), no redirects, a timeout (see `timeoutFor`), bounded response size,
 * bounded result size. Any throw means "failed" and the buyer is not charged.
 */
export async function callUpstream(cfg: UpstreamConfig, requestBody: unknown): Promise<Record<string, unknown>> {
  const goal = typeof requestBody === "object" && requestBody !== null && "goal" in requestBody && typeof requestBody.goal === "string" ? requestBody.goal : "";
  // what the earlier steps of the same run returned, for an API that builds on them (an analysis of search results)
  const earlier = isRecord(requestBody) && isRecord(requestBody.inputs) && Object.keys(requestBody.inputs).length > 0 ? JSON.stringify(requestBody.inputs).slice(0, MAX_INPUTS_CHARS) : "";
  const values = { ...deriveInput(goal), inputs: earlier };
  // an API that works on a file (an image to edit, audio to transcribe) is not called without one
  if (!values.url && [cfg.url, cfg.bodyTemplate].some((t) => placeholders(t).includes("url"))) throw new UpstreamError("missing_link: this API works on a file, put its https link in the request");

  const finalUrl = fill(cfg.url, values, "url");
  const templateHost = new URL(cfg.url.replace(/\{\w+\}/g, "x")).host;
  let url: URL;
  try {
    url = await assertPublicUrl(finalUrl);
  } catch (e) {
    throw new UpstreamError(e instanceof UnsafeUpstreamError ? `unsafe_upstream: ${e.message}` : "bad_upstream_url");
  }
  // placeholders may only fill the path/query, never the host
  if (url.host !== templateHost) throw new UpstreamError("unsafe_upstream: placeholder changed the host");

  const headers: Record<string, string> = { accept: "application/json", "user-agent": "Rialto-Gateway/1.0" };
  if (cfg.encryptedHeaders) Object.assign(headers, JSON.parse(decryptSecret(cfg.encryptedHeaders)) as Record<string, string>);

  let body: string | undefined;
  if (cfg.method === "POST") {
    body = fill(cfg.bodyTemplate ?? '{"query":"{query}"}', values, "json");
    headers["content-type"] = "application/json";
  }

  let data = await requestJson(url, { method: cfg.method, headers, body }, cfg.timeoutMs);
  if (cfg.taskMode === "tripo-v2") data = await waitForTripoTask(url, headers, data);
  const payload = cfg.resultPick ? { ...pick(data, cfg.resultPick) } : { data };
  const result = { liveData: true, source: url.host, ...payload };
  if (Buffer.byteLength(JSON.stringify(result)) > MAX_RESULT_BYTES) throw new UpstreamError("result_too_large: set 'fields to return' on your API");
  return result;
}
