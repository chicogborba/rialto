import { VO } from "./vo";

export const FPS = 30;

/**
 * The edit: scenes in order, how long each runs, and the frame (inside the scene) where each
 * narration line starts. Captions, sound cues and music ducking are all derived from this.
 */
export const ORDER = ["hook", "buildOrHire", "wall", "reveal", "how", "result", "sellers", "cta"] as const;
export type SceneId = (typeof ORDER)[number];

export const DURATIONS: Record<SceneId, number> = {
  hook: 236,
  buildOrHire: 212,
  wall: 270,
  reveal: 190,
  how: 450,
  result: 258,
  sellers: 180,
  cta: 180,
};

export const CUES: Record<SceneId, Record<string, number>> = {
  hook: { "1a": 6, "1b": 70, "1c": 156 },
  buildOrHire: { "2a": 8, "2b": 84 },
  wall: { "3a": 6, "3b": 80, "3c": 196 },
  reveal: { "4a": 14, "4b": 62 },
  how: { "5a": 14, "5b": 116, "5c": 232, "5d": 340 },
  result: { "6a": 8, "6b": 112 },
  sellers: { "7a": 8, "7b": 84 },
  cta: { "8a": 10 },
};

export const TOTAL = ORDER.reduce((sum, id) => sum + DURATIONS[id], 0);
export const startOf = (scene: SceneId): number => ORDER.slice(0, ORDER.indexOf(scene)).reduce((sum, id) => sum + DURATIONS[id], 0);

/** Frame, inside its scene, at which word number `index` of a narration line is spoken. */
export const wordAt = (scene: SceneId, line: string, index: number): number => CUES[scene][line] + Math.round((VO[line]?.words[index]?.start ?? 0) * FPS);

/** [start, end] of every narration line in frames of the whole video. The music ducks under these. */
export const SPEECH: [number, number][] = ORDER.flatMap((scene) =>
  Object.entries(CUES[scene]).map(([line, at]): [number, number] => [startOf(scene) + at, startOf(scene) + at + Math.ceil((VO[line]?.seconds ?? 0) * FPS)]),
);
