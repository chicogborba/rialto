// Generates the narration with ElevenLabs, one clip per line, plus word timings.
//
//   ELEVENLABS_API_KEY=... node scripts/voiceover.mjs            only lines that are missing
//   ... node scripts/voiceover.mjs 3b 5c                        re-record these lines
//   VOICE_ID=... node scripts/voiceover.mjs --all               re-record everything with another voice
//
// Put the key in video/.env (git-ignored) and run with `npm run voiceover`. Each character costs one
// credit, so lines that already exist are skipped unless you name them.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const outDir = path.join(root, "public/voiceover");
const manifestPath = path.join(root, "src/voiceover.json");

const VOICE_ID = process.env.VOICE_ID ?? "TX3LPaxmHKxFdv7VOQHJ"; // Liam: energetic, confident
const MODEL_ID = "eleven_multilingual_v2";

/** id = scene number + letter. The same text is shown as the caption. */
export const LINES = [
  ["1a", "Your AI agent is smart."],
  ["1b", "But it builds everything from scratch."],
  ["1c", "Slow. And expensive."],
  ["2a", "Companies solved this ages ago."],
  ["2b", "Don't build it. Hire the specialist."],
  ["3a", "But your agent can't hire."],
  ["3b", "Every API wants a sign-up, a credit card, another key."],
  ["3c", "So it comes back to bug you."],
  ["4a", "Meet Rialto."],
  ["4b", "The phone book for AI agents. Wallet included."],
  ["5a", "Your agent finds the right service,"],
  ["5b", "compares price, speed and reputation,"],
  ["5c", "and pays per call, right inside the request."],
  ["5d", "No sign-up. No card. Just the result."],
  ["6a", "A cheaper, faster agent, that does better work."],
  ["6b", "One key. One wallet. Your spending limit."],
  ["7a", "Got an API? Publish it."],
  ["7b", "And get paid on every call."],
  ["8a", "Rialto. Agents that hire."],
];

const key = process.env.ELEVENLABS_API_KEY;
if (!key) {
  console.error("Set ELEVENLABS_API_KEY (see video/README.md).");
  process.exit(1);
}
const args = process.argv.slice(2);
const all = args.includes("--all");
const wanted = new Set(args.filter((a) => !a.startsWith("--")));

mkdirSync(outDir, { recursive: true });
const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, "utf8")) : {};

/** Collapse character timings into words. */
function words(alignment) {
  const out = [];
  let word = "";
  let start = 0;
  alignment.characters.forEach((ch, i) => {
    if (ch.trim() === "") {
      if (word) out.push({ word, start, end: alignment.character_end_times_seconds[i - 1] });
      word = "";
      return;
    }
    if (!word) start = alignment.character_start_times_seconds[i];
    word += ch;
  });
  if (word) out.push({ word, start, end: alignment.character_end_times_seconds.at(-1) });
  return out;
}

let spent = 0;
for (const [i, [id, text]] of LINES.entries()) {
  const file = path.join(outDir, `${id}.mp3`);
  if (!all && !wanted.has(id) && existsSync(file) && manifest[id]?.text === text) continue;

  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}/with-timestamps?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({
      text,
      model_id: MODEL_ID,
      // neighbouring lines keep the delivery consistent from clip to clip
      previous_text: LINES[i - 1]?.[1],
      next_text: LINES[i + 1]?.[1],
      seed: 7,
      voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.35, use_speaker_boost: true },
    }),
  });
  if (!res.ok) {
    console.error(`${id}: HTTP ${res.status} ${await res.text()}`);
    process.exit(1);
  }
  const data = await res.json();
  writeFileSync(file, Buffer.from(data.audio_base64, "base64"));
  const timed = words(data.alignment);
  manifest[id] = { text, seconds: Number(timed.at(-1).end.toFixed(3)), words: timed.map((w) => ({ ...w, start: Number(w.start.toFixed(3)), end: Number(w.end.toFixed(3)) })) };
  spent += text.length;
  console.log(`${id}  ${manifest[id].seconds.toFixed(2)}s  ${text}`);
}

const ordered = Object.fromEntries(LINES.map(([id]) => [id, manifest[id]]).filter(([, v]) => v));
writeFileSync(manifestPath, `${JSON.stringify(ordered, null, 2)}\n`);
console.log(spent ? `Done. About ${spent} credits used.` : "Nothing to do: every line is already recorded.");
