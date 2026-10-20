/**
 * The game made twice by Claude Code (Sonnet) from one request, on 13 October 2026: once alone
 * (default effort), once connected to Rialto (high effort). Both builds are served untouched from /public/demo/games. The purchases are
 * the agent's own statement for that session; each `tx` is its payment on Solana devnet.
 */
export const GAME_PROMPT = "Make a game where you dodge cars in traffic";
export const GAME_PROMPT_SUFFIX = ", use rialto";

export interface GamePurchase {
  emoji: string;
  what: string;
  provider: string;
  /** what the API itself charged for this call, in micro-USD (see the note above GAME_PURCHASES) */
  micro: number;
  /** signature of the payment on Solana devnet */
  tx: string;
}

/**
 * `micro` is the API's own price for the call, not Rialto's listing: fal.ai's unit price (checked
 * against api.fal.ai/v1/models/pricing on 2026-10-20) times what the asset in /public/demo/games/rialto
 * measures. Ideogram V3 transparent, Turbo: $0.03 an image. Z-Image tiling: $0.02 a megapixel, billed
 * per started megapixel (512×512). FLUX.2 Pro: $0.03 the first megapixel (1024×768). Stable Audio 2.5:
 * $0.20 a track. ElevenLabs sound effects v2: $0.002 a second of audio. ElevenLabs v4 Turbo: $0.04 per
 * 1,000 characters spoken.
 */
