"use client";

import { useState } from "react";
import type { ProviderWithServices, WalletResponse } from "@/lib/api-types";
import { emitDataChanged } from "@/lib/client/data-events";
import { useFetch } from "@/lib/client/useFetch";
import { formatUsd, toDollars, toMicro } from "@/lib/money";
import type { SpendingPolicy } from "@/lib/types";
import { HardButton, Label, ModeBadge, Panel, StatusDot } from "@/components/primitives";

const inputCls = "mt-2 min-h-11 w-full border border-line-hi bg-ink px-3 font-mono text-sm text-paper focus-visible:border-signal";
const MCP_SNIPPET = `{
  "mcpServers": {
    "switchyard": {
      "command": "npm",
      "args": ["run", "--silent", "mcp"],
      "cwd": "<absolute path to this repo>"
    }
  }
}`;

export function SettingsPanel() {
  const wallet = useFetch<WalletResponse>("/api/wallet");
  const providers = useFetch<{ providers: ProviderWithServices[] }>("/api/providers");
  if (!wallet.data) return <p className="font-mono text-xs text-muted">Loading…</p>;
  // keyed so the form re-initialises whenever the saved policy changes
  return <SettingsForm key={JSON.stringify(wallet.data.wallet.policy)} data={wallet.data} providers={providers.data?.providers ?? []} />;
}

function SettingsForm({ data, providers }: { data: WalletResponse; providers: ProviderWithServices[] }) {
  const pol = data.wallet.policy;
  const [max, setMax] = useState(String(toDollars(pol.maxPerRequestMicro)));
  const [budget, setBudget] = useState(String(toDollars(pol.sessionBudgetMicro)));
  const [minQ, setMinQ] = useState(String(pol.minQuality));
  const [x402, setX402] = useState(pol.requireX402);
  const [allowed, setAllowed] = useState<string[] | "any">(pol.allowedProviderIds);
  const [msg, setMsg] = useState<string | null>(null);
  const wallet = { data };
  const w = data.wallet;
  const within = w.sessionSpendMicro <= pol.sessionBudgetMicro;

  const save = async () => {
    const next: SpendingPolicy = {
      maxPerRequestMicro: toMicro(parseFloat(max) || 0),
      sessionBudgetMicro: toMicro(parseFloat(budget) || 0),
      allowedNetworks: ["solana-devnet"],
      allowedProviderIds: allowed,
      minQuality: Math.min(100, Math.max(0, parseFloat(minQ) || 0)),
      requireX402: x402,
    };
    const res = await fetch("/api/wallet", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ policy: next }) });
    setMsg(res.ok ? "Policy saved." : "Invalid policy.");
    emitDataChanged();
  };
  const newSession = async () => {
    await fetch("/api/wallet", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ newSession: true }) });
    setMsg("New session started. Session spend reset.");
    emitDataChanged();
  };
  const toggleProvider = (id: string) => {
    const all = providers.map((p) => p.provider.id);
    const cur = allowed === "any" ? all : allowed;
    setAllowed(cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Panel title="Agent wallet" status={<ModeBadge mode={wallet.data.mode} />}>
        <div className="grid grid-cols-3 gap-4 font-mono">
          <div><Label>Balance</Label><div className="tnum mt-1 text-2xl font-bold">{formatUsd(w.balanceMicro)}</div></div>
          <div><Label>Session spend</Label><div className="tnum mt-1 text-2xl font-bold">{formatUsd(w.sessionSpendMicro)}</div></div>
          <div><Label>Limit</Label><div className="tnum mt-1 text-2xl font-bold">{formatUsd(pol.sessionBudgetMicro)}</div></div>
        </div>
        <div className="mt-4 flex items-center gap-2 font-mono text-xs uppercase tracking-wider"><StatusDot tone={within ? "ok" : "fail"} /> {within ? "Within policy" : "Over policy"}</div>
        <div className="mt-4"><HardButton variant="ghost" onClick={newSession}>New session</HardButton></div>
        <p className="mt-4 font-mono text-[11px] text-muted">
          Payment mode: <span className="text-paper">{wallet.data.mode}</span>. This build ships the simulated rail only; live x402 on Solana devnet is documented in the README (Phase 8) and is off.
        </p>
      </Panel>

      <Panel title="Spending policy">
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label htmlFor="s-max"><Label>Max per request (USD)</Label></label><input id="s-max" inputMode="decimal" className={inputCls} value={max} onChange={(e) => setMax(e.target.value)} /></div>
          <div><label htmlFor="s-bud"><Label>Session budget (USD)</Label></label><input id="s-bud" inputMode="decimal" className={inputCls} value={budget} onChange={(e) => setBudget(e.target.value)} /></div>
          <div><label htmlFor="s-q"><Label>Min quality</Label></label><input id="s-q" inputMode="decimal" className={inputCls} value={minQ} onChange={(e) => setMinQ(e.target.value)} /></div>
          <label className="mt-6 flex min-h-11 items-center gap-3 font-mono text-xs"><input type="checkbox" checked={x402} onChange={(e) => setX402(e.target.checked)} className="size-5 accent-[var(--color-signal)]" /> Require x402</label>
        </div>
        <fieldset className="mt-4">
          <legend><Label>Allowed providers</Label></legend>
          <label className="mt-2 flex min-h-11 items-center gap-3 font-mono text-xs">
            <input type="checkbox" checked={allowed === "any"} onChange={(e) => setAllowed(e.target.checked ? "any" : providers.map((p) => p.provider.id))} className="size-5 accent-[var(--color-signal)]" /> Any provider
          </label>
          {allowed !== "any" && (
            <div className="mt-2 grid max-h-48 grid-cols-2 gap-1 overflow-y-auto">
              {providers.map((p) => (
                <label key={p.provider.id} className="flex min-h-9 items-center gap-2 font-mono text-[11px]">
                  <input type="checkbox" checked={allowed.includes(p.provider.id)} onChange={() => toggleProvider(p.provider.id)} className="size-4 accent-[var(--color-signal)]" /> {p.provider.name}
                </label>
              ))}
            </div>
          )}
        </fieldset>
        <div className="mt-4 flex items-center gap-4"><HardButton onClick={save}>Save policy</HardButton>{msg && <p role="status" className="font-mono text-xs text-signal">{msg}</p>}</div>
      </Panel>

      <Panel title="Connect an agent over MCP" className="lg:col-span-2">
        <p className="mb-2 font-mono text-xs text-muted">Add to your MCP client config. Tools: discover_services, compare_services, get_provider_reputation, plan_execution, execute_service, get_transactions, get_wallet_status.</p>
        <pre className="overflow-x-auto border border-line bg-ink p-3 font-mono text-xs">{MCP_SNIPPET}</pre>
      </Panel>
    </div>
  );
}
