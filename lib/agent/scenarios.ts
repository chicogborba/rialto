import type { CapabilityId, DagNode, PriorityPreset, ScenarioId } from "@/lib/types";
import { toMicro } from "@/lib/money";

export interface Scenario {
  id: ScenarioId;
  /** any one of these in the goal */
  keywords: string[];
  /** and, when given, every one of these */
  all?: string[];
  dag: DagNode[];
  defaultPreset: PriorityPreset;
  confidenceCap: number;
}

const one = (id: ScenarioId, capability: CapabilityId, keywords: string[], defaultPreset: PriorityPreset = "balanced"): Scenario => ({
  id,
  keywords,
  dag: [{ id: "s1", capability, dependsOn: [] }],
  defaultPreset,
  confidenceCap: 1,
});

/**
 * First matching scenario wins; `generic` is the fallback. The order is from the most specific wording
 * to the least: "remove the background of this image" must not be read as "make an image".
 */
export const SCENARIOS: Scenario[] = [
  one("lookup", "data.lookup", ["pokemon", "pokémon", "pikachu", "pokedex", "pokédex"]),
  // work on a file the request links to
  one("image3d", "model.image_to_3d", ["image to 3d", "image-to-3d", "3d model from this", "3d model from the image", "3d from this image", "3d from the image", "into a 3d model", "into 3d"], "accuracy"),
  one("cutout", "image.background_removal", ["remove the background", "remove background", "background removal", "cut out the", "cutout"]),
  one("upscale", "image.upscale", ["upscale", "upscaling", "increase the resolution", "higher resolution", "enlarge this image", "enlarge the image"]),
  one("transcribe", "audio.transcribe", ["transcribe", "transcription", "transcript", "speech to text", "speech-to-text", "what is said in"]),
  one("describe", "vision.describe", ["describe this image", "describe the image", "what is in this image", "what's in this image", "what is in the image", "caption this", "caption for this", "read the text in"]),
  one("edit", "image.edit", ["edit this image", "edit the image", "edit this photo", "edit the photo", "change this image", "in this image", "in this photo", "in this picture", "to this image", "retouch"]),
  // make something from a description
  {
    id: "speech",
    keywords: ["text to speech", "tts", "voiceover", "narrate", "say this", "speak this", "read aloud", "natural voice"],
    dag: [{ id: "s1", capability: "audio.speech", dependsOn: [] }],
    defaultPreset: "balanced",
    confidenceCap: 1,
  },
  one("sfx", "audio.sfx", ["sound effect", "sound effects", "sfx", "sound of", "horn sound", "crash sound", "engine sound", "explosion sound", "jingle", "ui sound"]),
  one("music", "audio.music", ["music", "soundtrack", "background track", "theme song", "music loop", "chiptune", "song for"]),
  one("video", "video.generate", ["video", "movie clip", "film clip", "animated clip", "cinematic shot", "cinematic clip"]),
  one("model3d", "model.3d", ["3d model", "3d asset", "3d object", "glb", "mesh", "generate a model"], "accuracy"),
  one("vector", "image.vector", ["svg", "vector", "logo", "icon set"]),
  one("sprites", "image.sprites", ["sprite", "pixel art", "pixel-art", "game asset", "spritesheet", "tileset", "seamless tile", "seamless texture", "tileable"], "accuracy"),
  // work on text
  {
    id: "translate",
    keywords: ["translate", "translation"],
    all: ["summar"],
    dag: [
      { id: "s1", capability: "text.translate", dependsOn: [] },
      { id: "s2", capability: "text.summarize", dependsOn: ["s1"] },
    ],
    defaultPreset: "cost",
    confidenceCap: 1,
  },
  one("translate", "text.translate", ["translate", "translation", "to portuguese", "to spanish", "to english", "in portuguese", "in spanish"], "cost"),
  one("summarize", "text.summarize", ["summarize", "summarise", "summary of", "tl;dr"], "cost"),
  one("search", "web.search", ["search the web", "search the internet", "web search", "look it up online", "latest news on", "find online"]),
  // any other request for a picture
  one("image", "image.generate", ["generate an image", "generate a picture", "create an image", "make an image", "image of", "picture of", "photo of", "illustration", "draw ", "render of", "wallpaper", "poster", "concept art", "background image"]),
  // the demo scenarios
  {
    id: "vision",
    keywords: ["damage", "container", "inspect"],
    dag: [{ id: "s1", capability: "vision.damage_detection", dependsOn: [] }],
    defaultPreset: "accuracy",
    confidenceCap: 1,
  },
  {
    id: "research",
    keywords: ["stock", "nvidia", "market data", "market move", "earnings", "dropped", "shares", "why did"],
    dag: [
      { id: "s1", capability: "market.quotes", dependsOn: [] },
      { id: "s2", capability: "news.search", dependsOn: [] },
      { id: "s3", capability: "filings.sec", dependsOn: [] },
      { id: "s4", capability: "web.search", dependsOn: [] },
      { id: "s5", capability: "llm.analysis", dependsOn: ["s1", "s2", "s3", "s4"] },
    ],
    defaultPreset: "balanced",
    confidenceCap: 1,
  },
];

