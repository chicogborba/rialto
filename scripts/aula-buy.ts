// Buys the assets of the "Sistema Nervoso" lesson video from Rialto, with the buyer's own wallet:
// the narration, a 3D brain, stickers, a paper texture, music and a few sound effects.
//
//   npx tsx scripts/aula-buy.ts            (from the repo root, with RIALTO_KEY and SOLANA_WALLET_KEY in .env)
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createBuyer, walletSecretFromEnv } from "../lib/client/buyer";

const envFile = path.resolve(import.meta.dirname, "../.env");
if (existsSync(envFile)) process.loadEnvFile(envFile);
const out = path.resolve(import.meta.dirname, "../video/public/aula");
mkdirSync(path.join(out, "stickers"), { recursive: true });
mkdirSync(path.join(out, "sfx"), { recursive: true });

const NARRATION =
  "Todo o seu sistema nervoso faz só três coisas. Pergunta. Elabora. E responde. " +
  "A pergunta é o sistema sensitivo. Receptores na pele, nos músculos e nas articulações transformam calor, pressão e dor em impulsos elétricos. Quanto mais forte o estímulo, mais rápido o neurônio dispara. " +
  "Dois caminhos levam a informação ao cérebro. A coluna dorsal é a via rápida: tato fino, vibração e posição. A via ântero-lateral é mais lenta: dor, temperatura e tato grosseiro. Os dois passam pelo tálamo e chegam ao córtex, onde cada parte do corpo tem o seu espaço: o homúnculo de Penfield. " +
  "A dor tem duas velocidades. As fibras A-delta, finas e rápidas, avisam na hora. As fibras C, lentas, deixam aquela dor que demora a passar. " +
  "A elaboração acontece no sistema integrador. O córtex percebe e planeja. O tronco cerebral cuida do coração, da respiração e de manter você acordado. Os núcleos da base e o cerebelo ajudam a programar o movimento. " +
  "Aqui também nasce a memória. O que é curto prazo vira longo prazo quando é revisado. E quanto mais um circuito é usado, mais ele muda de estrutura. " +
  "A resposta é o sistema motor. A via piramidal comanda o movimento voluntário: um milhão de fibras por pirâmide, e a maioria cruza para o lado oposto. Os fusos musculares avisam o quanto o músculo está esticado. " +
  "No reflexo, os três se juntam num arco só: sentiu, a medula respondeu, o músculo retirou a mão. Sensibilidade e movimento, indissolúveis. Pergunta. Elaboração. Resposta.";

/** The narration cut at sentence ends into pieces of at most ~150 characters (about ten seconds of speech). */
const VOICE_PIECES: string[] = (() => {
  const sentences = NARRATION.match(/[^.?!]+[.?!]+/g)?.map((t) => t.trim()) ?? [];
  const pieces: string[] = [];
  let cur = "";
  for (const sentence of sentences) {
    if (cur && (cur + " " + sentence).length > 150) {
      pieces.push(cur);
      cur = sentence;
    } else cur = cur ? `${cur} ${sentence}` : sentence;
  }
  if (cur) pieces.push(cur);
  return pieces;
})();

const STICKER = "die-cut sticker, thick white border, bold dark ink outline, flat vector cartoon illustration, warm palette of orange, teal, yellow and pink, cute and clear, ";
const stickers: [string, string][] = [
  ["brain", "a human brain"],
  ["neuron", "a neuron nerve cell with dendrites, a long axon and terminals"],
  ["spine", "a human spine with the spinal cord and nerve roots"],
  ["hand-flame", "a hand pulling away from a hot flame, small lightning bolt of pain"],
  ["snow", "a snowflake and a small flame side by side"],
  ["ear", "a human ear with sound waves"],
  ["heart", "an anatomical human heart with a pulse line"],
  ["lungs", "a pair of human lungs"],
  ["homunculus", "the Penfield sensory homunculus, a little man with giant hands, huge lips and tongue and a tiny body"],
  ["arm", "a flexed arm with a strong biceps muscle"],
  ["bulb", "a glowing light bulb with a small brain inside"],
  ["clock", "an alarm clock ringing, wide awake"],
];

const FILES: Record<string, string> = {
  "cérebro 3D": "brain.glb",
  papel: "paper.png",
  música: "music.mp3",
  "sfx page": "sfx/page.mp3",
  "sfx scribble": "sfx/scribble.mp3",
  "sfx pop": "sfx/pop.mp3",
  ...Object.fromEntries(VOICE_PIECES.map((_, i) => [`voz ${i + 1}`, `voice/${String(i + 1).padStart(2, "0")}.mp3`])),
  ...Object.fromEntries(stickers.map(([n]) => [`sticker ${n}`, `stickers/${n}.png`])),
};

const GAP = 0.22;

