/**
 * Registers a PokéAPI-backed provider through the normal registration endpoint (POST /api/providers).
 * Needs the dev server running. Idempotent. Run: npm run demo:pokeapi
 */
const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

async function main() {
  const list = (await (await fetch(`${base}/api/providers`)).json()) as { providers: { provider: { slug: string; name: string } }[] };
  if (list.providers.some((p) => p.provider.slug === "pokeapibridge")) {
    console.log("PokeAPI Bridge is already registered.");
    return;
  }
  const res = await fetch(`${base}/api/providers`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name: "PokeAPI Bridge",
      description: "Real public data: wraps https://pokeapi.co behind the x402-style 402 flow. Payment simulated, data live.",
      capabilities: ["data.lookup"],
      endpoint: `${base}/api/ext/pokeapi`,
      priceUsd: 0.001,
      latencyMs: 350,
      quality: 90,
      network: "solana-devnet",
      x402Enabled: true,
    }),
  });
  console.log(res.status, await res.text());
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
