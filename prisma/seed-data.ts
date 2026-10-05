import { toMicro } from "../lib/money";
import type { CapabilityId, Provider, Service } from "../lib/types";

/** Single source of truth for demo providers. All fictional. */

export interface SeedService extends Service {
  demoFailFirstCall: boolean;
}
export interface SeedProvider extends Provider {
  payTo: string;
}

interface Row {
  name: string;
  description: string;
  capability: CapabilityId;
  price: number; // dollars
  quality: number;
  latency: number;
  rep: number;
  success: number;
  requests: number;
  status?: Provider["status"];
  failFirst?: boolean;
  extra?: { capability: CapabilityId; price: number; match: number }[];
}

const ROWS: Row[] = [
  { name: "VisionMax", description: "Highest-accuracy structural damage detection. Premium pricing.", capability: "vision.damage_detection", price: 0.012, quality: 98.4, latency: 160, rep: 99.1, success: 99.82, requests: 1_294_821 },
  { name: "BalancedVision", description: "Good accuracy at a mid-market price.", capability: "vision.damage_detection", price: 0.004, quality: 91.0, latency: 80, rep: 94.2, success: 99.1, requests: 842_117 },
  { name: "FastVision", description: "Lowest latency and price. Lower benchmark accuracy.", capability: "vision.damage_detection", price: 0.002, quality: 83.0, latency: 60, rep: 88.7, success: 97.4, requests: 2_105_390 },
  { name: "DeepInspect", description: "Forensic-grade inspection. Slow and expensive.", capability: "vision.damage_detection", price: 0.065, quality: 99.0, latency: 900, rep: 97.0, success: 99.5, requests: 48_210 },
  { name: "OpticNode", description: "Community vision node. Currently down for maintenance.", capability: "vision.damage_detection", price: 0.003, quality: 90.0, latency: 95, rep: 91.5, success: 98.6, requests: 310_455, status: "offline" },
  { name: "AlphaData", description: "Institutional-grade market quotes.", capability: "market.quotes", price: 0.006, quality: 96.0, latency: 140, rep: 97.8, success: 99.7, requests: 3_410_902 },
  { name: "MarketPulse", description: "Fast, cheap delayed quotes.", capability: "market.quotes", price: 0.003, quality: 90.0, latency: 70, rep: 93.5, success: 99.2, requests: 5_220_118 },
  { name: "QuantFeed", description: "Tick-level quotes with full depth.", capability: "market.quotes", price: 0.009, quality: 97.5, latency: 220, rep: 98.4, success: 99.6, requests: 918_733 },
  { name: "NewsWire", description: "Curated financial newswire search.", capability: "news.search", price: 0.005, quality: 94.0, latency: 310, rep: 96.1, success: 99.4, requests: 1_877_240 },
  { name: "HeadlineHub", description: "Broad headline aggregation. Cheap.", capability: "news.search", price: 0.002, quality: 86.0, latency: 180, rep: 90.3, success: 98.5, requests: 2_640_019 },
  { name: "EdgarLens", description: "Parsed SEC filings with structured fields.", capability: "filings.sec", price: 0.008, quality: 97.0, latency: 420, rep: 97.2, success: 99.5, requests: 402_876 },
  { name: "FilingsFast", description: "Quick filing index and summaries.", capability: "filings.sec", price: 0.004, quality: 88.0, latency: 260, rep: 91.0, success: 98.8, requests: 655_301 },
  { name: "DeepSearch", description: "Deep web research with source ranking.", capability: "web.search", price: 0.007, quality: 96.0, latency: 480, rep: 97.5, success: 99.6, requests: 4_102_556 },
  { name: "WebProbe", description: "Cheap, fast web search.", capability: "web.search", price: 0.002, quality: 85.0, latency: 150, rep: 90.9, success: 98.7, requests: 7_950_442 },
  { name: "ResearchX", description: "Balanced research search with citations.", capability: "web.search", price: 0.004, quality: 92.0, latency: 300, rep: 95.0, success: 99.3, requests: 1_230_987 },
  { name: "ReasonCore", description: "Frontier analysis model. Slow, thorough.", capability: "llm.analysis", price: 0.018, quality: 97.0, latency: 1400, rep: 98.0, success: 99.7, requests: 980_114 },
  { name: "SynthLite", description: "Lightweight analysis and summarisation model.", capability: "llm.analysis", price: 0.006, quality: 89.0, latency: 600, rep: 93.2, success: 99.1, requests: 2_304_771, extra: [{ capability: "text.summarize", price: 0.004, match: 0.9 }] },
  { name: "LinguaFlash", description: "Fast, cheap translation. Flaky on cold start.", capability: "text.translate", price: 0.003, quality: 93.0, latency: 200, rep: 94.8, success: 99.0, requests: 1_560_223, failFirst: true },
  { name: "PolyglotPro", description: "Premium translation with terminology control.", capability: "text.translate", price: 0.006, quality: 97.0, latency: 350, rep: 98.2, success: 99.8, requests: 720_640 },
  { name: "BriefAI", description: "Purpose-built document summariser.", capability: "text.summarize", price: 0.003, quality: 91.0, latency: 500, rep: 94.0, success: 99.2, requests: 1_118_905 },
];

