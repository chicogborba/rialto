/** Turning an agent's goal into a seller's upstream request, and a seller's response into a small result. */

export interface GatewayInput {
  goal: string;
  /** the main noun of the request: quoted text, the word after "of/about/for/named", else the last word */
  query: string;
}

/**
 * Heuristic extraction. A real LLM planner would build typed input from the service's input schema;
 * until then sellers can use {query} or {goal} in their templates.
 */
export function deriveInput(goal: string): GatewayInput {
  const g = goal.trim();
  const quoted = g.match(/["“'‘]([^"”'’]{1,80})["”'’]/);
  if (quoted) return { goal: g, query: quoted[1].trim() };
  const after = g.match(/(?:pok[eé]mon|about|of|for|named|called|on|is)\s+([\p{L}\p{N}][\p{L}\p{N}\-_.]*)/iu);
  if (after) return { goal: g, query: after[1].replace(/[.\-_]+$/, "").toLowerCase() };
  const words = g.replace(/[.?!]+$/, "").split(/\s+/);
  return { goal: g, query: (words[words.length - 1] ?? "").toLowerCase() };
}

/** Replace {name} placeholders. URL mode percent-encodes; JSON mode JSON-escapes (without the quotes). */
export function fill(template: string, values: Record<string, string>, mode: "url" | "json" | "text" = "text"): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => {
    const v = values[k] ?? "";
    if (mode === "url") return encodeURIComponent(v);
    if (mode === "json") return JSON.stringify(v).slice(1, -1);
    return v;
  });
}

function walk(value: unknown, parts: string[]): unknown[] {
  if (parts.length === 0) return [value];
  const [head, ...rest] = parts;
  if (head === "*") return Array.isArray(value) ? value.flatMap((v) => walk(v, rest)) : [];
  if (Array.isArray(value)) {
    const i = Number(head);
    return Number.isInteger(i) ? walk(value[i], rest) : [];
  }
  if (value !== null && typeof value === "object" && head in value) return walk((value as Record<string, unknown>)[head], rest);
  return [];
}

/**
 * Pick fields from a JSON response. Spec: comma-separated `outName=path.to.field`, `*` iterates arrays.
 * Example: "name,id,sprite=sprites.front_default,types=types.*.type.name"
 * Without `=`, the last path segment is the output name.
 */
export function pick(data: unknown, spec: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const raw of spec.split(",").map((s) => s.trim()).filter(Boolean)) {
    const [name, path] = raw.includes("=") ? (raw.split("=", 2) as [string, string]) : [raw.split(".").pop() ?? raw, raw];
    const found = walk(data, path.split("."));
    if (found.length === 0) continue;
    out[name] = path.includes("*") ? found : found[0];
  }
  return out;
}

/** Hard cap on what a single call may return to the agent. */
export const MAX_RESULT_BYTES = 64 * 1024;
export const MAX_UPSTREAM_BYTES = 1024 * 1024;
