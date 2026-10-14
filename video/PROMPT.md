# Prompt: make a video in the Rialto style

How to use it: open Claude Code in this repo (so it can read `video/`), paste everything between the two lines, and fill in the `{{…}}` parts. It works for a new composition in this project; to start a separate project, tell Claude to copy `video/` and keep `src/lib`, `src/ui`, `src/three`, `src/theme.ts`.

---

You are making a short explainer video in the style of the Rialto pitch: playful low-poly 3D, a hard-edged cream-and-ink design, a narrator, captions that light up word by word, and music that ducks under the voice. It is built with Remotion and three.js, and every frame is a pure function of the frame number.

**The video**
- Topic: {{what it explains, in one sentence}}
- Audience and goal: {{who watches, what they should do or believe after}}
- Length: {{e.g. 45 s}}. Format: 1920×1080, 30 fps.
- One line it must leave behind: {{the tagline}}
- Language of narration and captions: {{English}}

**Before writing anything**, read these files in `video/` and reuse them rather than inventing parallels: `src/theme.ts` (palette, fonts), `src/lib/anim.ts` (easing and motion helpers), `src/ui/Ui.tsx` (`Narration`, `Chip`, `Pop`, `Sfx`, `hard`), `src/three/Stage.tsx`, `Props.tsx`, `Critter.tsx` (scene, set pieces, the mascot), `src/Video.tsx` and `src/timeline.ts` (how scenes, narration cues and music ducking are wired), `scripts/voiceover.mjs` (narration pipeline), `README.md`.

## Look

- **Palette** (from `theme.ts`, never hard-code others): ink `#17120f`, paper `#f6efe0`, sand `#ecdfc6`, orange `#ee7a35`, lime `#c6ff3d`, cyan `#5ce1e6`, red `#ff4d4d`, gold `#ffd23f`; Solana purple `#9945ff` and mint `#14f195` only where Solana is the subject. Backgrounds are warm paper or a single saturated flat colour (orange, cyan, lime), never gradients or photos.
- **Type**: Space Grotesk 700 for headlines, JetBrains Mono 500/800 for labels, prices and code. Headlines are short, tight and big. Highlight the key word with a lime block behind it (marker style), not colour alone.
- **Hard shadows**: boxes, chips and cards have a 2–6 px ink border and an offset ink shadow with no blur (`hard(8)`). Corners are square or barely rounded. No glass, no glow, no drop-shadow blur.
- **3D**: low-poly, flat-shaded, made of boxes and a few cylinders, lit softly with a single soft ground shadow. A **blocky orange critter** is the hero: a rounded box body, two little black visor eyes (a `>` `<` squint when it is effort or joy), stubby legs, optional hair and glasses to make people. It hops, leans, blinks and looks at what it is doing. Scenery is market stalls with striped awnings, trees, clouds, parcels, coins, a street clock: toy-like, never realistic.
- **Camera**: slow, deliberate moves between keyframes (`keys3`), a push-in on the thing that matters, a hard cut or a wipe at scene changes. Never shaky.

## Motion

- Everything arrives with a **pop** (scale in with a little overshoot), a **spring**, or a **bounce**; nothing fades in linearly. Use `pop`, `spring`, `back`, `bounce`, `eOut`, `eInOut`, `arc` from `anim.ts`.
- One idea per scene, one thing moving at a time. If the viewer has to read, stop everything else.
- Counters count up (money, time, tokens). Gates slam, coins fly in an arc, stamps land with a small shake. Cause and effect happen on the beat of a narration word, not near it: ask the timeline for that word's frame (`wordAt`) and hang the animation on it.
- Scene changes: a lime panel then an ink panel sweep across (`Wipe`), or a hard cut on a loud beat.

## Story shape (adapt, do not pad)

