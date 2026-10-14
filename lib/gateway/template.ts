/** Turning an agent's goal into a seller's upstream request, and a seller's response into a small result. */

export interface GatewayInput {
  goal: string;
  /** the main noun of the request: quoted text, the word after "of/about/for/named", else the last word */
  query: string;
  /** the first link in the request: the image or audio file an API should work on; "" when there is none */
  url: string;
  /** the request without its links: the instruction that goes with `url` */
  text: string;
}

/** Text between quotation marks can be long (a line to speak, a paragraph to translate). */
const MAX_QUOTED = 2000;
const LINK = /https?:\/\/[^\s"'<>]+/gi;
/** punctuation that ends the sentence a link sits in, not the link */
const trimLink = (link: string) => link.replace(/[.,;:!?)\]]+$/, "");

/**
 * Heuristic extraction. A real LLM planner would build typed input from the service's input schema;
 * until then sellers can use {query}, {goal}, {url} or {text} in their templates.
 */
export function deriveInput(goal: string): GatewayInput {
  const g = goal.trim();
  const url = trimLink(g.match(LINK)?.[0] ?? "");
  const text = g.replace(LINK, (link) => ` ${link.slice(trimLink(link).length)}`).replace(/\(\s*\)/g, " ").replace(/\s+/g, " ").replace(/\s+([.,;:!?])/g, "$1").trim();
  const rest = { goal: g, url, text };
  // double quotes first, so an apostrophe inside them ("don't stop") does not end the phrase
  const quoted =
    g.match(new RegExp(`"([^"]{1,${MAX_QUOTED}})"`)) ??
    g.match(new RegExp(`“([^”]{1,${MAX_QUOTED}})”`)) ??
    g.match(new RegExp(`(?<![\\p{L}\\p{N}])['‘]([^'’]{1,${MAX_QUOTED}})['’](?![\\p{L}\\p{N}])`, "u"));
  if (quoted) return { ...rest, query: quoted[1].trim() };
  const after = text.match(/(?:pok[eé]mon|about|of|for|named|called|on|is)\s+([\p{L}\p{N}][\p{L}\p{N}\-_.]*)/iu);
  if (after) return { ...rest, query: after[1].replace(/[.\-_]+$/, "").toLowerCase() };
  const words = text.replace(/[.?!]+$/, "").split(/\s+/);
  return { ...rest, query: (words[words.length - 1] ?? "").toLowerCase() };
}

/** The placeholders a template uses, e.g. `{"image_url":"{url}"}` → ["url"]. */
export function placeholders(template: string | null | undefined): string[] {
  return [...(template ?? "").matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
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
