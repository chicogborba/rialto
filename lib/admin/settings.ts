import type { PrismaClient } from "@prisma/client";
import { decryptSecret, encryptSecret } from "@/lib/security/secrets";
import { isSolanaAddress } from "@/lib/x402/solana";

/**
 * What the operator can change from /admin without touching the server. Every entry is also an
 * environment variable of the same name: a value saved here overrides the environment, and
 * clearing it brings the environment's value back. The network and the payment mode stay in the
 * environment on purpose (the pages are built for one network).
 */
export type SettingGroup = "keys" | "wallets" | "pricing" | "network";

export interface SettingDef {
  key: string;
  label: string;
  group: SettingGroup;
  hint: string;
  secret?: boolean;
  kind: "text" | "address" | "number" | "url";
  /** for numbers: inclusive bounds */
  min?: number;
  max?: number;
}

export const SETTING_DEFS: SettingDef[] = [
  { key: "FAL_KEY", label: "fal.ai API key", group: "keys", secret: true, kind: "text", hint: "Runs the ~50 image, audio, video, 3D and language integrations. Each call spends this account's fal balance." },
  { key: "ELEVENLABS_API_KEY", label: "ElevenLabs API key", group: "keys", secret: true, kind: "text", hint: "The direct ElevenLabs voice integration (optional: fal already sells ElevenLabs models)." },
  { key: "TRIPO_API_KEY", label: "Tripo API key", group: "keys", secret: true, kind: "text", hint: "The direct Tripo 3D integration (optional)." },
  { key: "PLATFORM_FEE_PAYTO", label: "Commission wallet", group: "wallets", kind: "address", hint: "Where every purchase pays Rialto's commission. An address only; it needs a USDC account on the network." },
  { key: "SOLANA_PAY_TO", label: "Integrations payout wallet", group: "wallets", kind: "address", hint: "Where buyers pay for Rialto's own integrations (fal cost + margin). Also needs a USDC account." },
  { key: "OPERATOR_MARGIN_PCT", label: "Margin over the API cost (%)", group: "pricing", kind: "number", min: 0, max: 1000, hint: "Seller price of Rialto's integrations = fal's price × (1 + margin), rounded up to $0.001. Default 15." },
  { key: "PLATFORM_FEE_BPS", label: "Commission (basis points)", group: "pricing", kind: "number", min: 0, max: 5000, hint: "Paid by the buyer on top of every seller's price, Rialto's included. 500 = 5%. Default 500." },
  { key: "PLATFORM_MIN_FEE_MICRO", label: "Minimum commission (micro-USDC)", group: "pricing", kind: "number", min: 0, max: 1_000_000, hint: "Floor of the commission per call. 1000 = $0.001. Default 1000." },
  { key: "OPERATOR_DAILY_CAP_USD", label: "Daily limit of integration sales (USD)", group: "pricing", kind: "number", min: 0, max: 100_000, hint: "The most Rialto's integrations may sell in 24 h, at seller price: a ceiling on what fal can bill you in a day. Default 5." },
  { key: "SOLANA_RPC_URL", label: "Solana RPC URL", group: "network", kind: "url", hint: "A private RPC (Helius, QuickNode, Triton). The public one rate-limits on mainnet." },
  { key: "X402_FACILITATOR_URL", label: "x402 facilitator URL", group: "network", kind: "url", hint: "Leave empty for the network's default (x402.org on devnet, PayAI on mainnet)." },
];

const DEF = new Map(SETTING_DEFS.map((d) => [d.key, d]));
export const settingDef = (key: string): SettingDef | undefined => DEF.get(key);

declare global {
  var __rialtoEnvBase: Record<string, string | undefined> | undefined;
}

/** The environment as the process started, before any saved setting was applied. */
function envBase(): Record<string, string | undefined> {
  return (globalThis.__rialtoEnvBase ??= Object.fromEntries(SETTING_DEFS.map((d) => [d.key, process.env[d.key]])));
}

