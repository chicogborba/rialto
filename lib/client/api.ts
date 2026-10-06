"use client";

export interface ApiResult<T> {
  ok: boolean;
  status: number;
  data: T | null;
  error: string | null;
}

/** fetch + JSON with a Bearer key. Errors come back as { error: { message } }. */
export async function api<T>(path: string, opts: { key?: string | null; json?: unknown; method?: string } = {}): Promise<ApiResult<T>> {
  try {
    const res = await fetch(path, {
      method: opts.method ?? (opts.json !== undefined ? "POST" : "GET"),
      headers: { ...(opts.json !== undefined ? { "content-type": "application/json" } : {}), ...(opts.key ? { authorization: `Bearer ${opts.key}` } : {}) },
      body: opts.json !== undefined ? JSON.stringify(opts.json) : undefined,
      cache: "no-store",
    });
    const body = (await res.json().catch(() => null)) as (T & { error?: { message?: string } }) | null;
    return { ok: res.ok, status: res.status, data: res.ok ? body : null, error: res.ok ? null : (body?.error?.message ?? `HTTP ${res.status}`) };
  } catch {
    return { ok: false, status: 0, data: null, error: "Network error" };
  }
}
