import { realClock } from "@/lib/agent/clock";
import { getProviderBySlug } from "@/lib/db/repo";
import { toProvider, toService } from "@/lib/db/mappers";
import { handleSimCall } from "@/lib/providers/sim-provider";
import { getRail } from "@/lib/x402";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

declare global {
  var __pokeFailedOnce: Set<string> | undefined;
}
const failedOnce = (globalThis.__pokeFailedOnce ??= new Set<string>());
const rail = getRail(realClock(0));

/** "Look up the Pokémon pikachu." → "pikachu". Falls back to pikachu. */
function pokemonFrom(body: unknown): string {
  const goal = typeof body === "object" && body !== null && "goal" in body && typeof body.goal === "string" ? body.goal : "";
  const m = goal.match(/(?:pok[eé]mon|about|of|is)\s+([a-z][a-z-]*)/i);
  return (m?.[1] ?? "pikachu").toLowerCase();
}

/**
 * Example of bridging a REAL public API into Switchyard.
 * The payment side is the same simulated 402 protocol as every demo provider; the *work* is a live
 * call to https://pokeapi.co. If PokéAPI fails, nothing is settled.
 */
export async function POST(req: Request): Promise<Response> {
  const row = await getProviderBySlug("pokeapibridge");
  const svcRow = row?.services.find((s) => s.capability === "data.lookup");
  const service = svcRow ? toService(svcRow) : null;
  if (!row || !service) {
    return Response.json({ error: "not_registered", hint: "Run `npm run demo:pokeapi` to register the provider." }, { status: 404 });
  }
  const body: unknown = await req.json().catch(() => ({}));
  const out = await handleSimCall({
    provider: toProvider(row),
    service,
    payTo: row.payTo,
    demoFailFirstCall: false,
    headers: Object.fromEntries(req.headers.entries()),
    body,
    rail,
    failedOnce,
    produce: async (b) => {
      const name = pokemonFrom(b);
      const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${encodeURIComponent(name)}`, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) throw new Error(`pokeapi_${res.status}`);
      const d = (await res.json()) as { name: string; id: number; height: number; weight: number; types: { type: { name: string } }[]; sprites: { front_default: string | null } };
      return {
        liveData: true,
        source: "https://pokeapi.co",
        name: d.name,
        id: d.id,
        types: d.types.map((t) => t.type.name),
        heightDm: d.height,
        weightHg: d.weight,
        sprite: d.sprites.front_default,
      };
    },
  });
  return Response.json(out.json, { status: out.status, headers: out.headers });
}
