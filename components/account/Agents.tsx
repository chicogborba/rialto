"use client";

import { useEffect, useState } from "react";
import { HardButton, Label, Panel, SegTabs } from "@/components/primitives";
import { CopyBlock } from "@/components/site/CopyBlock";
import { api } from "@/lib/client/api";
import { useAccount } from "@/lib/client/account";
import { formatUsd, toMicro } from "@/lib/money";
import type { AccountData } from "@/lib/client/account";
import { Field, inputCls, Notice } from "./ui";

type Client = "claude" | "codex" | "json";
const TABS: { id: Client; label: string }[] = [
  { id: "claude", label: "Claude Code" },
  { id: "codex", label: "Codex" },
  { id: "json", label: "Other (.mcp.json)" },
];
const PROMPTS = [
  "Use rialto to look up the Pokémon charizard.",
  "Use rialto to make a pixel-art sprite sheet for my game's hero.",
  "Ask rialto what services exist for image.sprites and compare them for accuracy.",
  "Check my rialto wallet.",
];

/** The commands that plug an agent's key into a tool. Only ever built from a key shown once on this screen. */
function InstallTabs({ apiKey }: { apiKey: string }) {
  const [tab, setTab] = useState<Client>("claude");
  const [origin, setOrigin] = useState("");
  useEffect(() => {
    let alive = true;
    void Promise.resolve().then(() => alive && setOrigin(window.location.origin));
    return () => {
      alive = false;
    };
  }, []);
  const url = `${origin}/api/mcp`;
  const claude = `claude mcp add --transport http rialto ${url} --header "Authorization: Bearer ${apiKey}"`;
  const codex = `# ~/.codex/config.toml\n[mcp_servers.rialto]\nurl = "${url}"\nbearer_token_env_var = "RIALTO_KEY"\n\n# in your shell profile\nexport RIALTO_KEY="${apiKey}"`;
  const json = `{\n  "mcpServers": {\n    "rialto": {\n      "type": "http",\n      "url": "${url}",\n      "headers": { "Authorization": "Bearer ${apiKey}" }\n    }\n  }\n}`;
  const mask = (text: string) => text.replaceAll(apiKey, `${apiKey.slice(0, 13)}••••••••••••`);
  const value = tab === "claude" ? claude : tab === "codex" ? codex : json;
  return (
    <div className="space-y-3">
      <SegTabs label="Tool" tabs={TABS} value={tab} onChange={setTab} />
      <CopyBlock value={value} display={mask(value)} />
      <p className="font-mono text-[11px] text-muted">
        {tab === "claude" && "Run it once in your terminal. Then start claude and type /mcp to see rialto connected."}
        {tab === "codex" && "Codex reads the token from an environment variable, so the key never sits in the config file."}
        {tab === "json" && "Works with any MCP client that supports remote (streamable HTTP) servers. Claude Code reads this as .mcp.json in your project."}
      </p>
      {origin.includes("localhost") && <p className="border-l-4 border-pay pl-3 font-mono text-[11px] text-muted">You are on localhost, so this only works from this machine.</p>}
    </div>
  );
}

interface Shown {
  agentName: string;
  apiKey: string;
}

/** The one moment a key is visible: copy it now. */
function KeyCard({ shown, onDone }: { shown: Shown; onDone: () => void }) {
  return (
    <Panel title={`Connect “${shown.agentName}”`} tone="default" className="border-signal shadow-hard" bodyClassName="space-y-5">
      <div>
        <Label tone="signal">Your key</Label>
        <CopyBlock className="mt-2" value={shown.apiKey} display={`${shown.apiKey.slice(0, 13)}••••••••••••`} />
        <p className="mt-2 font-mono text-[11px] text-pay">This is the only time the full key is shown. Anyone with it can spend this agent&apos;s money. If you lose it, rotate it.</p>
      </div>
      <div>
        <Label tone="signal">Install it</Label>
        <div className="mt-2">
          <InstallTabs apiKey={shown.apiKey} />
        </div>
      </div>
      <div>
        <Label tone="signal">Then ask for something</Label>
        <ul className="mt-2 grid gap-2 sm:grid-cols-2">
          {PROMPTS.map((p) => (
            <li key={p} className="border border-line bg-ink p-3 text-sm font-medium">
              “{p}”
            </li>
          ))}
        </ul>
      </div>
      <HardButton variant="ghost" onClick={onDone}>
        I saved it
      </HardButton>
    </Panel>
  );
}

