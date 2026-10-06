"use client";

import { useCallback, useEffect, useState } from "react";
import { HardButton, Label, ModeBadge, Panel, SegTabs } from "@/components/primitives";
import { CopyBlock } from "@/components/site/CopyBlock";
import { Step } from "@/components/site/PageShell";
import { api } from "@/lib/client/api";
import { clearKey, getKey, setKey } from "@/lib/client/keys";
import { formatUsd } from "@/lib/money";
import type { TransactionRow } from "@/lib/api-types";

interface Me {
  wallet: { balanceMicro: number; sessionSpendMicro: number };
  mode: "simulated" | "live";
  recent: TransactionRow[];
}

type Client = "claude" | "codex" | "json";
const TABS: { id: Client; label: string }[] = [
  { id: "claude", label: "Claude Code" },
  { id: "codex", label: "Codex" },
  { id: "json", label: "Other (.mcp.json)" },
];

const PROMPTS = [
  "Use switchyard to make a pixel-art sprite sheet for my game's hero.",
  "Use switchyard to look up the Pokémon charizard.",
  "Ask switchyard what services exist for image.sprites and compare them for accuracy.",
  "Check my switchyard wallet.",
];

export function ConnectFlow() {
  const [origin, setOrigin] = useState("http://localhost:3000");
  const [key, setKeyState] = useState<string | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [name, setName] = useState("My agent");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Client>("claude");
  const [reveal, setReveal] = useState(false);

  const load = useCallback(async (k: string) => {
    const r = await api<Me>("/api/agents/me", { key: k });
    if (r.ok) setMe(r.data);
    else if (r.status === 401) {
      clearKey("buyer");
      setKeyState(null);
    }
  }, []);

  // read browser-only state after mount (a microtask keeps the first render identical to the server's)
  useEffect(() => {
    let alive = true;
    void Promise.resolve().then(() => {
      if (!alive) return;
      setOrigin(window.location.origin);
      const k = getKey("buyer");
      setKeyState(k);
      if (k) void load(k);
    });
    return () => {
      alive = false;
    };
  }, [load]);

  const create = async () => {
    setBusy(true);
    setError(null);
    const r = await api<{ apiKey: string }>("/api/agents", { json: { name } });
    setBusy(false);
    if (!r.ok || !r.data) return setError(r.error);
    setKey("buyer", r.data.apiKey);
    setKeyState(r.data.apiKey);
    setReveal(true);
    void load(r.data.apiKey);
  };

  const topUp = async () => {
    if (!key) return;
    await api("/api/agents/me/topup", { key, json: { amountUsd: 1 } });
    void load(key);
  };

  const shown = key ? (reveal ? key : `${key.slice(0, 13)}••••••••••••`) : "";
  const url = `${origin}/api/mcp`;
  const claude = `claude mcp add --transport http switchyard ${url} --header "Authorization: Bearer ${key ?? "YOUR_KEY"}"`;
  const claudeShown = `claude mcp add --transport http switchyard ${url} --header "Authorization: Bearer ${shown || "YOUR_KEY"}"`;
  const codexCfg = (k: string) => `# ~/.codex/config.toml\n[mcp_servers.switchyard]\nurl = "${url}"\nbearer_token_env_var = "SWITCHYARD_KEY"\n\n# in your shell profile\nexport SWITCHYARD_KEY="${k}"`;
  const json = (k: string) => `{\n  "mcpServers": {\n    "switchyard": {\n      "type": "http",\n      "url": "${url}",\n      "headers": { "Authorization": "Bearer ${k}" }\n    }\n  }\n}`;

  return (
    <div>
      <header className="pb-8">
        <Label tone="signal">For people who use Claude Code / Codex</Label>
        <h1 className="mt-3 text-[clamp(2.6rem,8vw,6.5rem)] font-bold uppercase leading-[0.86] tracking-[-0.05em]">
          Give your agent <span className="sy-mark">a marketplace.</span>
        </h1>
        <p className="mt-5 max-w-2xl text-xl font-medium">One command. Your agent gets a wallet and can hire any API on Switchyard, paying per call. No account on each API, no key juggling. 🛒</p>
      </header>

      <Step n="01" title="Get your key">
        {!key ? (
          <div className="flex flex-wrap items-end gap-3">
            <label className="block">
              <Label>Name this agent</Label>
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} className="mt-2 block min-h-11 w-64 border border-line-hi bg-ink px-3 text-base focus-visible:border-signal" />
            </label>
            <HardButton onClick={create} disabled={busy || name.trim().length < 1}>{busy ? "Creating…" : "Create my key"}</HardButton>
            {error && <p role="alert" className="font-mono text-xs text-fail">{error}</p>}
          </div>
        ) : (
          <div className="space-y-3">
            <CopyBlock value={key} display={shown} />
            <div className="flex flex-wrap items-center gap-4 font-mono text-[11px]">
              <button type="button" onClick={() => setReveal((r) => !r)} className="underline hover:text-signal">{reveal ? "Hide key" : "Show key"}</button>
              <span className="text-muted">Saved in this browser only. Anyone with this key can spend your balance, so treat it like a password.</span>
            </div>
          </div>
        )}
      </Step>

      <Step n="02" title="Install it in your tool">
        <SegTabs label="Tool" tabs={TABS} value={tab} onChange={setTab} />
        {tab === "claude" && (
          <div className="space-y-2">
            <CopyBlock value={claude} display={claudeShown} />
            <p className="font-mono text-[11px] text-muted">Run it once in your terminal. Then start <code>claude</code> and type <code>/mcp</code> to see switchyard connected.</p>
          </div>
        )}
        {tab === "codex" && (
          <div className="space-y-2">
            <CopyBlock value={codexCfg(key ?? "YOUR_KEY")} display={codexCfg(shown || "YOUR_KEY")} />
            <p className="font-mono text-[11px] text-muted">Codex reads the token from an environment variable, so the key never sits in the config file.</p>
          </div>
        )}
        {tab === "json" && (
          <div className="space-y-2">
            <CopyBlock value={json(key ?? "YOUR_KEY")} display={json(shown || "YOUR_KEY")} />
            <p className="font-mono text-[11px] text-muted">Works with any MCP client that supports remote (streamable HTTP) servers. Claude Code reads this as <code>.mcp.json</code> in your project.</p>
          </div>
        )}
        {origin.includes("localhost") && (
          <p className="border-l-4 border-pay pl-3 font-mono text-[11px] text-muted">You&apos;re on localhost, so this only works from this machine. A deployed Switchyard gives you a public URL.</p>
        )}
      </Step>

      <Step n="03" title="Ask for something">
        <ul className="grid gap-2 sm:grid-cols-2">
          {PROMPTS.map((p) => (
            <li key={p} className="border border-line bg-surface p-3 text-sm font-medium">&ldquo;{p}&rdquo;</li>
          ))}
        </ul>
        <p className="font-mono text-[11px] text-muted">Your agent plans the job, picks the best provider within your budget, pays, and gives you the result. You see every cent in the wallet below.</p>
      </Step>

      <Step n="04" title="Your wallet">
        {!me ? (
          <p className="font-mono text-xs text-muted">Create a key to get a wallet.</p>
        ) : (
          <Panel title="Agent wallet" status={<ModeBadge mode={me.mode} />} bodyClassName="space-y-4">
            <div className="grid grid-cols-2 gap-4 font-mono">
              <div><Label>Balance</Label><div className="tnum mt-1 text-3xl font-bold">{formatUsd(me.wallet.balanceMicro)}</div></div>
              <div><Label>Session spend</Label><div className="tnum mt-1 text-3xl font-bold">{formatUsd(me.wallet.sessionSpendMicro)}</div></div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {me.mode === "simulated" && <HardButton variant="ghost" onClick={topUp}>+ $1 test credit</HardButton>}
              <button type="button" onClick={() => key && load(key)} className="font-mono text-[11px] underline hover:text-signal">Refresh</button>
              <span className="font-mono text-[11px] text-muted">{me.mode === "simulated" ? "Simulated money: nothing touches a blockchain yet." : "Live: real USDC."}</span>
            </div>
            <div>
              <Label>Recent calls</Label>
              {me.recent.length === 0 ? (
                <p className="mt-2 font-mono text-xs text-muted">None yet. Ask your agent for something.</p>
              ) : (
                <ul className="mt-2 divide-y divide-line font-mono text-xs">
                  {me.recent.map((t) => (
                    <li key={t.id} className="flex items-center justify-between gap-3 py-2">
                      <span className="min-w-0 truncate">{t.providerName} · {t.capability}</span>
                      <span className="tnum shrink-0">{t.status === "settled" ? formatUsd(t.amountMicro) : "not charged"}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Panel>
        )}
      </Step>
    </div>
  );
}
