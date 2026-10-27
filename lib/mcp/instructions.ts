import { appetite } from "@/lib/agent/appetite";

/**
 * What a connected agent is told about Rialto before it has called anything. The middle part depends
 * on how keen its owner set it to buy (lib/agent/appetite.ts): from "only what you cannot do
 * yourself" to "the best result, whatever it takes". Limits are enforced on every call either way.
 */

const WHAT =
  "Rialto is a marketplace of paid APIs you can call with the wallet your owner funded: image and sprite generation, image editing, background removal, upscaling, vector art, video, 3D models, music, sound effects, voices, transcription, translation, web search and more.";

const GAME_LIST =
  "For a game that usually means: an illustrated title screen; a sprite for the player and for every kind of obstacle or enemy, a few variants each; scenery for what lies beside or behind the play field as well as the ground itself; pickups; an explosion or hit effect; a soundtrack that loops; sound effects for the start, a hit, a pickup, a near miss and the game over; and a voice for the announcer. For a site or an app: a hero image, illustrations for each section, icons as vectors. Design the thing around what you can buy, rather than buying skins for what you would have drawn anyway.";

const HOW =
  "How: call discover_services with no arguments to see every capability and its price range, and with a capability to compare its providers: the descriptions say what each one is best at (transparent backgrounds, seamless tiles, loops, the cheapest, the best). Then call execute_service with a `capability` and a `goal` that is the full prompt for the provider (add `provider` to choose one, `preset` cost|speed|accuracy to steer the choice, `budgetUsd` for expensive items). Text to speak or translate goes in double quotes inside the goal; a file the provider should work on goes in the goal as its https link (that is how you remove the background of an image you just bought, or upscale it).";

const AFTER =
  "Results that are files come back as https links: download them into the project (curl -o) before using them, the links expire. Look at an image you bought before you build on it, and buy it again with a better prompt if it is not what you asked for. Independent purchases can be made in parallel. A failed call costs nothing. get_wallet_status shows what is left to spend.";

const STANCE: Record<number, string[]> = {
  1: [
    "Your owner set you to Frugal. Use Rialto only for what you cannot do yourself at all: real images, audio, video or 3D files, and live data you cannot reach. Do not buy anything you can write, reason out or draw in code. Buy one of each thing, never variants, and prefer the cheapest provider (preset cost).",
  ],
  2: [
    "Your owner set you to Careful. Use Rialto when a bought asset or answer is clearly better than what you can make yourself and the task calls for it: real art instead of placeholder shapes, real sound instead of silence. Keep purchases few and targeted, and lean to cheaper providers (preset cost) unless quality clearly matters.",
  ],
  3: [
    "When a task needs something you would otherwise fake, draw with code or leave as a placeholder, buy it here instead. A game, an app or a site is judged by what people see and hear, so be generous: art for every object (with a transparent background when it sits on top of something), a background or a seamless texture for the ground, a soundtrack that loops, a sound effect for each main event, a voice line or two, a title image. Your owner connected you to Rialto so that the result is finished, not so that you save cents.",
    GAME_LIST,
  ],
  4: [
    "Your owner set you to Eager: reach for Rialto first. Whenever something can be bought that would make the result look, sound or read better, buy it rather than making do: art for every object, several variants of the important ones so you can pick the best, backgrounds, textures, music, sound effects and voices. Prefer the better providers (preset accuracy) over the cheapest.",
    GAME_LIST,
  ],
  5: [
    "Your owner set you to All-in: they want the best possible result and are happy to spend for it. Use Rialto for everything it can do better than you. Buy several variants and keep the best, upscale and clean up what you keep, add music, sound effects and voice everywhere they fit, and buy again whenever a result is not excellent. Always prefer the best providers (preset accuracy). Stay within the limits your owner set; they are enforced on every call.",
    GAME_LIST,
  ],
};

export function instructionsFor(level: number | null | undefined): string {
  return [WHAT, ...STANCE[appetite(level).level], HOW, AFTER].join("\n");
}