export const SCHEMAS: Record<CapabilityId, { input: string; output: string }> = {
  "vision.damage_detection": {
    input: '{"imageUrl":"string","assetType":"string?"}',
    output: '{"damageDetected":"boolean","findings":"Finding[]","recommendation":"string"}',
  },
  "market.quotes": { input: '{"symbol":"string"}', output: '{"symbol":"string","price":"number","changePct":"number","volume":"number"}' },
  "news.search": { input: '{"query":"string","sinceHours":"number?"}', output: '{"headlines":"Headline[]"}' },
  "filings.sec": { input: '{"ticker":"string","form":"string?"}', output: '{"filings":"Filing[]"}' },
  "web.search": { input: '{"query":"string"}', output: '{"results":"Hit[]"}' },
  "llm.analysis": { input: '{"question":"string","context":"object"}', output: '{"analysis":"string","citations":"string[]"}' },
  "text.translate": { input: '{"text":"string","target":"string"}', output: '{"translation":"string"}' },
  "text.summarize": { input: '{"text":"string","bullets":"number?"}', output: '{"summary":"string[]"}' },
};

export function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export function serviceId(providerSlug: string, capability: CapabilityId): string {
  return `svc_${providerSlug}_${capability.replace(/\./g, "_")}`;
}

export function endpointFor(providerSlug: string, capability: CapabilityId): string {
  return `/api/x/${providerSlug}/${capability}`;
}

export const SEED_PROVIDERS: SeedProvider[] = ROWS.map((r) => {
  const slug = slugify(r.name);
  return {
    id: `prov_${slug}`,
    slug,
    name: r.name,
    description: r.description,
    network: "solana-devnet",
    x402Enabled: true,
    status: r.status ?? "online",
    qualityScore: r.quality,
    reputationScore: r.rep,
    successRate: r.success,
    latencyMs: r.latency,
    requestCount: r.requests,
    isDemo: true,
    payTo: `DEMO${slug}`.padEnd(44, "1"),
  };
});

export const SEED_SERVICES: SeedService[] = ROWS.flatMap((r) => {
  const slug = slugify(r.name);
  const make = (capability: CapabilityId, price: number, match: number, failFirst: boolean): SeedService => ({
    id: serviceId(slug, capability),
    providerId: `prov_${slug}`,
    capability,
    endpoint: endpointFor(slug, capability),
    priceMicro: toMicro(price),
    capabilityMatch: match,
    inputSchema: SCHEMAS[capability].input,
    outputSchema: SCHEMAS[capability].output,
    demoFailFirstCall: failFirst,
  });
  return [
    make(r.capability, r.price, 1, r.failFirst ?? false),
    ...(r.extra ?? []).map((e) => make(e.capability, e.price, e.match, false)),
  ];
});

export const DEFAULT_AGENT_BALANCE_MICRO = 10_000_000;