export const GAME_PURCHASES: GamePurchase[] = [
  { emoji: "🏎️", what: "Player car", provider: "Ideogram Transparent Sprites", micro: 30000, tx: "31a8ZLUbG153kChuMb78Hwr82ZpRzWYStFkZ1TrXg9SZECHHTG7LRVHSuGXhK4vJxAmawfoUcCDJWQ1ChMYiYatM" },
  { emoji: "🚙", what: "Blue sedan", provider: "Ideogram Transparent Sprites", micro: 30000, tx: "5L2Ff9mfe1cKKpywme11vFxDu75gR3XaZrXK3iFdVYgzoQyrY3XAmssxcFxHMhq9scATg7axDUEs2tU4ZS77Se7q" },
  { emoji: "🚕", what: "Taxi", provider: "Ideogram Transparent Sprites", micro: 30000, tx: "4AMJ7sLPxxZAu3kV7bmAUpTpVAa65SYdkuSrKdcwbGZ1Yo3j9ESWAvr2ytUbo9DyYdhq6YTrZkNzz7XM5a77pQ1S" },
  { emoji: "🚚", what: "Delivery truck", provider: "Ideogram Transparent Sprites", micro: 30000, tx: "67Eea3ENa7kG1kvkPyVjDMzyae9cnorMwXk9irS8zedxocw7sHHsc8R4R3RCC8YNqCk4Ng9Py7EJYcwDcQzZFyTm" },
  { emoji: "🚗", what: "Green hatchback", provider: "Ideogram Transparent Sprites", micro: 30000, tx: "2EYJDgwA9Eysch2guc2sFNRBD2wD9zTMSMhwWyhMAHRqmtyiAmpbwZNNZAzgshUvdcDvowoMxtKtRmzSPRHwpm1X" },
  { emoji: "🛣️", what: "Road texture", provider: "Seamless Tiles", micro: 20000, tx: "G1tLHEnw2P7e8T5M5j2XNTU5Da4EFB7Rrexd3auhQyJUV4XDAZroCWBffJii6vjLdibJUg1yrrmoUte8HdrxVVW" },
  { emoji: "🛣️", what: "Roadside texture", provider: "Seamless Tiles", micro: 20000, tx: "VbAtkuChAzjW4KNEHSnMwUhaqL2tB7VWiFSZSdTKcbjT2WDXEGFTvSCJLEbRQ5EuvyQX2XyUWWHu9HbvXPcujTp" },
  { emoji: "🖼️", what: "Title screen art", provider: "FLUX.2 Pro", micro: 30000, tx: "Uk8eMRN6gXfGMCFUUAFGyrfzQMWMDerLJJmgRUzUFfaxZK1T7i2VWtiBpzNYWdXn758VkiV2J7Z6ziahGp1qxS7" },
  { emoji: "🎵", what: "Soundtrack", provider: "Stable Audio 2.5", micro: 200000, tx: "4G2aUBPC86kVBYngTkCiyq2YbLqPT3RBzfkdrRcscb2hQrmkq8u9jJ9QNaMhhgnhGcVdSXdwWvijY79HejwjqHkk" },
  { emoji: "💥", what: "Crash sound", provider: "ElevenLabs Sound Effects", micro: 4000, tx: "5Ru3mEihwLdpfmCZ5eDYvZyajY4tFrpeX7p2RXs1fLsQcGEoCbyogdHrH1wnPG1xzMeVV55pTHaKsPuJS3jbtkxj" },
  { emoji: "💨", what: "Near-miss whoosh", provider: "ElevenLabs Sound Effects", micro: 2000, tx: "4fj31mek9XXVMJQGXkMW9PcjvuqZSJXxGkaHicuWRUN6gdyAN4T1irYBkN3pmh1xt8wWMtE1KPqNys9BAnoTQNZb" },
  { emoji: "🏁", what: "Engine start", provider: "ElevenLabs Sound Effects", micro: 2000, tx: "289U4A8X5Vf3N3x23fGxaSRQWA8hnUwGF36SLuVUdpkGe3dCD6VF2MrQNyVMreNyXMMNULSKzWh4EWvaBKq9Udk5" },
  { emoji: "🎙️", what: "Announcer: “Go go go!”", provider: "ElevenLabs v4 Turbo", micro: 360, tx: "2Bqf1Z52tjgptcB91DWSExszk6RBncs2DpoEAA65UAAG5wGzyRczdJWkH7ozqiAhKESFAnshPkPWZUgZVR1QMKgX" },
  { emoji: "🎙️", what: "Announcer: “Wrecked! Game over.”", provider: "ElevenLabs v4 Turbo", micro: 760, tx: "2sDarbqvsZHVrREw9i5ncfmHepKQu6iCiE6Z4zQHWPoFmz1RY2Mi6YjhuW4GsGz9f29Yjd1boVc2TaiYXxF26a9w" },
  { emoji: "🚕", what: "Taxi", provider: "Ideogram Transparent Sprites", micro: 30000, tx: "ba2QaB1kJEviNm5v6wMTYsir4ymPdnZV7z7RXKYoaGbDP1MApRQbReZtDdjXTK4MeLj5wEbVaVPpKr1H1DhdpHq" },
  { emoji: "🚓", what: "Police car", provider: "Ideogram Transparent Sprites", micro: 30000, tx: "4NXUDfLFsHT2sEvByxS8wnZvkfVvWg712mGvei88kFEA9q4NkXQSrSpJUGwz9335dtfMbFq6U6YXSP4GVSk1mSRD" },
  { emoji: "🚗", what: "Purple hatchback", provider: "Ideogram Transparent Sprites", micro: 30000, tx: "2PT7mXGuJLxZeYYDJvTwpKtv6tHs71EjMzmbQvYn6iW5RZoaob9Rp8w7J7FyZc35GkcjTzJTHSSty6vxg6ZmyTEf" },
  { emoji: "🚌", what: "City bus", provider: "Ideogram Transparent Sprites", micro: 30000, tx: "5Wvf1E8HhD7ohx59F5Zyity7k3SLL8MTY6oiRxVjjWe8KeVt26kAZ73E1fq5ZkasxmET8j4fxFTwGAcwRrT78otC" },
  { emoji: "🔥", what: "Explosion", provider: "Ideogram Transparent Sprites", micro: 30000, tx: "sbvMQAebAA7EaokThyQymrwXVxnb8jmq9kQQX4FwvKYp4V8mruAbcEzCn3LUBvwx23XgjBCePtkeXdjzE9ay4Jr" },
  { emoji: "🪙", what: "Coin", provider: "Ideogram Transparent Sprites", micro: 30000, tx: "4qkcnpyHuKwNUFhsZh3ne1c97pLshoyNrRDGqzztb8Lr4shBsnm8QJ18shryTefx5oUZsuyMbSHCTThs1RCq1eDu" },
  { emoji: "🛣️", what: "Road texture", provider: "Seamless Tiles", micro: 20000, tx: "2bg1kfGguSLNg4mYhBPdwkFqDt2hSttomQdPFAvL1hzqepJffMJmCmEd3rQtG6xUQGaBCJWShzq5n1okuZA3AyEM" },
  { emoji: "🔔", what: "Coin chime", provider: "ElevenLabs Sound Effects", micro: 2000, tx: "2TiXe7tNptdwv3i8K3sZ8n2dzWRsZpsiZdxYr1FoSncgVEVhKxMyHsvEoNUTvfXWdDFbdghgaqJq7Ntt4RiF6sKY" },
  { emoji: "🎙️", what: "Announcer: “Close call!”", provider: "ElevenLabs v4 Turbo", micro: 440, tx: "5r6YGMH7s8YMH6ENZGEtAbWTNLKUNV4y8xHVpXdmykzbjWTRyrrDzybfWJGHPQCDgRJHhouSdWNSsFZih1CSQwnr" },
  { emoji: "🎙️", what: "Announcer: “Faster! Traffic is picking up!”", provider: "ElevenLabs v4 Turbo", micro: 1200, tx: "3MVrZh8mbQfXjwqso3oq3vnn5oDFopkbMerQd1tcE4onnq4FRuEwjGCrgjZKwE2itb7KEjuTUrSsawKJiYkHhxXU" },
];

export const GAME_TOTAL_MICRO = GAME_PURCHASES.reduce((sum, p) => sum + p.micro, 0);

/** Sub-cent prices keep their digits: "$0.030", "$0.002", "$0.0004". */
export function formatApiUsd(micro: number): string {
  const dollars = micro / 1_000_000;
  return `$${dollars.toFixed(micro < 1000 ? 4 : 3)}`;
}

/** `cost` is what the build spent on top of the Claude plan both sessions ran on. */
export const GAME_BUILDS = {
  plain: { src: "/demo/games/plain/index.html", width: 400, height: 640, cost: "$0", bought: "nothing", madeOf: "Coloured boxes, no sound" },
  rialto: { src: "/demo/games/rialto/index.html", width: 560, height: 840, cost: formatApiUsd(GAME_TOTAL_MICRO), bought: `${GAME_PURCHASES.length} assets`, madeOf: "Title art, sprites, textures, music, sound effects, an announcer" },
} as const;