1. **Hook** (≤ 3 s): the problem, said in one sentence over one image. Start on the pain, not the logo.
2. **Pain**: show it going wrong in a funny, physical way (the critter carving a statue badly, a gate slamming shut), with a counter running.
3. **Turn**: the product's name lands on a big card, with its one-line definition.
4. **How**: three or four beats, each a single verb on screen (find, compare, pay, done), each with its own set piece.
5. **Proof**: real footage or real numbers, never invented. If you show a product screen, record the real thing.
6. **Close**: the logo, the tagline, the address. Hold 2 s.

Words on screen are few. Prefer a verb and a number to a sentence. Never more than ~12 words visible at once besides captions.

## Voice and captions

- Narration in short, spoken sentences, the way a confident friend explains it; no jargon without an example, no "revolutionary", no adjectives that do not carry a fact.
- Each line is a clip (`scripts/voiceover.mjs`: `LINES` is `[id, text]`, ids are scene number + letter). It records with ElevenLabs and writes word timings to `src/voiceover.json`, which drives the captions (`Narration`) so words light up as they are spoken. Add your lines, run `npm run voiceover`, then set the cue frame of each line in `CUES` in `timeline.ts`.
- Scene length = the last line's cue + its duration + about 12 frames of air. If a line gets longer, check that the next cue and the scene length still leave room.

## Sound

- Music: one looping bed, ducked to about half under every line and back up in the gaps and for the outro (`musicVolume` in `Video.tsx`); dip a few frames across the loop seam so the restart is not heard.
- Sound effects are sparse and tied to the on-screen action: a tap, a coin, a gate, a pop, a stamp. Use `Sfx`. Silence is a tool.

## Recorded footage

When the video shows a real product, record it instead of animating a fake: `scripts/record-demo.mjs` drives headless Chrome and saves the screen plus a cursor track and timing marks into `public/demo/takes/`; render those takes inside a browser frame with the cursor replayed on top. Use `http://localhost:PORT`, never `127.0.0.1`. Hand-built UI mock-ups are for the animated parts only.

## Build rules (these have caused real bugs)

- Every animated value derives from `useCurrentFrame()`; no `Date.now`, `Math.random`, CSS transitions or `setTimeout`. Use `rnd(i)` for deterministic randomness.
- Render **one tab at a time** (`Config.setConcurrency(1)` is already set): more tabs make Chrome drop layers on random frames (labels vanish, frames come out tiled, "piscando"). `npm run render` ends with `scripts/check-flicker.mjs`, which fails on such a frame.
- Render with the installed Google Chrome and outside any sandbox. Start long renders with the Bash tool's background flag and say how long they take (a two-minute cut is about 6 minutes). Never run two renders at once.
- Keep scenes independent compositions (`scene-<id>`) so each can be previewed and rendered alone; stills are cheap: `npx remotion still <Id> out/x.jpg --frame=N --scale=0.5`.
- Do not use gradients, stock footage or generated photos. If a model needs an asset (a logo, a sprite), build it from boxes and paths in code.

## Deliver

1. A short plan first: the scenes, their lengths, the narration lines, and which set piece each scene has. Wait for a yes.
2. Then build scene by scene, previewing stills of each (hook, a mid frame, the last frame) before moving on.
3. Finish with the full render, the flicker check, and a 720p copy for the web. Report the output paths and anything you could not verify.

---

## A filled-in example

> Topic: Rialto, the market where AI agents find, compare and pay for APIs. Audience: developers who use Claude Code. Goal: they connect an agent. Length: 60 s. Tagline: "Agents that hire." Narration: English.
>
> Hook: the critter hand-carves a robot statue out of stone while a token counter and a clock run; the head comes out lopsided. Turn: a specialist walks in, three taps, a perfect statue. Pain: three API stalls, a gate slams on each as it is named; the critter turns to you. Product: a phone book lands and opens on a directory of APIs with prices. How: find → compare → pay (`402 → pay → 200`) → done. Proof: the real dashboard and a real transaction link. Close: the logo and `galleriarialto.com`.
