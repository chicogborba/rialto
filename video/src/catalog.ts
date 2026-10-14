/**
 * The catalog shown in the "it is live" scene.
 *
 * `listed: true` are on the server today at exactly these prices. The rest are APIs that belong on
 * the platform and are to be registered before the pitch goes out: until each one is, its name and
 * price here are a plan, not a fact. Delete any line that will not be registered.
 */
export const CATALOG: { name: string; what: string; price: string; emoji: string; listed?: boolean }[] = [
  { name: "ElevenLabs Voice", what: "audio.speech", price: "$0.021", emoji: "🎙️", listed: true },
  { name: "Tripo 3D", what: "model.3d", price: "$0.3675", emoji: "🧊", listed: true },
  { name: "PokéDex", what: "data.lookup", price: "$0.003", emoji: "📕", listed: true },
  { name: "Flux", what: "image.generate", price: "$0.040", emoji: "🎨" },
  { name: "Brave Search", what: "web.search", price: "$0.005", emoji: "🔎" },
  { name: "Firecrawl", what: "web.scrape", price: "$0.004", emoji: "🕷️" },
  { name: "Deepgram", what: "speech.to-text", price: "$0.006", emoji: "👂" },
  { name: "DeepL", what: "text.translate", price: "$0.004", emoji: "🌍" },
  { name: "Helius", what: "solana.rpc", price: "$0.001", emoji: "☀️" },
  { name: "Suno", what: "music.generate", price: "$0.100", emoji: "🎵" },
  { name: "Runway", what: "video.generate", price: "$0.500", emoji: "🎬" },
  { name: "Exa", what: "web.search", price: "$0.006", emoji: "🧭" },
  { name: "OpenWeather", what: "weather.now", price: "$0.002", emoji: "⛅" },
  { name: "CoinGecko", what: "market.quotes", price: "$0.002", emoji: "📈" },
  { name: "Mapbox", what: "geo.route", price: "$0.003", emoji: "🗺️" },
  { name: "Mistral OCR", what: "doc.ocr", price: "$0.005", emoji: "📄" },
  { name: "Jupiter", what: "swap.quote", price: "$0.001", emoji: "🪐" },
  { name: "E2B", what: "code.run", price: "$0.010", emoji: "💻" },
  { name: "Resend", what: "email.send", price: "$0.002", emoji: "✉️" },
  { name: "Stability", what: "image.generate", price: "$0.030", emoji: "🖼️" },
  { name: "Meshy", what: "model.3d", price: "$0.300", emoji: "🗿" },
  { name: "Tavily", what: "web.research", price: "$0.008", emoji: "📚" },
  { name: "Pyth", what: "price.feed", price: "$0.001", emoji: "🔮" },
  { name: "Twilio", what: "sms.send", price: "$0.010", emoji: "💬" },
  { name: "Browserbase", what: "browser.session", price: "$0.020", emoji: "🌐" },
  { name: "Remove.bg", what: "image.cutout", price: "$0.020", emoji: "✂️" },
  { name: "Alpha Vantage", what: "market.quotes", price: "$0.004", emoji: "💹" },
  { name: "Birdeye", what: "token.data", price: "$0.002", emoji: "🦅" },
];