/** Checks and normalises a value typed in /admin; throws a message meant for the operator. */
export function normaliseSetting(def: SettingDef, raw: string): string {
  const value = raw.trim();
  if (!value) return "";
  if (value.length > 2_000) throw new Error(`${def.label}: too long`);
  if (def.kind === "address" && !isSolanaAddress(value)) throw new Error(`${def.label}: not a Solana address`);
  if (def.kind === "url") {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new Error(`${def.label}: not a URL`);
    }
    if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) throw new Error(`${def.label}: must be https`);
  }
  if (def.kind === "number") {
    const n = Number(value);
    if (!Number.isFinite(n) || n < (def.min ?? -Infinity) || n > (def.max ?? Infinity)) throw new Error(`${def.label}: a number from ${def.min} to ${def.max}`);
    return String(n);
  }
  return value;
}

/** "fal_…a1b2": enough to recognise a key, never enough to use it. */
export function maskSecret(value: string): string {
  if (!value) return "";
  return value.length <= 8 ? "••••" : `${value.slice(0, 3)}…${value.slice(-4)}`;
}

export interface SettingView {
  key: string;
  label: string;
  group: SettingGroup;
  hint: string;
  kind: SettingDef["kind"];
  secret: boolean;
  /** the effective value; masked for secrets */
  value: string;
  /** where the effective value comes from */
  source: "admin" | "env" | "unset";
  updatedAt: string | null;
  updatedBy: string | null;
}

/** Every setting as /admin shows it. Secrets never leave the server in clear. */
export async function listSettings(prisma: PrismaClient): Promise<SettingView[]> {
  const rows = new Map((await prisma.setting.findMany()).map((r) => [r.key, r]));
  const base = envBase();
  return SETTING_DEFS.map((def) => {
    const row = rows.get(def.key);
    let saved: string | null = null;
    if (row) {
      try {
        saved = row.secret ? decryptSecret(row.value) : row.value;
      } catch {
        saved = null;
      }
    }
    const fromEnv = base[def.key]?.trim() ?? "";
    const value = saved ?? fromEnv;
    return {
      key: def.key,
      label: def.label,
      group: def.group,
      hint: def.hint,
      kind: def.kind,
      secret: Boolean(def.secret),
      value: def.secret ? maskSecret(value) : value,
      source: saved !== null ? "admin" : fromEnv ? "env" : "unset",
      updatedAt: row?.updatedAt.toISOString() ?? null,
      updatedBy: row?.updatedBy ?? null,
    };
  });
}

/**
 * Puts the saved settings into this process's environment, so every part of the server that reads
 * `process.env` (prices, the payment rail, the integrations) sees them. Runs at start and after
 * each change. Returns the keys that came from the database.
 */
export async function applySettings(prisma: PrismaClient): Promise<string[]> {
  const base = envBase();
  const rows = await prisma.setting.findMany();
  const saved = new Map<string, string>();
  for (const row of rows) {
    if (!DEF.has(row.key)) continue;
    try {
      saved.set(row.key, row.secret ? decryptSecret(row.value) : row.value);
    } catch {
      console.error(`[settings] could not decrypt ${row.key}: was SECRETS_KEY changed?`);
    }
  }
  for (const def of SETTING_DEFS) {
    const value = saved.get(def.key) ?? base[def.key];
    if (value === undefined || value === "") delete process.env[def.key];
    else process.env[def.key] = value;
  }
  // the live gateway caches its configuration (fee address, facilitator, RPC): rebuild it on next use
  globalThis.__rialtoLiveGateway = undefined;
  return [...saved.keys()];
}

/** Saves (or, with an empty value, clears) settings. Values are checked first; nothing is written if one is wrong. */
export async function saveSettings(prisma: PrismaClient, changes: Record<string, string>, by: string): Promise<string[]> {
  const writes: { key: string; value: string; secret: boolean }[] = [];
  for (const [key, raw] of Object.entries(changes)) {
    const def = DEF.get(key);
    if (!def) throw new Error(`Unknown setting ${key}`);
    if (typeof raw !== "string") throw new Error(`${def.label}: must be text`);
    writes.push({ key, value: normaliseSetting(def, raw), secret: Boolean(def.secret) });
  }
  await prisma.$transaction(
    writes.map((w) =>
      w.value === ""
        ? prisma.setting.deleteMany({ where: { key: w.key } })
        : prisma.setting.upsert({
            where: { key: w.key },
            create: { key: w.key, value: w.secret ? encryptSecret(w.value) : w.value, secret: w.secret, updatedBy: by },
            update: { value: w.secret ? encryptSecret(w.value) : w.value, secret: w.secret, updatedBy: by },
          }),
    ),
  );
  return writes.map((w) => w.key);
}
