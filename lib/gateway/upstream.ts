import { decryptSecret } from "@/lib/security/secrets";
import { assertPublicUrl, UnsafeUpstreamError } from "@/lib/security/ssrf";
import { deriveInput, fill, MAX_RESULT_BYTES, MAX_UPSTREAM_BYTES, pick } from "./template";

export interface UpstreamConfig {
  url: string;
  method: string;
  bodyTemplate: string | null;
  /** AES-GCM blob of a JSON object of headers */
  encryptedHeaders: string | null;
  resultPick: string | null;
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

/**
 * Call the seller's real API on behalf of a buyer. Hardened: https + public addresses only (checked
 * again here, after placeholder substitution), no redirects, 8 s timeout, bounded response size,
 * bounded result size. Any throw means "failed" and the buyer is not charged.
 */
export async function callUpstream(cfg: UpstreamConfig, requestBody: unknown): Promise<Record<string, unknown>> {
  const goal = typeof requestBody === "object" && requestBody !== null && "goal" in requestBody && typeof requestBody.goal === "string" ? requestBody.goal : "";
  const values = { ...deriveInput(goal) };

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

  let res: Response;
  try {
    res = await fetch(url, { method: cfg.method, headers, body, redirect: "manual", signal: AbortSignal.timeout(8000), cache: "no-store" });
  } catch (e) {
    throw new UpstreamError(e instanceof Error && e.name === "TimeoutError" ? "upstream_timeout" : "upstream_unreachable");
  }
  if (res.status >= 300 && res.status < 400) throw new UpstreamError("upstream_redirect_blocked");
  if (!res.ok) throw new UpstreamError(`upstream_${res.status}`);

  const text = await readCapped(res, MAX_UPSTREAM_BYTES);
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    data = { text: text.slice(0, 4000) };
  }
  const payload = cfg.resultPick ? { ...pick(data, cfg.resultPick) } : { data };
  const result = { liveData: true, source: url.host, ...payload };
  if (Buffer.byteLength(JSON.stringify(result)) > MAX_RESULT_BYTES) throw new UpstreamError("result_too_large: set 'fields to return' on your API");
  return result;
}
