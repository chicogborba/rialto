import { z } from "zod";

/**
 * What an agent's critter wears: one choice per slot, stored as indexes into these lists. Kept free
 * of three.js so the server can validate a look and the dashboard can step through the options.
 * Append to a list, never reorder it: saved looks point at positions.
 */

export const COLORS = [
  { name: "Tangerine", hex: 0xee7a35 },
  { name: "Lime", hex: 0x9fd62b },
  { name: "Teal", hex: 0x26b3a8 },
  { name: "Sky", hex: 0x5aa9e6 },
  { name: "Bubblegum", hex: 0xff8fb3 },
  { name: "Grape", hex: 0x9b7bff },
  { name: "Mustard", hex: 0xf2b630 },
  { name: "Tomato", hex: 0xe5533d },
  { name: "Mint", hex: 0x7ed6a5 },
  { name: "Slate", hex: 0x6c7a89 },
  { name: "Sand", hex: 0xd9b98a },
  { name: "Cocoa", hex: 0x9a6a4a },
] as const;
export const ACCENTS = [
  { name: "Coal", hex: 0x2a2420 },
  { name: "Lime", hex: 0xc6ff3d },
  { name: "Cream", hex: 0xf6efe0 },
  { name: "Red", hex: 0xe5533d },
  { name: "Blue", hex: 0x3f6fd8 },
  { name: "Yellow", hex: 0xffd23f },
  { name: "Pink", hex: 0xff8fb3 },
] as const;
export const BODIES = ["classic", "chunky", "tall", "tiny"] as const;
export const EYES = ["tall", "round", "wide", "sleepy", "googly"] as const;
export const HATS = ["none", "cap", "top hat", "beanie", "crown", "party hat", "cowboy hat", "propeller", "headphones", "antenna"] as const;
export const GLASSES = ["none", "square", "round", "shades", "monocle", "visor", "3D"] as const;
export const EXTRAS = ["none", "blush", "mustache", "bow tie", "scarf", "backpack"] as const;

export interface Look {
  color: (typeof COLORS)[number];
  accent: (typeof ACCENTS)[number];
  body: (typeof BODIES)[number];
  eyes: (typeof EYES)[number];
  hat: (typeof HATS)[number];
  glasses: (typeof GLASSES)[number];
  extra: (typeof EXTRAS)[number];
}

/** The slots in the order the editor shows them, with how many options each has. */
export const SLOTS = [
  { key: "color", label: "Color", size: COLORS.length },
  { key: "body", label: "Body", size: BODIES.length },
  { key: "eyes", label: "Eyes", size: EYES.length },
  { key: "hat", label: "Head", size: HATS.length },
  { key: "glasses", label: "Glasses", size: GLASSES.length },
  { key: "extra", label: "Extra", size: EXTRAS.length },
  { key: "accent", label: "Accent", size: ACCENTS.length },
] as const;
export type SlotKey = (typeof SLOTS)[number]["key"];

const index = (n: number) => z.number().int().min(0).max(n - 1);
export const LookPartsSchema = z.object({
  color: index(COLORS.length),
  accent: index(ACCENTS.length),
  body: index(BODIES.length),
  eyes: index(EYES.length),
  hat: index(HATS.length),
  glasses: index(GLASSES.length),
  extra: index(EXTRAS.length),
});
export type LookParts = z.infer<typeof LookPartsSchema>;

export function lookFromParts(p: LookParts): Look {
  return { color: COLORS[p.color], accent: ACCENTS[p.accent], body: BODIES[p.body], eyes: EYES[p.eyes], hat: HATS[p.hat], glasses: GLASSES[p.glasses], extra: EXTRAS[p.extra] };
}

/** The name of the option a slot is on, for the editor. */
export function optionName(p: LookParts, slot: SlotKey): string {
  const l = lookFromParts(p);
  const v = l[slot];
  const name = typeof v === "string" ? v : v.name;
  return name === "none" ? "None" : name.charAt(0).toUpperCase() + name.slice(1);
}

/** 32-bit FNV-1a, then mulberry32: a small, stable generator per id. */
function rng(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A random look. Hats, glasses and extras are left off often enough that dressed-up critters stand out. */
export function rollParts(random: () => number = Math.random): LookParts {
  const pick = (n: number) => Math.floor(random() * n);
  const sometimes = (n: number, bare: number) => (random() < bare ? 0 : 1 + pick(n - 1));
  const color = pick(COLORS.length);
  return { color, accent: pick(ACCENTS.length), body: random() < 0.4 ? 0 : pick(BODIES.length), eyes: random() < 0.35 ? 0 : pick(EYES.length), hat: sometimes(HATS.length, 0.2), glasses: sometimes(GLASSES.length, 0.35), extra: sometimes(EXTRAS.length, 0.3) };
}

/** The look of an agent that never chose one: rolled from its id, so it is the same everywhere. */
export const partsFor = (seed: string): LookParts => rollParts(rng(seed));

/** A saved look, or the one rolled from the id when there is none (or it no longer parses). */
export function partsOf(saved: string | null | undefined, seed: string): LookParts {
  if (saved) {
    try {
      const p = LookPartsSchema.safeParse(JSON.parse(saved));
      if (p.success) return p.data;
    } catch {
      // fall through to the rolled look
    }
  }
  return partsFor(seed);
}

export const lookKey = (p: LookParts): string => `${p.color}.${p.accent}.${p.body}.${p.eyes}.${p.hat}.${p.glasses}.${p.extra}`;
