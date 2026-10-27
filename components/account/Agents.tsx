"use client";

import { Gauge, KeyRound, Plus, SlidersHorizontal, Trash2, Wallet } from "lucide-react";
import { useEffect, useState } from "react";
import { AgentAvatar } from "@/components/agents/AgentAvatar";
import { cssHex, describeLook, lookFor } from "@/components/agents/critter";
import { HardButton, SegTabs } from "@/components/primitives";
import { Modal } from "@/components/shell/Modal";
import { CopyBlock } from "@/components/site/CopyBlock";
import { api } from "@/lib/client/api";
import { usePayWalletAvailable } from "@/lib/client/pay-wallet";
import { useAccount } from "@/lib/client/account";
import { formatUsd, toMicro } from "@/lib/money";
import type { AccountData } from "@/lib/client/account";
import { cn } from "@/lib/utils";
import { Field, inputCls, Notice, PageHead } from "./ui";

type Client = "claude" | "codex" | "json" | "signer";
const TABS: { id: Client; label: string }[] = [
  { id: "claude", label: "Claude Code" },
  { id: "codex", label: "Codex" },
  { id: "json", label: "Other (.mcp.json)" },
  { id: "signer", label: "Local signer" },
];
const PROMPTS = ["Use rialto to look up the Pokémon charizard.", "Use rialto to make a pixel-art sprite sheet for my game's hero.", "Ask rialto which image APIs exist and compare them.", "Check my rialto wallet."];

type Agent = AccountData["agents"][number];
interface Shown {
  agentId: string;
  agentName: string;
  apiKey: string;
}

/** The tinted backdrop behind a critter: its own colour, washed into the cream. */
const tint = (seed: string, pct = 20) => `color-mix(in oklab, ${cssHex(lookFor(seed).color.hex)} ${pct}%, #f6efe0)`;

/** The commands that plug an agent's key into a tool. Only ever built from a key shown once on this screen. */
function InstallTabs({ apiKey }: { apiKey: string }) {
  const { account } = useAccount();
  const live = account?.mode === "live";
  const linkable = usePayWalletAvailable();
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
  const signer = `# once: the signer runs on your machine, with your wallet\ngit clone https://github.com/chicogborba/rialto && cd rialto && npm install\n\n# then, from that folder\nclaude mcp add rialto -e RIALTO_URL=${origin} -e RIALTO_KEY=${apiKey} -e SOLANA_WALLET_KEY=<secret key of a wallet that holds USDC> -- npx tsx mcp/server.ts`;
  const mask = (text: string) => text.replaceAll(apiKey, `${apiKey.slice(0, 13)}••••••••••••`);
  const value = tab === "signer" ? signer : tab === "claude" ? claude : tab === "codex" ? codex : json;
  const tabs = live ? TABS : TABS.filter((t) => t.id !== "signer");
  return (
    <div className="space-y-3">
      <SegTabs label="Tool" tabs={tabs} value={tab} onChange={setTab} />
      <CopyBlock value={value} display={mask(value)} />
      <p className="text-sm text-coal/70">
        {tab === "signer" && "For developers who keep a wallet key on their own machine instead of approving a limit in Wallet. The wallet needs USDC and no SOL."}
        {tab === "claude" && (live && linkable ? "Run it once in your terminal. Your agent pays from the wallet you connect in Wallet, within the limit you approve." : "Run it once in your terminal, then type /mcp inside claude to see rialto connected.")}
        {tab === "codex" && "Codex reads the token from an environment variable, so the key never sits in the config file."}
        {tab === "json" && "Any MCP client that supports remote (streamable HTTP) servers. Claude Code reads this as .mcp.json in your project."}
      </p>
      {origin.includes("localhost") && <p className="border-l-4 border-pay pl-3 text-sm text-coal/70">You are on localhost, so this only works from this machine.</p>}
    </div>
  );
}