/** The plan when the caller names the capability instead of leaving it to the wording of the goal. */
export function directScenario(capability: CapabilityId): Scenario {
  return one("direct", capability, []);
}

/** What a caller may pin down instead of letting Rialto choose. */
export interface Route {
  capability?: CapabilityId;
  /** only this provider is considered */
  providerId?: string;
}

export const GENERIC_SCENARIO: Scenario = {
  id: "generic",
  keywords: [],
  dag: [
    { id: "s1", capability: "web.search", dependsOn: [] },
    { id: "s2", capability: "llm.analysis", dependsOn: ["s1"] },
  ],
  defaultPreset: "balanced",
  confidenceCap: 0.55,
};

export function matchScenario(goal: string): Scenario {
  const whole = goal.toLowerCase();
  // the instruction decides, not the text it carries: `Translate "a photo of the day"` is not a request for a photo
  const instruction = whole.replace(/"[^"]*"|“[^”]*”/g, " ").replace(/https?:\/\/\S+/g, " ");
  return find(instruction) ?? find(whole) ?? GENERIC_SCENARIO;
}

function find(g: string): Scenario | undefined {
  return SCENARIOS.find((s) => s.keywords.some((k) => g.includes(k)) && (s.all ?? []).every((k) => g.includes(k)));
}

export const GOAL_CHIPS: { label: string; goal: string }[] = [
  { label: "Analyze an image", goal: "Analyze this image and determine whether the container has structural damage." },
  { label: "Research a stock move", goal: "Research why NVIDIA dropped today and produce a sourced explanation." },
  { label: "Translate + summarize", goal: "Translate this document to Portuguese and summarize the important parts." },
  { label: "Make game sprites", goal: "Make a pixel-art sprite sheet for my game's hero: idle, run and jump." },
  { label: "Look up a Pokémon", goal: "Look up the Pokémon pikachu." },
  { label: "Generate a voice", goal: "Say \"Welcome to Rialto\" in a natural voice." },
  { label: "Generate a 3D model", goal: "Generate a 3D model of a low-poly orange delivery van with rounded edges." },
  { label: "Make a sound effect", goal: "Make a sound effect of a car horn honking twice." },
  { label: "Compose music", goal: "Compose an upbeat chiptune music loop for an arcade racing game." },
  { label: "Generate an image", goal: "Generate an image of a cozy low-poly market street at sunset." },
];

/** A request that exercises one capability: what the seller's "Test" button sends. */
export const SAMPLE_GOALS: Record<CapabilityId, string> = {
  "data.lookup": "Look up the Pokémon pikachu.",
  "image.sprites": "Top-down pixel art sprite of a red sports car for a traffic game.",
  "image.generate": "Generate an image of a cozy low-poly market street at sunset.",
  "image.vector": "A minimal SVG logo of a bridge over a canal.",
  "image.edit": "Make the sky pink in this image: https://galleriarialto.com/samples/image.jpg",
  "image.background_removal": "Remove the background of https://galleriarialto.com/samples/image.jpg",
  "image.upscale": "Upscale https://galleriarialto.com/samples/image.jpg",
  "vision.describe": "What is in this image? https://galleriarialto.com/samples/image.jpg",
  "vision.damage_detection": "Analyze this image and determine whether the container has structural damage.",
  "market.quotes": "Quote for NVDA.",
  "news.search": "News about NVIDIA today.",
  "filings.sec": "Latest SEC filings for NVDA.",
  "web.search": "Search the web: what is the x402 payment protocol?",
  "llm.analysis": "In two sentences, why do AI agents need a way to pay?",
  "text.translate": 'Translate to Portuguese: "The market opens at nine."',
  "text.summarize": 'Summarize: "Rialto is a marketplace where AI agents discover, compare and pay for APIs. A failed call costs nothing."',
  "audio.speech": 'Say "Welcome to Rialto" in a natural voice.',
  "audio.sfx": "A sound effect of a car horn honking twice.",
  "audio.music": "An upbeat chiptune music loop for an arcade racing game.",
  "audio.transcribe": "Transcribe https://galleriarialto.com/samples/speech.mp3",
  "video.generate": "A short video of a low-poly orange van driving through a toy city, cinematic.",
  "model.3d": "Generate a 3D model of a low-poly orange delivery van with rounded edges.",
  "model.image_to_3d": "Turn this image into a 3D model: https://galleriarialto.com/samples/image.jpg",
};

export function presetFromGoal(goal: string): PriorityPreset | null {
  const g = goal.toLowerCase();
  if (/accuracy matters|accurate|most accurate/.test(g)) return "accuracy";
  if (/\bcheap|low cost|lowest cost|under \$|below \$/.test(g)) return "cost";
  if (/\bfast\b|\bquick|urgent/.test(g)) return "speed";
  return null;
}

/** "under $0.005" / "below $0.01" → micro-USDC, else null. */
export function budgetFromGoal(goal: string): number | null {
  const m = goal.toLowerCase().match(/(?:under|below|less than|max(?:imum)?)\s*\$\s*(\d+(?:\.\d+)?)/);
  return m ? toMicro(parseFloat(m[1])) : null;
}
