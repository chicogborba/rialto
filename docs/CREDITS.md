# Credits and licences

## Sample files (`public/samples/`)

Used by the example requests in the console (image editing, upscaling, transcription and so on).

- `image.jpg`: AI-generated image (DreamShaper XL, an SDXL-class diffusion model), prompt "a robot, isolated object render, with a white background". From the [iso3D dataset](https://huggingface.co/datasets/dylanebert/iso3d) via [3D Arena](https://huggingface.co/datasets/3d-arena/3d-arena) (`inputs/images/a_robot.jpg`), licence **MIT**. Unmodified.
- `speech.mp3`: a short synthetic voice clip made for testing transcription.

## Demo games (`public/demo/games/`)

Both games were written by Claude Code from the same request and are served exactly as it left them.

- `plain/`: code only, no assets.
- `rialto/`: every file in `assets/` (sprites, textures, title art, music, sound effects, announcer lines) was bought by the agent through Rialto during that session. The providers and the payment for each one are listed on the [demo page](https://galleriarialto.com/demo) and in `lib/demo/game-demo.ts`.

## Videos (`public/video/`, `video/`)

- **Music:** "Getting it Done" by Kevin MacLeod ([incompetech.com](https://incompetech.com)), licensed under [Creative Commons: By Attribution 4.0](https://creativecommons.org/licenses/by/4.0/). Keep this credit wherever the videos are published.
- **Narration:** generated with [ElevenLabs](https://elevenlabs.io). Audio made on the free plan requires attribution and is not licensed for commercial use; regenerate it on a paid plan before using the videos commercially.
- **Sound effects:** loaded from `remotion.media` at render time.

## The critter

The orange critter is an original character inspired by the Claude Code mascot. That mascot is an Anthropic trademark, so replace the character before using this project commercially.