/** The one moment a key is visible: copy it, install it, try it. */
function KeyStep({ shown }: { shown: Shown }) {
  return (
    <div className="space-y-6">
      <section>
        <Step n={1} title="Copy the key" />
        <CopyBlock className="mt-3" value={shown.apiKey} display={`${shown.apiKey.slice(0, 13)}••••••••••••`} />
        <p className="mt-2 text-sm font-medium text-pay">Shown only this once. Anyone with it can spend within this agent&apos;s limits; if you lose it, get a new one.</p>
      </section>
      <section>
        <Step n={2} title="Plug it into your agent" />
        <div className="mt-3">
          <InstallTabs apiKey={shown.apiKey} />
        </div>
      </section>
      <section>
        <Step n={3} title="Ask for something" />
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {PROMPTS.map((p) => (
            <li key={p} className="border-2 border-coal/15 bg-surface p-3 text-sm font-medium">
              “{p}”
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Step({ n, title }: { n: number; title: string }) {
  return (
    <h3 className="flex items-center gap-2.5 text-lg font-bold tracking-[-0.02em]">
      <span className="grid size-7 place-items-center border-2 border-coal bg-lime font-mono text-xs">{n}</span>
      {title}
    </h3>
  );
}

/** Create: name it, meet the critter it rolled, then connect it. */
function CreateAgent({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { refresh } = useAccount();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shown, setShown] = useState<Shown | null>(null);
  const [stage, setStage] = useState<"name" | "meet" | "key">("name");

  // a fresh flow each time it opens: the parent remounts it with a new key
  const close = onClose;
  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const n = name.trim() || "My agent";
    const r = await api<{ agentId: string; apiKey: string }>("/api/account/agents", { json: { name: n } });
    setBusy(false);
    if (!r.ok || !r.data) return setError(r.error);
    setShown({ agentId: r.data.agentId, agentName: n, apiKey: r.data.apiKey });
    setStage("meet");
    await refresh();
  };

  return (
    <Modal open={open} onOpenChange={(o) => !o && close()} kicker={stage === "name" ? "New agent" : stage === "meet" ? "It's alive" : "Connect it"} title={stage === "name" ? "Name your agent" : shown?.agentName ?? ""} wide={stage === "key"}>
      {stage === "name" && (
        <form onSubmit={create} className="space-y-5">
          <div className="grid place-items-center border-2 border-dashed border-coal/30 bg-sand/50 py-8">
            <span aria-hidden className="grid size-28 place-items-center border-2 border-coal bg-surface font-mono text-5xl font-bold shadow-[4px_4px_0_var(--color-coal)]">?</span>
            <p className="mt-4 text-sm font-medium text-coal/70">Every agent hatches with its own look.</p>
          </div>
          <Field label="Name">
            <input autoFocus className={inputCls} value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="Game builder, Research bot…" />
          </Field>
          <p className="text-sm text-coal/70">An agent is a key for Claude Code, Codex or any MCP client, with its own spending limits.</p>
          <div className="flex flex-wrap items-center gap-3">
            <HardButton type="submit" disabled={busy}>
              {busy ? "Hatching…" : "Create agent"}
            </HardButton>
            {error && <Notice tone="error">{error}</Notice>}
          </div>
        </form>
      )}
      {stage === "meet" && shown && (
        <div className="space-y-5 text-center">
          <div className="sy-confetti relative mx-auto max-w-sm border-2 border-coal" style={{ background: tint(shown.agentId) }}>
            <AgentAvatar seed={shown.agentId} live reveal className="w-full" />
          </div>
          <div>
            <p className="text-2xl font-bold tracking-[-0.03em]">Meet {shown.agentName}.</p>
            <p className="mt-1 text-sm text-coal/70">A {describeLook(lookFor(shown.agentId))}.</p>
          </div>
          <HardButton onClick={() => setStage("key")}>Connect it</HardButton>
        </div>
      )}
      {stage === "key" && shown && (
        <div className="space-y-6">
          <KeyStep shown={shown} />
          <HardButton onClick={close}>I saved the key</HardButton>
        </div>
      )}
    </Modal>
  );
}

type Tab = "overview" | "limits" | "key" | "remove";

/** One agent, opened: how it is spending, its limits, its key, and the way out. */
function AgentSheet({ agent, onClose }: { agent: Agent | null; onClose: () => void }) {
  const [last, setLast] = useState<Agent | null>(agent);
  if (agent && agent !== last) setLast(agent);
  const a = agent ?? last;
  return (
    <Modal open={agent !== null} onOpenChange={(o) => !o && onClose()} kicker="Agent" title={a?.name ?? ""} wide>
      {a && <AgentBody key={a.id} agent={a} onClose={onClose} />}
    </Modal>
  );
}

function AgentBody({ agent, onClose }: { agent: Agent; onClose: () => void }) {
  const { account, refresh } = useAccount();
  const credits = account?.mode !== "live";
  const [tab, setTab] = useState<Tab>("overview");
  const [amount, setAmount] = useState("0.50");
  const [f, setF] = useState({ perCall: String(agent.policy.maxPerRequestMicro / 1e6), session: String(agent.policy.sessionBudgetMicro / 1e6), quality: String(agent.policy.minQuality) });
  const [confirm, setConfirm] = useState(false);
  const [shown, setShown] = useState<Shown | null>(null);
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const look = lookFor(agent.id);

  const run = async (go: () => Promise<{ ok: boolean; error: string | null }>, ok: string) => {
    setBusy(true);
    setMsg(null);
    const r = await go();
    setBusy(false);
    setMsg(r.ok ? { tone: "ok", text: ok } : { tone: "error", text: r.error ?? "Something went wrong." });
    if (r.ok) await refresh();
    return r.ok;
  };
  const move = (direction: "in" | "out") => run(() => api(`/api/account/agents/${agent.id}/fund`, { json: { amountUsd: Number(amount), direction } }), direction === "in" ? `Added ${formatUsd(toMicro(Number(amount)))}.` : `Took ${formatUsd(toMicro(Number(amount)))} back to your account.`);
  const saveLimits = () => run(() => api(`/api/account/agents/${agent.id}`, { method: "PATCH", json: { policy: { ...agent.policy, maxPerRequestMicro: toMicro(Number(f.perCall)), sessionBudgetMicro: toMicro(Number(f.session)), minQuality: Number(f.quality) } } }), "Limits saved.");
  const rotate = async () => {
    setBusy(true);
    setMsg(null);
    const r = await api<{ apiKey: string }>(`/api/account/agents/${agent.id}/key`, { json: {} });
    setBusy(false);
    setConfirm(false);
    if (r.ok && r.data) {
      setShown({ agentId: agent.id, agentName: agent.name, apiKey: r.data.apiKey });
      await refresh();
    } else setMsg({ tone: "error", text: r.error ?? "Could not make a new key." });
  };
  const revoke = async () => {
    if (await run(() => api(`/api/account/agents/${agent.id}`, { method: "DELETE" }), "Removed.")) onClose();
  };
  const pick = (t: Tab) => {
    setTab(t);
    setMsg(null);
    setConfirm(false);
  };
  const spendPct = agent.policy.sessionBudgetMicro > 0 ? Math.min(100, (agent.sessionSpendMicro / agent.policy.sessionBudgetMicro) * 100) : 0;
  const tabs: { id: Tab; label: string; icon: typeof Gauge }[] = [
    { id: "overview", label: "Overview", icon: Gauge },
    { id: "limits", label: "Limits", icon: SlidersHorizontal },
    { id: "key", label: "Key", icon: KeyRound },
    { id: "remove", label: "Remove", icon: Trash2 },
  ];

  return (
    <div className="grid gap-6 md:grid-cols-[260px_1fr]">
      <div className="space-y-3">
        <div className="border-2 border-coal max-md:mx-auto max-md:max-w-[240px]" style={{ background: tint(agent.id) }}>
          <AgentAvatar seed={agent.id} live className="w-full" />
        </div>
        <p className="text-sm text-coal/70">A {describeLook(look)}.</p>
        <p className="font-mono text-[11px] text-coal/60">
          Key {agent.keyPrefix}… · since {new Date(agent.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
        </p>
      </div>

      <div className="min-w-0 space-y-5">
        <div role="tablist" aria-label="Agent" className="flex gap-1 overflow-x-auto border-b-2 border-coal [scrollbar-width:none]">
          {tabs.map((t) => (
            <button key={t.id} role="tab" type="button" aria-selected={tab === t.id} onClick={() => pick(t.id)} className={cn("-mb-0.5 flex shrink-0 items-center gap-1.5 border-2 border-b-0 px-3 py-2 text-[15px] font-bold", tab === t.id ? "border-coal bg-lime" : "border-transparent text-coal/60 hover:text-coal")}>
              <t.icon className="size-4" strokeWidth={2.4} aria-hidden />
              {t.label}
            </button>
          ))}
        </div>

        {tab === "overview" && (
          <div className="space-y-5">
            <div>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-bold">Spent this session</span>
                <span className="tnum font-mono text-sm">
                  {formatUsd(agent.sessionSpendMicro)} <span className="text-coal/50">of {formatUsd(agent.policy.sessionBudgetMicro)}</span>
                </span>
              </div>
              <div className="mt-2 h-3 border-2 border-coal bg-surface" role="progressbar" aria-valuenow={Math.round(spendPct)} aria-valuemin={0} aria-valuemax={100}>
                <div className="h-full bg-lime" style={{ width: `${spendPct}%` }} />
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-3">
              <Fact label="Max per call" value={formatUsd(agent.policy.maxPerRequestMicro)} />
              <Fact label="Min quality" value={`${agent.policy.minQuality} / 100`} />
              {credits && <Fact label="Balance" value={formatUsd(agent.balanceMicro)} />}
              {!credits && <Fact label="Pays from" value={account?.user.payWallet ? "Your wallet" : "No wallet yet"} />}
            </dl>
            {credits && (
              <div className="space-y-3 border-2 border-coal/15 bg-surface p-4">
                <p className="flex items-center gap-2 text-sm font-bold">
                  <Wallet className="size-4" aria-hidden /> Move test money
                </p>
                <div className="flex flex-wrap items-end gap-3">
                  <label className="block">
                    <span className="sr-only">Amount in dollars</span>
                    <input className={cn(inputCls, "mt-0 w-28")} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} />
                  </label>
                  <HardButton onClick={() => move("in")} disabled={busy || !(Number(amount) > 0) || (account?.user.balanceMicro ?? 0) < toMicro(Number(amount))}>
                    Add
                  </HardButton>
                  <HardButton variant="ghost" onClick={() => move("out")} disabled={busy || !(Number(amount) > 0) || agent.balanceMicro < toMicro(Number(amount))}>
                    Take back
                  </HardButton>
                </div>
                <p className="font-mono text-[11px] text-coal/60">Account has {formatUsd(account?.user.balanceMicro ?? 0)}</p>
              </div>
            )}
          </div>
        )}

        {tab === "limits" && (
          <div className="space-y-4">
            <p className="text-sm text-coal/70">Your agent can never spend more than this, whatever it reads or is told.</p>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Max per call (USD)">
                <input className={inputCls} inputMode="decimal" value={f.perCall} onChange={(e) => setF({ ...f, perCall: e.target.value.replace(/[^0-9.]/g, "") })} />
              </Field>
              <Field label="Per session (USD)">
                <input className={inputCls} inputMode="decimal" value={f.session} onChange={(e) => setF({ ...f, session: e.target.value.replace(/[^0-9.]/g, "") })} />
              </Field>
              <Field label="Min quality (0–100)">
                <input className={inputCls} inputMode="numeric" value={f.quality} onChange={(e) => setF({ ...f, quality: e.target.value.replace(/[^0-9]/g, "") })} />
              </Field>
            </div>
            <HardButton onClick={saveLimits} disabled={busy}>
              Save limits
            </HardButton>
          </div>
        )}

        {tab === "key" &&
          (shown ? (
            <KeyStep shown={shown} />
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-coal/70">Keys are shown only once. To connect this agent again, or if the key leaked, make a new one: the old key stops working at once.</p>
              {confirm ? (
                <div className="flex flex-wrap gap-3">
                  <HardButton variant="pay" onClick={rotate} disabled={busy}>
                    Yes, replace the key
                  </HardButton>
                  <HardButton variant="ghost" onClick={() => setConfirm(false)}>
                    Cancel
                  </HardButton>
                </div>
              ) : (
                <HardButton onClick={() => setConfirm(true)}>Get a new key</HardButton>
              )}
            </div>
          ))}

        {tab === "remove" && (
          <div className="space-y-4">
            <p className="text-sm text-coal/70">
              Removing {agent.name} stops its key for good.{credits && agent.balanceMicro > 0 ? ` Its ${formatUsd(agent.balanceMicro)} goes back to your account.` : ""} Past purchases stay in your history.
            </p>
            {confirm ? (
              <div className="flex flex-wrap gap-3">
                <HardButton variant="pay" onClick={revoke} disabled={busy}>
                  Yes, remove {agent.name}
                </HardButton>
                <HardButton variant="ghost" onClick={() => setConfirm(false)}>
                  Cancel
                </HardButton>
              </div>
            ) : (
              <HardButton variant="ghost" onClick={() => setConfirm(true)}>
                Remove agent
              </HardButton>
            )}
          </div>
        )}
        {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      </div>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="border-2 border-coal/15 bg-surface px-3 py-2.5">
      <dt className="text-xs font-medium text-coal/60">{label}</dt>
      <dd className="tnum mt-1 font-mono text-lg font-bold">{value}</dd>
    </div>
  );
}

/** The agent as a trading card: its critter on its own colour, its name, how much of its budget is gone. */
export function AgentCard({ agent, onOpen, compact = false }: { agent: Agent; onOpen: () => void; compact?: boolean }) {
  const pct = agent.policy.sessionBudgetMicro > 0 ? Math.min(100, (agent.sessionSpendMicro / agent.policy.sessionBudgetMicro) * 100) : 0;
  return (
    <button type="button" onClick={onOpen} className="sy-card group block w-full border-2 border-coal bg-surface text-left shadow-[4px_4px_0_var(--color-coal)]">
      <div className="relative overflow-hidden border-b-2 border-coal" style={{ background: tint(agent.id) }}>
        <div aria-hidden className="absolute inset-0 bg-[radial-gradient(rgb(23_18_15/0.09)_1px,transparent_1px)] [background-size:14px_14px]" />
        <AgentAvatar seed={agent.id} className={cn("sy-card-critter relative mx-auto", "w-full", compact ? "max-w-40" : "max-w-56")} />
        <span className="absolute top-2 right-2 border-2 max-sm:hidden border-coal bg-surface px-1.5 py-0.5 font-mono text-[10px] font-bold">{agent.keyPrefix}…</span>
      </div>
      <div className="space-y-2.5 p-3.5">
        <p className="truncate text-lg font-bold leading-tight tracking-[-0.02em]">{agent.name}</p>
        {!compact && (
          <>
            <div className="h-2 border border-coal bg-cream" aria-hidden>
              <div className="h-full bg-lime" style={{ width: `${pct}%` }} />
            </div>
            <p className="tnum flex justify-between font-mono text-[11px] text-coal/60">
              <span>{formatUsd(agent.sessionSpendMicro)} spent</span>
              <span className="max-sm:hidden">max {formatUsd(agent.policy.maxPerRequestMicro)}/call</span>
            </p>
          </>
        )}
      </div>
    </button>
  );
}

export function Agents() {
  const { account } = useAccount();
  const [creating, setCreating] = useState(false);
  const [round, setRound] = useState(0);
  const create = () => {
    setRound((r) => r + 1);
    setCreating(true);
  };
  const [openId, setOpenId] = useState<string | null>(null);
  // links from the dashboard home: ?new=1 opens the create flow, ?open=<id> opens that agent
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (!q.has("new") && !q.has("open")) return;
    void Promise.resolve().then(() => {
      if (q.has("new")) create();
      if (q.get("open")) setOpenId(q.get("open"));
      window.history.replaceState(null, "", window.location.pathname);
    });
  }, []);
  if (!account) return null;
  const open = account.agents.find((a) => a.id === openId) ?? null;

  return (
    <div className="space-y-8">
      <PageHead title={<>Your <span className="sy-mark">crew.</span></>} lead="Each agent is a key for Claude Code, Codex or any MCP client, with its own limits. Tap one to tune it." action={<HardButton onClick={create}><Plus className="size-4" strokeWidth={3} aria-hidden /> New agent</HardButton>} />

      {account.agents.length === 0 ? (
        <button type="button" onClick={create} className="sy-card flex w-full flex-col items-center gap-4 border-2 border-dashed border-coal bg-surface/70 px-6 py-12 text-center">
          <span className="grid size-24 place-items-center border-2 border-coal bg-lime shadow-[4px_4px_0_var(--color-coal)]">
            <Plus className="size-10" strokeWidth={3} aria-hidden />
          </span>
          <span className="text-2xl font-bold tracking-[-0.03em]">Hatch your first agent</span>
          <span className="max-w-md text-coal/70">Name it, meet it, paste one command into your terminal. Two minutes.</span>
        </button>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-3">
          {account.agents.map((a) => (
            <AgentCard key={a.id} agent={a} onOpen={() => setOpenId(a.id)} />
          ))}
          <button type="button" onClick={create} className="sy-card flex min-h-60 flex-col items-center justify-center gap-3 border-2 border-dashed border-coal/50 text-coal/70 hover:border-coal hover:text-coal">
            <span className="grid size-14 place-items-center border-2 border-current">
              <Plus className="size-6" strokeWidth={3} aria-hidden />
            </span>
            <span className="font-bold">New agent</span>
          </button>
        </div>
      )}

      <CreateAgent key={round} open={creating} onClose={() => setCreating(false)} />
      <AgentSheet agent={open} onClose={() => setOpenId(null)} />
    </div>
  );
}
