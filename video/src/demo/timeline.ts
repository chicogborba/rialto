import play from "../../public/demo/takes/game-rialto.json";
import build from "../../public/demo/takes/term-rialto.json";
import { FPS } from "../timeline";
import { VO } from "../vo";

/**
 * The product demo: a game made twice, then the product itself, recorded from the real site
 * (scripts/record-demo.mjs) and from real Claude Code sessions. Scenes in order, how long each
 * runs, and the frame inside the scene where each narration line starts.
 */
export const DEMO_ORDER = ["hook", "landing", "signup", "agent", "terminal", "result", "activity", "publish", "catalog", "close"] as const;
export type DemoId = (typeof DEMO_ORDER)[number];

// ---- the session in which Claude builds the game with Rialto. Its film is already cut by the
// recorder: real speed up to the request, the work fast-forwarded, real speed for the answer.
const marks = build.marks as Record<string, number>;
const at = (name: string) => Math.round((marks[name] ?? 0) * FPS);
export const BUILD = {
  paste: at("paste"),
  claude: at("claude"),
  ask: at("ask"),
  sent: at("sent"),
  fastFrom: at("fastFrom"),
  fastTo: at("fastTo"),
  /** the frame each purchase on Rialto shows up in the terminal */
  buys: Object.keys(marks)
    .filter((k) => /^buy\d+$/.test(k))
    .sort((x, y) => Number(x.slice(3)) - Number(y.slice(3)))
    .map(at),
  speed: build.speed,
  total: Math.round(build.seconds * FPS),
};
const say = (line: string) => Math.ceil((VO[line]?.seconds ?? 0) * FPS);

// ---- the film of the game built with Rialto: its title screen, a run, a crash. The scene that shows
// it is as long as that takes, plus the narrator's last line over the game-over screen.
const sounds = (play as { sounds?: { t: number; src: string }[] }).sounds ?? [];
const when = (name: string) => Math.round((sounds.find((s) => s.src.startsWith(name))?.t ?? 0) * FPS);
const trim = 20;
/** the frame the announcer has finished saying the game is over */
const over = when("voice_gameover") - trim + 50;
export const SHOW = { trim, total: over + 6 };
const d5c = BUILD.sent + 16;
const d5d = Math.max(BUILD.fastTo - say("d5d") - 20, d5c + say("d5c") + 10);

export const DEMO_DURATIONS: Record<DemoId, number> = {
  hook: 270,
  landing: 575,
  signup: 245,
  agent: 465,
  terminal: Math.min(BUILD.total, Math.max(BUILD.fastTo + 96, d5d + say("d5d") + 30)),
  result: Math.min(Math.round(play.seconds * FPS) - trim, SHOW.total + say("d5f") + 46),
  activity: 262,
  publish: 470,
  catalog: 228,
  close: 160,
};

export const DEMO_CUES: Record<DemoId, Record<string, number>> = {
  hook: { d1a: 12, d1b: 80, d1c: 128 },
  landing: { d2a: 49, d2b: 239, d2c: 446 },
  signup: { d3a: 12 },
  agent: { d4a: 14, d4b: 132, d4c: 316 },
  terminal: { d5a: Math.max(4, BUILD.paste - 20), d5b: BUILD.ask - 14, d5c, d5d },
  result: { d5e: 10, d5f: SHOW.total + 4 },
  activity: { d6a: 16 },
  publish: { d7a: 50, d7b: 284 },
  catalog: { d8a: 14 },
  close: { d9a: 24 },
};

export const DEMO_TOTAL = DEMO_ORDER.reduce((sum, id) => sum + DEMO_DURATIONS[id], 0);
export const demoStart = (scene: DemoId): number => DEMO_ORDER.slice(0, DEMO_ORDER.indexOf(scene)).reduce((sum, id) => sum + DEMO_DURATIONS[id], 0);
/** Frame, inside its scene, at which word number `index` of a narration line is spoken. */
export const demoWord = (scene: DemoId, line: string, index: number): number => DEMO_CUES[scene][line] + Math.round((VO[line]?.words[index]?.start ?? 0) * FPS);
/** [start, end] of every narration line in frames of the whole demo. The music ducks under these. */
export const DEMO_SPEECH: [number, number][] = DEMO_ORDER.flatMap((scene) => Object.entries(DEMO_CUES[scene]).map(([line, at]): [number, number] => [demoStart(scene) + at, demoStart(scene) + at + Math.ceil((VO[line]?.seconds ?? 0) * FPS)]));