/** Joins the pieces with a short silence between them and writes one alignment for the whole narration. */
function assembleVoice(): void {
  const n = VOICE_PIECES.length;
  const files = VOICE_PIECES.map((_, i) => path.join(out, "voice", `${String(i + 1).padStart(2, "0")}.mp3`));
  const durations = files.map((f) => Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]).toString().trim()));
  const inputs = files.flatMap((f) => ["-i", f]);
  const pads = durations.map((_, i) => `[${i}]apad=pad_dur=${GAP}[a${i}]`).join(";");
  const chain = durations.map((_, i) => `[a${i}]`).join("");
  execFileSync("ffmpeg", ["-nostdin", "-y", "-loglevel", "error", ...inputs, "-filter_complex", `${pads};${chain}concat=n=${n}:v=0:a=1`, "-b:a", "128k", path.join(out, "voice.mp3")]);
  const characters: string[] = [];
  const starts: number[] = [];
  const ends: number[] = [];
  let offset = 0;
  VOICE_PIECES.forEach((text, i) => {
    const al = JSON.parse(readFileSync(path.join(out, "voice", `${String(i + 1).padStart(2, "0")}.json`), "utf8")) as { characters: string[]; character_start_times_seconds: number[]; character_end_times_seconds: number[] };
    if (i > 0) {
      characters.push(" ");
      starts.push(offset);
      ends.push(offset);
    }
    al.characters.forEach((ch, k) => {
      characters.push(ch);
      starts.push(offset + al.character_start_times_seconds[k]);
      ends.push(offset + al.character_end_times_seconds[k]);
    });
    offset += durations[i] + GAP;
    void text;
  });
  writeFileSync(path.join(out, "voice.json"), JSON.stringify({ text: characters.join(""), alignment: { characters, character_start_times_seconds: starts, character_end_times_seconds: ends } }));
  console.log(`narration: ${VOICE_PIECES.length} pieces, ${offset.toFixed(1)} s`);
}

async function main(): Promise<void> {
  const key = process.env.RIALTO_KEY?.trim();
  const secret = walletSecretFromEnv();
  if (!key || !secret) throw new Error("RIALTO_KEY and SOLANA_WALLET_KEY are needed (../.env)");
  const buyer = await createBuyer({ baseUrl: process.env.RIALTO_URL ?? "https://galleriarialto.com", rialtoKey: key, walletSecret: secret, totalLimitUsd: Number(process.env.RIALTO_TOTAL_LIMIT_USD ?? 10) });
  const get = async (url: string, file: string) => {
    const res = await fetch(url, { signal: AbortSignal.timeout(120_000) });
    if (!res.ok) throw new Error(`${url} → ${res.status}`);
    writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  };
  const have = (rel: string) => existsSync(path.join(out, rel));
  const jobs: { name: string; run: () => Promise<void> }[] = [];
  const buy = async (args: Parameters<typeof buyer.execute>[0]) => (await buyer.execute(args)).result as { final: Record<string, unknown> };

  for (const [i, text] of VOICE_PIECES.entries()) {
    jobs.push({
      name: `voz ${i + 1}`,
      run: async () => {
        const r = await buy({ goal: `Narre: "${text}"`, capability: "audio.speech", provider: "ElevenLabs Voice", budgetUsd: 0.2 });
        const f = r.final as { audio: string; alignment: unknown };
        mkdirSync(path.join(out, "voice"), { recursive: true });
        writeFileSync(path.join(out, "voice", `${String(i + 1).padStart(2, "0")}.mp3`), Buffer.from(f.audio, "base64"));
        writeFileSync(path.join(out, "voice", `${String(i + 1).padStart(2, "0")}.json`), JSON.stringify(f.alignment));
      },
    });
  }
  jobs.push({
    name: "música",
    run: async () => {
      const r = await buy({ goal: "Calm lo-fi study music, soft warm piano, gentle brushed beat, light vinyl crackle, instrumental, relaxed and focused, loopable", capability: "audio.music", provider: "Google Lyria 3.5", budgetUsd: 0.3 });
      await get(String((r.final as { audio: string }).audio), path.join(out, "music.mp3"));
    },
  });
  for (const [name, prompt] of [["page", "a single sheet of paper being turned over quickly, soft whoosh"], ["scribble", "a marker pen scribbling fast on paper"], ["pop", "a cute sticker being slapped onto a page, short pop"]] as const) {
    jobs.push({
      name: `sfx ${name}`,
      run: async () => {
        const r = await buy({ goal: prompt, capability: "audio.sfx", provider: "Sonilo Sound Effects", budgetUsd: 0.1 });
        await get(String((r.final as { audio: string }).audio), path.join(out, "sfx", `${name}.mp3`));
      },
    });
  }
  const todo = jobs.filter((j) => !have(FILES[j.name] ?? ""));
  jobs.length = 0;
  jobs.push(...todo);
  // two at a time: ElevenLabs and the public RPC both answer 429 above that
  let next = 0;
  const failures: string[] = [];
  const worker = async () => {
    for (;;) {
      const job = jobs[next++];
      if (!job) return;
      const t = Date.now();
      try {
        await job.run();
        console.log(`✔ ${job.name} (${Math.round((Date.now() - t) / 1000)} s)`);
      } catch (e) {
        failures.push(job.name);
        console.log(`✘ ${job.name}: ${e instanceof Error ? e.message : e}`);
      }
    }
  };
  await Promise.all(Array.from({ length: 2 }, worker));
  if (!failures.some((n) => n.startsWith("voz")) && VOICE_PIECES.every((_, i) => have(`voice/${String(i + 1).padStart(2, "0")}.mp3`))) assembleVoice();
  console.log(failures.length ? `\n${failures.length} failed: ${failures.join(", ")}` : "\nAll assets bought.");
  console.log(JSON.stringify(await buyer.status(), null, 1).split("\n").filter((l) => /spentSoFar|remaining/.test(l)).join("\n"));
}
main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
