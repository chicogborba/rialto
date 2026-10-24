import type { CapabilityId } from "@/lib/types";
import { OPERATOR_SELLER } from "./operator";

/**
 * First-party adapters the operator may enable with server-only API keys. They are ordinary
 * marketplace providers: the gateway calls the upstream and their credentials stay encrypted
 * in the database, never in the client bundle. Payment mode is still chosen independently.
 */
export interface BuiltInIntegration {
  slug: string;
  name: string;
  seller: string;
  description: string;
  capability: CapabilityId;
  upstreamUrl: string;
  upstreamMethod: "GET" | "POST";
  upstreamBody: string;
  resultPick: string;
  headerName: string;
  /** what goes before the key in the header: "Bearer ", "Key " or nothing */
  authScheme: string;
  /** the environment variable that holds the operator's key; the integration exists only when it is set */
  envKey: string;
  /** what one call of exactly this request costs Rialto upstream, in micro-USD */
  costMicro: number;
  quality: number;
  latencyMs: number;
}

/**
 * One model hosted by fal.ai. They all share a key and a shape (JSON in, JSON with a file link out), so
 * an entry is the model's path, the body it takes and where its answer keeps the link.
 * `cost` is what fal charges for ONE call of exactly this request (its published unit price times what
 * the body asks for: megapixels, seconds, characters, a typical number of tokens), in dollars. The
 * seller price Rialto asks is that plus the operator's margin (`operatorSellerPrice`, set in /admin),
 * and the buyer pays Rialto's commission on top. Prices checked against fal.ai on 2026-10-14; when fal
 * changes a price, change the number here and the next start updates the catalogue.
 */
function fal(
  slug: string, name: string, capability: CapabilityId, model: string, body: Record<string, unknown>, resultPick: string,
  cost: number, quality: number, latencyMs: number, description: string,
): BuiltInIntegration {
  return {
    slug, name, seller: OPERATOR_SELLER, description, capability,
    upstreamUrl: `https://fal.run/${model}`, upstreamMethod: "POST", upstreamBody: JSON.stringify(body), resultPick,
    headerName: "Authorization", authScheme: "Key ", envKey: "FAL_KEY",
    costMicro: Math.round(cost * 1_000_000), quality, latencyMs,
  };
}

const IMAGE = "image=images.0.url,width=images.0.width,height=images.0.height";
/** an instruction for a language model that gets the whole request as its prompt */
const llm = (model: string, system: string, extra: Record<string, unknown> = {}) => ({ model, system_prompt: system, prompt: "{goal}", max_tokens: 1500, ...extra });
const ANALYST = "You are a careful analyst. Answer the request directly and concisely. When context from earlier steps is given, base the answer on it and say what it does not cover.";
const TRANSLATOR = "You are a translator. The user names a target language and gives a text, usually in quotation marks. Reply with the translation only: no quotation marks, no notes.";
const SUMMARIZER = "Summarize the text the user gives in at most five short bullet points, in the language of the text. Reply with the bullets only.";

