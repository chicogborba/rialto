import type { CapabilityId } from "@/lib/types";

/** Deterministic canned outputs for the fictional providers. Always flagged simulatedOutput. */

interface MockBody {
  goal?: string;
  stepId?: string;
  inputs?: Record<string, unknown>;
}

function isMockBody(v: unknown): v is MockBody {
  return typeof v === "object" && v !== null;
}

function citeInputs(inputs: Record<string, unknown> | undefined): string {
  const ids = inputs ? Object.keys(inputs) : [];
  if (ids.length === 0) return "";
  return ` Sources: ${ids.map((id) => `[${id}]`).join(" ")}.`;
}

export function buildMockResult(capability: CapabilityId, provider: string, body: unknown): Record<string, unknown> {
  const b: MockBody = isMockBody(body) ? body : {};
  const base = { simulatedOutput: true as const, provider };

  switch (capability) {
    case "image.sprites":
      return {
        ...base,
        sheetUrl: "https://assets.example.com/sprites/hero-sheet.png",
        frameSize: [32, 32],
        frames: [
          { name: "idle", count: 4 },
          { name: "run", count: 8 },
          { name: "jump", count: 6 },
        ],
        palette: ["#d97757", "#1a120e", "#f2a08a", "#c6ff3d"],
        note: "18 frames, consistent silhouette across poses, transparent background.",
      };
    case "vision.damage_detection":
      return {
        ...base,
        damageDetected: true,
        findings: [
          { location: "Left side panel, rows 3–4", severity: "high", type: "buckling / dent", confidence: 0.97 },
          { location: "Top rail, near corner casting", severity: "medium", type: "corrosion + hairline crack", confidence: 0.91 },
        ],
        recommendation: "Structural damage confirmed. Remove container from service and schedule a Class A inspection before reload.",
      };
    case "market.quotes":
      return { ...base, symbol: "NVDA", price: 118.42, changePct: -3.84, volume: 412_800_000, previousClose: 123.15 };
    case "news.search":
      return {
        ...base,
        headlines: [
          { title: "Chip stocks slide as export-curb chatter returns", source: "https://news.example.com/chips-slide", sentiment: "negative" },
          { title: "Analysts trim NVIDIA targets on hyperscaler capex worries", source: "https://news.example.com/targets-trimmed", sentiment: "negative" },
          { title: "NVIDIA supplier flags softer Q4 shipment outlook", source: "https://news.example.com/supplier-outlook", sentiment: "negative" },
        ],
      };
    case "filings.sec":
      return {
        ...base,
        filings: [
          { form: "8-K", filed: "2026-10-05", summary: "Disclosure of updated export licence requirements for data-centre accelerators; no guidance change." },
          { form: "10-Q", filed: "2026-08-27", summary: "Data-centre revenue +94% YoY; gross margin 74.6%; customer concentration risk noted." },
        ],
      };
    case "web.search":
      return {
        ...base,
        results: [
          { title: "Why semiconductor stocks fell today", url: "https://research.example.com/semis-fall", snippet: "Rotation out of AI hardware following supply-chain commentary." },
          { title: "NVDA options flow: heavy put buying", url: "https://research.example.com/nvda-options", snippet: "Put volume 2.3× the 30-day average." },
          { title: "Export policy timeline for AI accelerators", url: "https://research.example.com/export-timeline", snippet: "Regulators signalled a review of licence thresholds." },
        ],
      };
    case "llm.analysis":
      return {
        ...base,
        analysis:
          "NVIDIA fell ~3.8% on a convergence of three drivers: (1) renewed export-licence uncertainty disclosed in an 8-K, (2) analyst target cuts tied to hyperscaler capex concerns, and (3) heavy put buying amplifying the move. Fundamentals in the latest 10-Q remain strong; the move reads as sentiment-driven rather than a change in earnings power." +
          citeInputs(b.inputs),
        citations: b.inputs ? Object.keys(b.inputs) : [],
      };
    case "text.translate":
      return {
        ...base,
        translation:
          "Este documento descreve o processo de inspeção de contêineres, incluindo critérios de dano estrutural, responsabilidades das partes e prazos de notificação. Contêineres com danos estruturais confirmados devem ser retirados de serviço imediatamente.",
      };
    case "text.summarize":
      return {
        ...base,
        summary: [
          "O contêiner deve ser inspecionado antes de cada carregamento.",
          "Danos estruturais confirmados exigem retirada imediata de serviço.",
          "A notificação às partes envolvidas deve ocorrer em até 24 horas.",
        ],
      };
  }
}
