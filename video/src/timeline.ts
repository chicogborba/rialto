import { VO } from "./vo";

export const FPS = 30;

/**
 * The edit: scenes in order, how long each runs, and the frame (inside the scene) where each
 * narration line starts. Captions, sound cues and music ducking are all derived from this.
 *
 * The video opens and closes on recorded footage ("cold" and "outro"); everything between is animated.
 */
export const ORDER = ["cold", "boot", "hook", "buildOrHire", "wall", "reveal", "how", "setup", "sellers", "solana", "market", "team", "vision", "outro"] as const;
export type SceneId = (typeof ORDER)[number];

/** Two minutes in all. Where an older scene now ends before its last line, that line is simply never reached. */
export const DURATIONS: Record<SceneId, number> = {
  cold: 351,
  boot: 80,
  hook: 156,
  buildOrHire: 196,
  wall: 196,
  reveal: 190,
  how: 330,
  setup: 200,
  sellers: 156,
  solana: 244,
  market: 494,
  team: 380,
  vision: 318,
  outro: 256,
};

export const CUES: Record<SceneId, Record<string, number>> = {
  cold: {},
  boot: { "0a": 18 },
  hook: { "1a": 6, "1b": 70, "1c": 156 },
  buildOrHire: { "2a": 8, "2b": 84 },
  wall: { "3a": 6, "3b": 80, "3c": 196 },
  reveal: { "4a": 14, "4b": 62 },
  how: { "5a": 14, "5b": 116, "5c": 232, "5d": 340 },
  setup: { "6c": 10 },
  sellers: { "7a": 8, "7b": 84 },
  solana: { "10e": 6 },
  market: { "12d": 8, "12b": 378 },
  team: { "13a": 8, "13f": 190, "13g": 264 },
  vision: { "14d": 8, "14a": 148 },
  outro: { "8a": 132 },
};

export const TOTAL = ORDER.reduce((sum, id) => sum + DURATIONS[id], 0);
export const startOf = (scene: SceneId): number => ORDER.slice(0, ORDER.indexOf(scene)).reduce((sum, id) => sum + DURATIONS[id], 0);

/** Frame, inside its scene, at which word number `index` of a narration line is spoken. */
export const wordAt = (scene: SceneId, line: string, index: number): number => CUES[scene][line] + Math.round((VO[line]?.words[index]?.start ?? 0) * FPS);

/** [start, end] of every narration line in frames of the whole video. The music ducks under these. */
export const SPEECH: [number, number][] = ORDER.flatMap((scene) =>
  Object.entries(CUES[scene])
    .filter(([, at]) => at < DURATIONS[scene])
    .map(([line, at]): [number, number] => [startOf(scene) + at, startOf(scene) + at + Math.ceil((VO[line]?.seconds ?? 0) * FPS)]),
);