// {goal} is the whole request, {query} the quoted phrase, {url} the first link in it, {text} the request without links
const FAL_INTEGRATIONS: BuiltInIntegration[] = [
  // ---- game art
  fal("flux-sprites", "Flux Sprites", "image.sprites", "fal-ai/flux/schnell", { prompt: "{goal}", image_size: "square", output_format: "png" }, IMAGE, 0.003, 86, 2_000,
    "Game sprites, tiles and backgrounds from a text prompt (FLUX schnell on fal.ai). The fastest and cheapest. Returns a PNG link."),
  fal("recraft-sprites", "Recraft Flash Sprites", "image.sprites", "recraft/v4.1/flash/text-to-image", { prompt: "{goal}", image_size: "square_hd" }, "image=images.0.url", 0.007, 90, 2_500,
    "Clean, consistent game art and icons from a text prompt (Recraft V4.1 Flash on fal.ai). Returns an image link."),
  fal("ideogram-transparent", "Ideogram Transparent Sprites", "image.sprites", "fal-ai/ideogram/v3/generate-transparent", { prompt: "{goal}", rendering_speed: "TURBO" }, "image=images.0.url", 0.03, 94, 10_000,
    "Sprites and objects on a transparent background, ready to drop into a game (Ideogram V3 on fal.ai). Returns a PNG link with alpha."),
  fal("zimage-tiles", "Seamless Tiles", "image.sprites", "fal-ai/z-image/turbo/tiling", { prompt: "{goal}", image_size: "square", output_format: "png" }, IMAGE, 0.02, 88, 2_500,
    "Textures that repeat without a seam: roads, grass, walls, floors (Z-Image Turbo tiling on fal.ai). Returns a PNG link."),

  // ---- images
  fal("flux2-flash", "FLUX.2 Flash", "image.generate", "fal-ai/flux-2/flash", { prompt: "{goal}", image_size: "landscape_4_3", output_format: "png" }, IMAGE, 0.005, 86, 3_300,
    "Fast, cheap images from a text prompt (FLUX.2 Flash on fal.ai). Returns a PNG link."),
  fal("flux3", "FLUX 3", "image.generate", "blackforestlabs/flux-3/text-to-image", { prompt: "{goal}" }, IMAGE, 0.024, 94, 20_000,
    "High-quality images from a text prompt (Black Forest Labs FLUX 3 on fal.ai). Returns an image link."),
  fal("flux2-pro", "FLUX.2 Pro", "image.generate", "fal-ai/flux-2-pro", { prompt: "{goal}" }, IMAGE, 0.03, 93, 9_000,
    "Production-grade images with strong prompt following (FLUX.2 Pro on fal.ai). Returns an image link."),
  fal("recraft-image", "Recraft V4.1", "image.generate", "fal-ai/recraft/v4.1/text-to-image", { prompt: "{goal}" }, "image=images.0.url", 0.035, 92, 6_500,
    "Design-quality illustrations and brand visuals from a text prompt (Recraft V4.1 on fal.ai). Returns an image link."),
  fal("seedream-flash", "Seedream 5 Flash", "image.generate", "bytedance/seedream/v5/flash/text-to-image", { prompt: "{goal}", image_size: "auto_2K" }, "image=images.0.url", 0.027, 91, 18_000,
    "Detailed 2K images from a text prompt (ByteDance Seedream 5 Flash on fal.ai). Returns an image link."),
  fal("nano-banana-2", "Nano Banana 2", "image.generate", "fal-ai/nano-banana-2", { prompt: "{goal}" }, "image=images.0.url", 0.08, 96, 11_000,
    "Google's image model: accurate text in images, complex scenes, world knowledge (Nano Banana 2 on fal.ai). Returns a PNG link."),
  fal("recraft-vector", "Recraft Vector", "image.vector", "fal-ai/recraft/v4.1/text-to-vector", { prompt: "{goal}" }, "image=images.0.url", 0.08, 93, 8_500,
    "Logos, icons and illustrations as real SVG vectors from a text prompt (Recraft V4.1 on fal.ai). Returns an SVG link."),

  // ---- work on an image: the request carries its link
  fal("flux2-flash-edit", "FLUX.2 Flash Edit", "image.edit", "fal-ai/flux-2/flash/edit", { prompt: "{text}", image_urls: ["{url}"], output_format: "png" }, IMAGE, 0.01, 86, 4_500,
    "Change an image with an instruction: recolor, add, remove, restyle (FLUX.2 Flash on fal.ai). Put the image link in your request. Returns a PNG link."),
  fal("flux-kontext", "FLUX Kontext", "image.edit", "fal-ai/flux-pro/kontext", { prompt: "{text}", image_url: "{url}" }, IMAGE, 0.04, 93, 12_000,
    "Precise edits that keep the rest of the image as it was (FLUX.1 Kontext pro on fal.ai). Put the image link in your request. Returns an image link."),
  fal("nano-banana-2-edit", "Nano Banana 2 Edit", "image.edit", "fal-ai/nano-banana-2/edit", { prompt: "{text}", image_urls: ["{url}"] }, "image=images.0.url", 0.08, 96, 11_000,
    "The most capable editor: complex instructions, text in images, consistent characters (Nano Banana 2 on fal.ai). Put the image link in your request. Returns a PNG link."),
  fal("birefnet", "BiRefNet Cutout", "image.background_removal", "fal-ai/birefnet/v2", { image_url: "{url}" }, "image=image.url,width=image.width,height=image.height", 0.002, 90, 2_000,
    "Remove the background of an image (BiRefNet v2 on fal.ai). Put the image link in your request. Returns a transparent PNG link."),
  fal("bria-rmbg", "Bria RMBG 2.0", "image.background_removal", "fal-ai/bria/background/remove", { image_url: "{url}" }, "image=image.url,width=image.width,height=image.height", 0.018, 95, 3_000,
    "Background removal trained on licensed data, with clean edges on hair and glass (Bria RMBG 2.0 on fal.ai). Put the image link in your request. Returns a transparent PNG link."),
  fal("esrgan", "ESRGAN Upscale", "image.upscale", "fal-ai/esrgan", { image_url: "{url}", scale: 2 }, "image=image.url,width=image.width,height=image.height", 0.005, 86, 8_000,
    "Double the resolution of an image (Real-ESRGAN on fal.ai). Put the image link in your request. Returns a PNG link."),
  fal("recraft-crisp", "Recraft Crisp Upscale", "image.upscale", "fal-ai/recraft/upscale/crisp", { image_url: "{url}" }, "image=image.url", 0.004, 92, 8_000,
    "Sharper, larger images without invented detail (Recraft Crisp Upscale on fal.ai). Put the image link in your request. Returns an image link."),
  fal("gemini-vision", "Gemini Vision", "vision.describe", "openrouter/router/vision", { model: "google/gemini-2.5-flash", prompt: "{text}", image_urls: ["{url}"], max_tokens: 1000 }, "description=output", 0.002, 93, 3_000,
    "Answer a question about an image, or describe it (Gemini 2.5 Flash through fal.ai). Put the image link and your question in the request."),
  fal("florence-caption", "Florence-2 Caption", "vision.describe", "fal-ai/florence-2-large/more-detailed-caption", { image_url: "{url}" }, "description=results", 0.003, 84, 2_500,
    "A detailed caption of an image (Microsoft Florence-2 on fal.ai). Put the image link in your request."),

  // ---- 3D
  fal("tripo-h31", "Tripo H3.1", "model.3d", "tripo3d/h3.1/text-to-3d", { prompt: "{goal}" }, "model=model_mesh.url,preview=rendered_image.url", 0.2, 96, 180_000,
    "A textured 3D model from a text prompt (Tripo H3.1 on fal.ai). Returns a GLB link and a preview render."),
  fal("hunyuan3d-text", "Hunyuan 3D Pro", "model.3d", "fal-ai/hunyuan-3d/v3.1/pro/text-to-3d", { prompt: "{goal}" }, "model=model_glb.url,preview=thumbnail.url", 0.375, 94, 150_000,
    "A detailed 3D model from a text prompt (Tencent Hunyuan 3D v3.1 Pro on fal.ai). Returns a GLB link."),
  fal("trellis", "Trellis", "model.image_to_3d", "fal-ai/trellis", { image_url: "{url}" }, "model=model_mesh.url", 0.02, 86, 50_000,
    "Turn one image into a small textured 3D model (Microsoft Trellis on fal.ai). The cheapest. Put the image link in your request. Returns a GLB link."),
  fal("trellis-2", "Trellis 2", "model.image_to_3d", "fal-ai/trellis-2", { image_url: "{url}" }, "model=model_glb.url", 0.3, 93, 140_000,
    "Higher-fidelity image to 3D with clean topology (Trellis 2 on fal.ai). Put the image link in your request. Returns a GLB link."),
  fal("hunyuan3d-rapid", "Hunyuan 3D Rapid", "model.image_to_3d", "fal-ai/hunyuan-3d/v3.1/rapid/image-to-3d", { input_image_url: "{url}" }, "model=model_urls.obj.url,texture=model_urls.texture.url,material=model_urls.mtl.url,preview=thumbnail.url", 0.225, 91, 70_000,
    "Image to 3D with a separate high-resolution texture (Tencent Hunyuan 3D v3.1 Rapid on fal.ai). Put the image link in your request. Returns OBJ, material and texture links."),
  fal("rodin-fast", "Hyper3D Rodin Fast", "model.image_to_3d", "fal-ai/hyper3d/rodin/v2.5/fast", { image_urls: ["{url}"] }, "model=model_mesh.url", 0.1, 92, 25_000,
    "Game-ready meshes from one image (Hyper3D Rodin 2.5 Fast on fal.ai). Put the image link in your request. Returns a GLB link."),

  // ---- sound
  fal("fal-sfx", "ElevenLabs Sound Effects", "audio.sfx", "fal-ai/elevenlabs/sound-effects/v2", { text: "{goal}" }, "audio=audio.url", 0.01, 95, 2_500,
    "Short sound effects from a description: horns, engines, crashes, UI blips (ElevenLabs on fal.ai). Returns an MP3 link."),
  fal("cassette-sfx", "CassetteAI Sound Effects", "audio.sfx", "cassetteai/sound-effects-generator", { prompt: "{goal}", duration: 5 }, "audio=audio_file.url", 0.01, 86, 15_000,
    "Five-second sound effects from a description, in about a second (CassetteAI on fal.ai). Returns an audio link."),
  fal("stable-sfx", "Stable Audio SFX", "audio.sfx", "fal-ai/stable-audio-3/small/sfx/text-to-audio", { prompt: "{goal}", duration: 5 }, "audio=audio.url", 0.0206, 90, 12_000,
    "Sound effects and foley from a description (Stable Audio 3 Small SFX on fal.ai). Returns an MP3 link."),
  fal("sonilo-sfx", "Sonilo Sound Effects", "audio.sfx", "sonilo/v1.1/text-to-sound-effects", { prompt: "{goal}", duration: 5, audio_format: "mp3" }, "audio=audio.url", 0.009, 87, 4_000,
    "Sound effects from a description (Sonilo v1.1 on fal.ai). Returns an MP3 link."),
  fal("fal-music", "Stable Audio 2.5", "audio.music", "fal-ai/stable-audio-25/text-to-audio", { prompt: "{goal}", seconds_total: 30 }, "audio=audio.url", 0.2, 94, 5_000,
    "A 30-second studio-quality music track or loop from a description (Stable Audio 2.5 on fal.ai). Returns an audio link."),
  fal("cassette-music", "CassetteAI Music", "audio.music", "cassetteai/music-generator", { prompt: "{goal}", duration: 30 }, "audio=audio_file.url", 0.01, 84, 18_000,
    "A 30-second music track from a description, in seconds (CassetteAI on fal.ai). The cheapest. Returns an audio link."),
  fal("stable-music-small", "Stable Audio Small Music", "audio.music", "fal-ai/stable-audio-3/small/music/text-to-audio", { prompt: "{goal}", duration: 30 }, "audio=audio.url", 0.0217, 88, 4_500,
    "A 30-second music loop from a description (Stable Audio 3 Small on fal.ai). Returns an MP3 link."),
  fal("sonilo-music", "Sonilo Music", "audio.music", "sonilo/v1.1/text-to-music", { prompt: "{goal}", duration: 30 }, "audio=audio.url", 0.075, 90, 6_500,
    "A 30-second instrumental from a description (Sonilo v1.1 on fal.ai). Returns an audio link."),
  fal("lyria", "Google Lyria 3.5", "audio.music", "google/lyria-3.5", { prompt: "{goal}" }, "audio=audio.url", 0.1, 95, 45_000,
    "Full music clips with rich instrumentation from a description (Google Lyria 3.5 on fal.ai). Returns an audio link."),

  // ---- voice
  fal("kokoro", "Kokoro Voice", "audio.speech", "fal-ai/kokoro/american-english", { prompt: "{query}" }, "audio=audio.url", 0.01, 84, 2_500,
    "Fast, cheap English text-to-speech (Kokoro on fal.ai). Put the text to speak in double quotes. Returns an audio link."),
  fal("eleven-v4-turbo", "ElevenLabs v4 Turbo", "audio.speech", "elevenlabs/tts/eleven-v4-turbo", { text: "{query}" }, "audio=audio.url", 0.02, 95, 2_500,
    "Natural, expressive speech in many languages (ElevenLabs v4 Turbo on fal.ai). Put the text to speak in double quotes. Returns an MP3 link."),
  fal("xai-tts", "xAI Voice", "audio.speech", "xai/tts/v1", { text: "{query}" }, "audio=audio.url", 0.0075, 88, 2_500,
    "Text-to-speech in 20+ languages (xAI TTS on fal.ai). Put the text to speak in double quotes. Returns an audio link."),
  fal("chatterbox", "Chatterbox Voice", "audio.speech", "fal-ai/chatterbox/text-to-speech", { text: "{query}" }, "audio=audio.url", 0.0125, 87, 7_000,
    "Open-source expressive English speech (Resemble Chatterbox on fal.ai). Put the text to speak in double quotes. Returns an audio link."),
  fal("wizper", "Wizper Transcription", "audio.transcribe", "fal-ai/wizper", { audio_url: "{url}", language: null }, "text=text,languages=languages", 0.01, 90, 2_500,
    "Transcribe an audio or video file in 99 languages (Whisper v3 on fal.ai). Put the file link in your request."),
  fal("scribe", "ElevenLabs Scribe", "audio.transcribe", "fal-ai/elevenlabs/speech-to-text/scribe-v2", { audio_url: "{url}" }, "text=text,language=language_code", 0.016, 96, 2_500,
    "The most accurate transcription, with sound events marked (ElevenLabs Scribe v2 on fal.ai). Put the file link in your request."),

  // ---- video
  fal("veo-lite", "Veo 3.1 Lite", "video.generate", "fal-ai/veo3.1/lite", { prompt: "{goal}", duration: "4s" }, "video=video.url", 0.2, 94, 30_000,
    "A 4-second 720p clip with sound from a text prompt (Google Veo 3.1 Lite on fal.ai). Returns an MP4 link."),
  fal("wan-video", "Wan 3.0", "video.generate", "alibaba/wan-3.0/text-to-video", { prompt: "{goal}", duration: 5, resolution: "720p" }, "video=video.url", 0.5, 92, 155_000,
    "A 5-second 720p clip with sound from a text prompt (Alibaba Wan 3.0 on fal.ai). Returns an MP4 link."),
  fal("ltx-video", "LTX 2.3 Fast", "video.generate", "fal-ai/ltx-2.3/text-to-video/fast", { prompt: "{goal}", duration: 6 }, "video=video.url", 0.36, 90, 30_000,
    "A 6-second 1080p clip with sound from a text prompt (Lightricks LTX 2.3 Fast on fal.ai). Returns an MP4 link."),

  // ---- language models (through fal's OpenRouter endpoint)
  fal("gemini-search", "Gemini Web Search", "web.search", "openrouter/router", llm("google/gemini-2.5-flash", "Answer from current web results. Be concise and name your sources with their links.", { enable_web_search: true }), "answer=output", 0.02, 90, 5_000,
    "A sourced answer from a live web search (Gemini 2.5 Flash with web search, through fal.ai)."),
  fal("gemini-analysis", "Gemini Flash Analysis", "llm.analysis", "openrouter/router", { ...llm("google/gemini-2.5-flash", ANALYST), prompt: "{goal}\n\nContext from earlier steps (may be empty):\n{inputs}" }, "analysis=output", 0.002, 88, 2_500,
    "Reasoning and writing over your request and whatever earlier steps found (Gemini 2.5 Flash through fal.ai). Fast and cheap."),
  fal("claude-analysis", "Claude Sonnet Analysis", "llm.analysis", "openrouter/router", { ...llm("anthropic/claude-sonnet-4.5", ANALYST), prompt: "{goal}\n\nContext from earlier steps (may be empty):\n{inputs}" }, "analysis=output", 0.015, 96, 4_000,
    "Careful analysis and writing over your request and whatever earlier steps found (Claude Sonnet 4.5 through fal.ai)."),
  fal("gemini-translate", "Gemini Translate", "text.translate", "openrouter/router", llm("google/gemini-2.5-flash", TRANSLATOR), "translation=output", 0.002, 90, 2_000,
    "Translate text between languages (Gemini 2.5 Flash through fal.ai). Name the target language and put the text in double quotes."),
  fal("claude-translate", "Claude Haiku Translate", "text.translate", "openrouter/router", llm("anthropic/claude-haiku-4.5", TRANSLATOR), "translation=output", 0.004, 94, 2_000,
    "Translation that keeps tone and idiom (Claude Haiku 4.5 through fal.ai). Name the target language and put the text in double quotes."),
  fal("gemini-summarize", "Gemini Summarize", "text.summarize", "openrouter/router", { ...llm("google/gemini-2.5-flash", SUMMARIZER), prompt: "{goal}\n\n{inputs}" }, "summary=output", 0.002, 89, 2_000,
    "A five-bullet summary of the text in your request (Gemini 2.5 Flash through fal.ai)."),
  fal("claude-summarize", "Claude Haiku Summarize", "text.summarize", "openrouter/router", { ...llm("anthropic/claude-haiku-4.5", SUMMARIZER), prompt: "{goal}\n\n{inputs}" }, "summary=output", 0.004, 94, 2_000,
    "A faithful five-bullet summary of the text in your request (Claude Haiku 4.5 through fal.ai)."),
];