type Agent = AccountData["agents"][number];

function AgentCard({ agent, balanceMicro, onKey }: { agent: Agent; balanceMicro: number; onKey: (s: Shown) => void }) {
  const { refresh } = useAccount();
  const [amount, setAmount] = useState("0.50");
  const [limits, setLimits] = useState(false);
  const [f, setF] = useState({ perCall: String(agent.policy.maxPerRequestMicro / 1e6), session: String(agent.policy.sessionBudgetMicro / 1e6), quality: String(agent.policy.minQuality) });
  const [confirm, setConfirm] = useState<"rotate" | "revoke" | null>(null);
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (go: () => Promise<{ ok: boolean; error: string | null }>, ok: string) => {
    setBusy(true);
    setMsg(null);
    const r = await go();
    setBusy(false);
    setConfirm(null);
    setMsg(r.ok ? { tone: "ok", text: ok } : { tone: "error", text: r.error ?? "Something went wrong." });
    if (r.ok) await refresh();
  };
  const move = (direction: "in" | "out") =>
    run(() => api(`/api/account/agents/${agent.id}/fund`, { json: { amountUsd: Number(amount), direction } }), direction === "in" ? `Added ${formatUsd(toMicro(Number(amount)))} to ${agent.name}.` : `Took ${formatUsd(toMicro(Number(amount)))} back to your account.`);
  const saveLimits = () =>
    run(
      () => api(`/api/account/agents/${agent.id}`, { method: "PATCH", json: { policy: { ...agent.policy, maxPerRequestMicro: toMicro(Number(f.perCall)), sessionBudgetMicro: toMicro(Number(f.session)), minQuality: Number(f.quality) } } }),
      "Limits saved.",
    );
  const rotate = async () => {
    setBusy(true);
    const r = await api<{ apiKey: string }>(`/api/account/agents/${agent.id}/key`, { json: {} });
    setBusy(false);
    setConfirm(null);
    if (r.ok && r.data) {
      onKey({ agentName: agent.name, apiKey: r.data.apiKey });
      await refresh();
    } else setMsg({ tone: "error", text: r.error ?? "Could not rotate the key." });
  };
  const revoke = () => run(() => api(`/api/account/agents/${agent.id}`, { method: "DELETE" }), "Revoked.");
  const spendPct = agent.policy.sessionBudgetMicro > 0 ? Math.min(100, (agent.sessionSpendMicro / agent.policy.sessionBudgetMicro) * 100) : 0;

  return (
    <Panel title={agent.name} status={<span className="font-mono text-[10px] text-muted">{agent.keyPrefix}…</span>} bodyClassName="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <Label>Balance</Label>
          <p className="tnum mt-1 font-mono text-2xl font-bold">{formatUsd(agent.balanceMicro)}</p>
        </div>
        <div>
          <Label>Spent this session</Label>
          <p className="tnum mt-1 font-mono text-2xl font-bold">{formatUsd(agent.sessionSpendMicro)}</p>
          <div className="mt-2 h-1.5 bg-line" role="presentation">
            <div className="h-full bg-signal" style={{ width: `${spendPct}%` }} />
          </div>
          <p className="mt-1 font-mono text-[10px] text-muted">of {formatUsd(agent.policy.sessionBudgetMicro)}</p>
        </div>
        <div>
          <Label>May spend per call</Label>
          <p className="tnum mt-1 font-mono text-2xl font-bold">{formatUsd(agent.policy.maxPerRequestMicro)}</p>
          <p className="mt-2 font-mono text-[10px] text-muted">quality ≥ {agent.policy.minQuality}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="block">
          <Label>Amount (USD)</Label>
          <input className={`${inputCls} w-28`} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} />
        </label>
        <HardButton onClick={() => move("in")} disabled={busy || !(Number(amount) > 0) || balanceMicro < toMicro(Number(amount))}>
          Add from account
        </HardButton>
        <HardButton variant="ghost" onClick={() => move("out")} disabled={busy || !(Number(amount) > 0) || agent.balanceMicro < toMicro(Number(amount))}>
          Take back
        </HardButton>
        <span className="font-mono text-[11px] text-muted">Account has {formatUsd(balanceMicro)}</span>
      </div>

      {limits && (
        <div className="grid gap-4 border border-line bg-ink p-4 sm:grid-cols-3">
          <Field label="Max per call (USD)">
            <input className={inputCls} inputMode="decimal" value={f.perCall} onChange={(e) => setF({ ...f, perCall: e.target.value.replace(/[^0-9.]/g, "") })} />
          </Field>
          <Field label="Session budget (USD)">
            <input className={inputCls} inputMode="decimal" value={f.session} onChange={(e) => setF({ ...f, session: e.target.value.replace(/[^0-9.]/g, "") })} />
          </Field>
          <Field label="Min quality (0–100)">
            <input className={inputCls} inputMode="numeric" value={f.quality} onChange={(e) => setF({ ...f, quality: e.target.value.replace(/[^0-9]/g, "") })} />
          </Field>
          <div className="sm:col-span-3">
            <HardButton onClick={saveLimits} disabled={busy}>
              Save limits
            </HardButton>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
        <HardButton variant="ghost" onClick={() => setLimits((v) => !v)}>
          {limits ? "Hide limits" : "Spending limits"}
        </HardButton>
        {confirm === "rotate" ? (
          <HardButton variant="pay" onClick={rotate} disabled={busy}>
            Replace the key? The old one stops now
          </HardButton>
        ) : (
          <HardButton variant="ghost" onClick={() => setConfirm("rotate")}>
            Get the connect command
          </HardButton>
        )}
        {confirm === "revoke" ? (
          <HardButton variant="pay" onClick={revoke} disabled={busy}>
            Revoke for good? {agent.balanceMicro > 0 ? `${formatUsd(agent.balanceMicro)} returns to your account` : ""}
          </HardButton>
        ) : (
          <HardButton variant="ghost" onClick={() => setConfirm("revoke")}>
            Revoke
          </HardButton>
        )}
        {confirm && (
          <button type="button" onClick={() => setConfirm(null)} className="font-mono text-[11px] underline hover:text-signal">
            Cancel
          </button>
        )}
      </div>
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
    </Panel>
  );
}

export function Agents() {
  const { account, refresh } = useAccount();
  const [name, setName] = useState("My Claude Code");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shown, setShown] = useState<Shown | null>(null);
  if (!account) return null;

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = await api<{ apiKey: string }>("/api/account/agents", { json: { name } });
    setBusy(false);
    if (!r.ok || !r.data) return setError(r.error);
    setShown({ agentName: name, apiKey: r.data.apiKey });
    await refresh();
  };

  return (
    <div className="space-y-8">
      <header>
        <Label tone="signal">Agents</Label>
        <h1 className="mt-3 text-[clamp(2.2rem,6vw,4.5rem)] font-bold uppercase leading-[0.9] tracking-[-0.05em]">
          Give your agent <span className="sy-mark">a marketplace.</span>
        </h1>
        <p className="mt-4 max-w-2xl text-lg font-medium">Each agent is a key for Claude Code or Codex with its own money and spending limits. You decide how much it gets; it can never spend more than that.</p>
      </header>

      {shown && <KeyCard shown={shown} onDone={() => setShown(null)} />}

      <form onSubmit={create} className="flex flex-wrap items-end gap-3 border border-line bg-surface p-4">
        <Field label="Name a new agent" className="min-w-64 flex-1">
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
        </Field>
        <HardButton type="submit" disabled={busy || name.trim().length < 1}>
          {busy ? "Creating…" : "Create agent"}
        </HardButton>
        {error && <Notice tone="error">{error}</Notice>}
      </form>

      {account.agents.length === 0 ? (
        <p className="font-mono text-xs text-muted">No agents yet. Create one above, then follow the steps that appear.</p>
      ) : (
        <div className="space-y-6">
          {account.agents.map((a) => (
            <AgentCard key={a.id} agent={a} balanceMicro={account.user.balanceMicro} onKey={setShown} />
          ))}
        </div>
      )}
    </div>
  );
}
