import type { Service } from "@/lib/types";
import type { Executor } from "@/lib/agent/run";

/** Calls the mock provider routes over real HTTP so the 402 is a real status code. */
export function createHttpExecutor(baseUrl: string): Executor {
  return {
    async call(service: Service, body: unknown, headers: Record<string, string>) {
      const res = await fetch(`${baseUrl}${service.endpoint}`, {
        method: "POST",
        headers: { "content-type": "application/json", ...headers },
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