export const BUILT_IN_INTEGRATIONS: BuiltInIntegration[] = [
  {
    slug: "elevenlabs",
    name: "ElevenLabs Voice",
    seller: OPERATOR_SELLER,
    description: "Natural text-to-speech audio generated by ElevenLabs.",
    capability: "audio.speech",
    upstreamUrl: "https://api.elevenlabs.io/v1/text-to-speech/JBFqnCBsd6RMkjVDRZzb/with-timestamps?output_format=mp3_22050_32",
    upstreamMethod: "POST",
    upstreamBody: '{"text":"{query}","model_id":"eleven_multilingual_v2"}',
    resultPick: "audio=audio_base64,alignment=alignment",
    headerName: "xi-api-key",
    authScheme: "",
    envKey: "ELEVENLABS_API_KEY",
    // ~200 characters at ElevenLabs' pay-as-you-go rate (about $0.22 per 1,000): an estimate, not a fal price
    costMicro: 44_000,
    quality: 96,
    latencyMs: 1_200,
  },
  {
    slug: "tripo3d",
    name: "Tripo 3D",
    seller: OPERATOR_SELLER,
    description: "Generate downloadable 3D models from a text prompt with Tripo.",
    capability: "model.3d",
    upstreamUrl: "https://api.tripo3d.ai/v2/openapi/task",
    upstreamMethod: "POST",
    upstreamBody: '{"type":"text_to_model","prompt":"{goal}"}',
    resultPick: "model=data.output.model,preview=data.output.rendered_image,taskId=data.task_id",
    headerName: "Authorization",
    authScheme: "Bearer ",
    envKey: "TRIPO_API_KEY",
    // Tripo bills credits ($0.01 each); a textured text-to-3D model is about 30: an estimate, not a fal price
    costMicro: 300_000,
    quality: 95,
    latencyMs: 45_000,
  },
  ...FAL_INTEGRATIONS,
];
