# Rialto pitch video

A 64-second animated pitch, built with [Remotion](https://www.remotion.dev) and Three.js. Every frame is a pure function of the frame number, so it renders deterministically.

```bash
cd video
npm install
npm run dev       # Remotion Studio: preview, scrub, edit
npm run render    # writes out/rialto-pitch.mp4 (1920x1080, 30 fps)
```

Rendering uses the installed Google Chrome when it exists (see `remotion.config.ts`).

## Script

| # | Scene | Time | On screen | Voice-over (optional) |
|---|---|---|---|---|
| 1 | From scratch | 0:00 | The agent stacks a robot out of cubes by hand; it collapses. Token and time counters climb. | Your AI agent is smart. But ask it for something specialized, and it builds everything from scratch. Slow, expensive, and honestly… not great. |
| 2 | Build or hire | 0:07 | Left: scaffolding, a spinning clock, shrinking cash. Right: a specialist stall, the parcel pops out, done. | Companies cracked this ages ago. When the job is specialized, you don't build it. You hire the one who does it best. |
| 3 | Agents can't hire | 0:15 | The agent runs to three API stalls; gates slam down: SIGN UP, CREDIT CARD, API KEY. It turns to you. | But your agent can't hire. Every service wants a sign-up, a credit card, another API key. So it comes back to bug you. |
| 4 | Rialto | 0:24 | A giant phone book lands, opens, and a market pours out. | Meet Rialto: the phone book for AI agents, with a wallet built in. |
| 5 | How it works | 0:30 | Find → compare → pay → done. Three finalists with price, speed and trust; a coin flies; `402 → pay → 200`. | Your agent finds the right service, compares price, speed and reputation, and pays per call, right inside the request. No sign-up. No card. Just the result. |
| 6 | Result | 0:45 | CHEAPER · FASTER · BETTER. | A cheaper, faster agent that delivers better work. One key, one wallet, and a spending limit you control. |
| 7 | Sellers | 0:52 | Agents queue at "YOUR API"; coins drop in the jar. | Got an API? Publish it in a minute, and get paid every time an agent calls it. |
| 8 | CTA | 0:58 | Logo, tagline, repo. | Rialto. Agents that hire. |

There is no voice-over or music in the render: captions carry the story and the audio is sound effects only. To add a voice, record the lines above (or generate them with a TTS service), drop the files in `public/voiceover/` and add an `<Audio>` per scene in `src/Video.tsx`.

## Notes

- The numbers in the video (tokens, prices, speeds, trust scores) are illustrative.
- Payments in the product are simulated today; the video says "built for Solana · x402-style", not "live on Solana".
- The orange critter is inspired by the Claude Code mascot (an Anthropic trademark). Replace it before commercial use.
- Sound effects are loaded from `remotion.media`; the result image is from the iso3D dataset (see `../public/models/CREDITS.md`).

## Layout

```
src/
  Video.tsx        timeline: 8 scenes + sound cues
  Root.tsx         composition registry (the full video and each scene on its own)
  scenes/          one file per scene
  three/           Stage (canvas, camera, lights), Critter, low-poly props
  ui/              captions, chips, pop-ins
  lib/anim.ts      easing and keyframe helpers
```
