import { INTERNAL_HEADER, internalToken } from "@/lib/security/internal";
import { assertPublicUrl } from "@/lib/security/ssrf";
import type { Service } from "@/lib/types";
import type { Executor } from "@/lib/agent/run";

/** Calls the mock provider routes over real HTTP so the 402 is a real status code. */
export function createHttpExecutor(baseUrl: string): Executor {
  return {
    async call(service: Service, body: unknown, headers: Record<string, string>) {
      const absolute = /^https?:\/\//.test(service.endpoint);
      // never send the internal token off-platform; never fetch a non-public absolute endpoint
      if (absolute) {
        const safe = await assertPublicUrl(service.endpoint).then(() => true, () => false);
        // a bad endpoint is a failed provider (the agent falls back), not a crashed run
        if (!safe) return { status: 400, json: { error: "unsafe_endpoint" }, headers: {} };
      }
      const res = await fetch(absolute ? service.endpoint : `${baseUrl}${service.endpoint}`, {
        method: "POST",
        headers: { "content-type": "application/json", ...(absolute ? {} : { [INTERNAL_HEADER]: internalToken() }), ...headers },
        body: JSON.stringify(body),
        cache: "no-store",
      });
      let json: unknown = null;
      try {
        json = await res.json();
      } catch {
        json = null;
      }
      const out: Record<string, string> = {};
      res.headers.forEach((v, k) => {
        out[k] = v;
      });
      return { status: res.status, json, headers: out };
    },
  };
}
