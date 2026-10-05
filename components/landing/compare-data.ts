/**
 * Single source for the SOLO vs HIRED comparison on the landing page.
 * Measured values are marked (measured); everything else is an estimate and labelled as such in the UI.
 */

const OPUS_OUTPUT_USD_PER_MTOK = 20; // Claude Opus 5.5 output price
const CHARS_PER_TOKEN = 3.5; // rough average for code / numeric text

const tokens = (chars: number) => Math.ceil(chars / CHARS_PER_TOKEN);
const usd = (tok: number) => (tok * OPUS_OUTPUT_USD_PER_MTOK) / 1_000_000;

/** Left: three.js code written by Claude Opus 5.5 in one pass (components/landing/scene/soloRobot.ts). */
const SOLO_CODE_CHARS = 4170; // (measured) wc -c soloRobot.ts
export const SOLO = {
  model: "Claude Opus 5.5",
  triangles: 7_492, // (measured) sum of generated primitive geometry
  textured: false,
  outputTokens: tokens(SOLO_CODE_CHARS),
  /** output tokens only — excludes thinking and input, so it is a lower bound */
  costUsd: usd(tokens(SOLO_CODE_CHARS)),
};

/** Right: Meshy-7 output from the 3D Arena benchmark, simplified for the web (see public/models/CREDITS.md). */
export const HIRED = {
  model: "Meshy-7",
  triangles: 58_326, // (measured) after simplification
  vertices: 45_072, // (measured)
  originalTriangles: 1_944_440, // (measured) as generated
  textured: true,
  credits: 30, // 20 mesh + 10 texture, per Meshy API pricing docs
  /** 30 credits at the Pro-plan rate of $20 / 1,000 credits (reported) */
  costUsd: 0.6,
  url: "/models/robot-meshy7.glb",
};

/**
 * What it would cost for a language model to emit the HIRED mesh as text (OBJ-style):
 * ~44 chars per vertex (position + uv) and ~30 chars per face. Geometry only — no texture.
 */
const MATCH_CHARS = HIRED.vertices * 44 + HIRED.triangles * 30;
export const MATCH = {
  outputTokens: tokens(MATCH_CHARS),
  costUsd: usd(tokens(MATCH_CHARS)),
  /** responses needed at the 128K output-token cap */
  calls: Math.ceil(tokens(MATCH_CHARS) / 128_000),
};

export const fmtUsd = (n: number) => (n < 1 ? `$${n.toFixed(2)}` : `$${Math.round(n)}`);
export const fmtK = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1)}K` : String(n));

// ---------- image example ----------

const SOLO_SVG_CHARS = 4336; // (measured) wc -c public/img/robot-opus.svg
export const IMAGE_SOLO = {
  model: "Claude Opus 5.5",
  kind: "Hand-written SVG",
  url: "/img/robot-opus.svg",
  outputTokens: tokens(SOLO_SVG_CHARS),
  costUsd: usd(tokens(SOLO_SVG_CHARS)),
};
export const IMAGE_HIRED = {
  model: "SDXL-class image API",
  kind: "DreamShaper XL",
  url: "/img/robot-sdxl.jpg",
  /** Stability AI lists SDXL 1.0 at 0.9 credits, $0.01 per credit */
  costUsd: 0.009,
};
export const fmtCents = (n: number) => (n < 0.1 ? `$${n.toFixed(3).replace(/0$/, "")}` : fmtUsd(n));
