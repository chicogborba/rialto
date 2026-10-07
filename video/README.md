# Rialto pitch video

A 66-second animated pitch, built with [Remotion](https://www.remotion.dev) and Three.js: eight low-poly scenes, a narrator, captions that light up word by word, music that ducks under the voice. Every frame is a pure function of the frame number, so it renders deterministically.

```bash
cd video
npm install
npm run dev       # Remotion Studio: preview, scrub, edit
npm run render    # renders out/raw.mp4, then masters the audio into out/rialto-pitch.mp4 (needs ffmpeg)
```

Rendering uses the installed Google Chrome when it exists (see `remotion.config.ts`) and fetches the sound effects from `remotion.media`, so it needs a network connection.

Render without a layer (for example, no narrator):

```bash
npx remotion render RialtoPitch out/raw.mp4 --props='{"narration":false,"music":true,"sfx":true}'
```

## Script

| # | Scene | On screen | Narration |
|---|---|---|---|
| 1 | From scratch | The agent tries to carve a robot hero out of stone with mallet and chisel; the lopsided head appears, then it all crumbles while the token and time counters climb. | Your AI agent is smart. But it builds everything from scratch. Slow. And expensive. |
| 2 | Build or hire | An amateur keeps tapping at a cracked block: the clock will not stop, the cash shrinks, the head falls off. Then the specialist (beret, moustache, striped shirt): three taps and the polished statue is standing there. | Companies solved this ages ago. Don't build it. Hire the specialist. |
| 3 | Agents can't hire | Three API stalls; a gate slams on each one as it is named. The agent turns to you. | But your agent can't hire. Every API wants a sign-up, a credit card, another key. So it comes back to bug you. |
| 4 | Rialto | A giant phone book lands, opens, and a market pours out. | Meet Rialto. The phone book for AI agents. Wallet included. |
| 5 | How it works | Find → compare → pay → done: three finalists scored, a coin flies, `402 → pay → 200`, the result comes back. | Your agent finds the right service, compares price, speed and reputation, and pays per call, right inside the request. No sign-up. No card. Just the result. |
| 6 | Result | Cheaper · Faster · Better, each word landing as it is spoken. | A cheaper, faster agent, that does better work. One key. One wallet. Your spending limit. |
| 7 | Sellers | Agents queue at "YOUR API": each pays, takes its parcel and leaves. | Got an API? Publish it. And get paid on every call. |
| 8 | CTA | Logo, tagline, repo. | Rialto. Agents that hire. |

## How the edit is wired

`src/timeline.ts` is the edit: scene order, scene lengths and the frame where each narration line starts. Everything else follows from it:

- **Captions** show the line being spoken and light each word up at its recorded time (`src/voiceover.json`).
- **Animation beats** that must hit a word (the three gates, "Cheaper / Faster / Better", the coin on "wallet") ask the timeline for that word's frame with `wordAt(...)`.
- **Music** drops under every line and comes back up in the gaps and for the outro (`musicVolume` in `src/Video.tsx`).

### Re-recording the narration

The lines live in `scripts/voiceover.mjs`. It calls ElevenLabs once per line and writes `public/voiceover/*.mp3` plus the word timings.

```bash
echo "ELEVENLABS_API_KEY=your-key" > .env      # git-ignored
npm run voiceover                               # only lines that are missing or whose text changed
npm run voiceover -- 3b 5c                      # re-record specific lines
VOICE_ID=nPczCjzI2devNBz1zQrb npm run voiceover -- --all   # another voice (this one is "Brian")
```

One character costs one credit; the whole script is about 630. If a line gets longer, check that the next line in `CUES` (and the scene length in `DURATIONS`) still leaves room for it.

## Credits and licences

- **Music:** "Getting it Done" by Kevin MacLeod ([incompetech.com](https://incompetech.com)), licensed under [Creative Commons: By Attribution 4.0](https://creativecommons.org/licenses/by/4.0/). Trimmed to length. Keep this credit wherever the video is published (for example in the description).
- **Narration:** generated with [ElevenLabs](https://elevenlabs.io) (voice "Liam"). Audio made on the ElevenLabs free plan requires attribution and is not licensed for commercial use; regenerate it on a paid plan before using the video commercially.
- **Sound effects:** loaded from `remotion.media` at render time.
- **Result image:** from the iso3D dataset (see `../public/models/CREDITS.md`).
- The orange critter is inspired by the Claude Code mascot (an Anthropic trademark). Replace it before commercial use.

## Notes

- The numbers in the video (tokens, prices, speeds, trust scores) are illustrative.
- Payments in the product are simulated today; the video says "built for Solana · x402-style", not "live on Solana".

## Layout

```
src/
  timeline.ts      the edit: scene order, lengths, narration cues
  voiceover.json   recorded lines with word timings (written by scripts/voiceover.mjs)
  Video.tsx        the full video: scenes, wipes, music
  Root.tsx         composition registry (the full video and each scene on its own)
  scenes/          one file per scene
  three/           Stage (canvas, camera, lights), Critter, low-poly props
  ui/              narration + captions, sound cues, chips, pop-ins
  lib/anim.ts      easing and keyframe helpers
scripts/voiceover.mjs   ElevenLabs narration generator
public/voiceover/  narration clips    public/music/  the music bed
```
