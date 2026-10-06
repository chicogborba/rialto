"use client";

import { useCallback, useEffect, useState } from "react";
import { HardButton, Label, Panel, SegTabs } from "@/components/primitives";
import { CopyBlock } from "@/components/site/CopyBlock";
import { Step } from "@/components/site/PageShell";
import { ALL_CAPABILITIES, CAPABILITY_LABELS } from "@/lib/agent/capabilities";
import { api } from "@/lib/client/api";
import { clearKey, getKey, setKey } from "@/lib/client/keys";
import { formatUsd } from "@/lib/money";
import type { CapabilityId } from "@/lib/types";

interface Overview {
  seller: { name: string; payoutAddress: string; keyPrefix: string; balanceMicro: number; paidOutMicro: number };
  totals: { calls: number; failedNotCharged: number; earnedMicro: number; platformFeeMicro: number; grossMicro: number };
  apis: { id: string; slug: string; name: string; status: string; calls: number; earnedMicro: number; services: { capability: string; sellerPriceMicro: number; buyerPriceMicro: number; hasSecretHeaders: boolean }[] }[];
  ledger: { id: number; at: string; kind: string; amountMicro: number; note: string | null }[];
  minPayoutMicro: number;
}
interface Quote { youEarnUsd?: number; platformFeeUsd?: number; buyersPayUsd?: number; fee: { bps: number; minUsd: number } }
interface TestResult { ok: boolean; latencyMs: number; result?: unknown; error?: string }

const inputCls = "mt-2 block min-h-11 w-full border border-line-hi bg-ink px-3 font-mono text-sm text-paper focus-visible:border-signal";

const POKE = {
  name: "PokeAPI",
  description: "Pokémon data from the public PokéAPI.",
  capability: "data.lookup" as CapabilityId,
  upstreamUrl: "https://pokeapi.co/api/v2/pokemon/{query}",
  resultPick: "name,id,sprite=sprites.front_default,types=types.*.type.name",
  priceUsd: "0.002",
};

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <Label>{label}</Label>
      {children}
      {hint && <span className="mt-1 block font-mono text-[10px] text-muted">{hint}</span>}
    </label>
  );
}

export function PublishFlow() {
  const [key, setKeyState] = useState<string | null>(null);
  const [ov, setOv] = useState<Overview | null>(null);
  const [name, setName] = useState("");
  const [wallet, setWallet] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reveal, setReveal] = useState(false);

  // publish form
  const [f, setF] = useState({ name: "", description: "", capability: "data.lookup" as CapabilityId, upstreamUrl: "", method: "GET" as "GET" | "POST", bodyTemplate: "", headerName: "", headerValue: "", resultPick: "", priceUsd: "0.01", quality: "85", latencyMs: "400" });
  const [quote, setQuote] = useState<Quote | null>(null);
  const [published, setPublished] = useState<string | null>(null);
  const [tests, setTests] = useState<Record<string, TestResult | "running">>({});
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async (k: string) => {
    const r = await api<Overview>("/api/sellers/me", { key: k });
    if (r.ok) setOv(r.data);
    else if (r.status === 401) {
      clearKey("seller");
      setKeyState(null);
    }
  }, []);

  // read browser-only state after mount (a microtask keeps the first render identical to the server's)
  useEffect(() => {
    let alive = true;
    void Promise.resolve().then(() => {
      if (!alive) return;
      const k = getKey("seller");
      setKeyState(k);
      if (k) void load(k);
    });
    return () => {
      alive = false;
    };
  }, [load]);

  // live price preview
  useEffect(() => {
    const id = setTimeout(async () => {
      const r = await api<Quote>(`/api/pricing/quote?priceUsd=${encodeURIComponent(f.priceUsd)}`);
      setQuote(r.data);
    }, 250);
    return () => clearTimeout(id);
  }, [f.priceUsd]);

  const signup = async () => {
    setBusy(true);
    setError(null);
    const r = await api<{ apiKey: string }>("/api/sellers", { json: { name, payoutAddress: wallet.trim() } });
    setBusy(false);
    if (!r.ok || !r.data) return setError(r.error);
    setKey("seller", r.data.apiKey);
    setKeyState(r.data.apiKey);
    setReveal(true);
    void load(r.data.apiKey);
  };

  const publish = async () => {
    if (!key) return;
    setBusy(true);
    setError(null);
    setPublished(null);
    const r = await api<{ id: string; youEarnUsd: number; buyersPayUsd: number }>("/api/sellers/me/apis", {
      key,
      json: {
        name: f.name,
        description: f.description,
        capability: f.capability,
        upstreamUrl: f.upstreamUrl,
        method: f.method,
        bodyTemplate: f.method === "POST" && f.bodyTemplate ? f.bodyTemplate : undefined,
        headers: f.headerName && f.headerValue ? { [f.headerName]: f.headerValue } : undefined,
        resultPick: f.resultPick || undefined,
        priceUsd: Number(f.priceUsd),
        quality: Number(f.quality),
        latencyMs: Number(f.latencyMs),
      },
    });
    setBusy(false);
    if (!r.ok || !r.data) return setError(r.error);
    setPublished(`Published! Buyers pay ${formatUsd(Math.round(r.data.buyersPayUsd * 1_000_000))}, you earn ${formatUsd(Math.round(r.data.youEarnUsd * 1_000_000))} per call.`);
    void load(key);
  };

  const test = async (id: string) => {
    if (!key) return;
    setTests((t) => ({ ...t, [id]: "running" }));
    const r = await api<TestResult>(`/api/sellers/me/apis/${id}/test`, { key, json: { goal: "Look up the Pokémon pikachu." } });
    setTests((t) => ({ ...t, [id]: r.data ?? { ok: false, latencyMs: 0, error: r.error ?? "failed" } }));
  };

  const toggle = async (id: string, status: string) => {
    if (!key) return;
    await api(`/api/sellers/me/apis/${id}`, { key, method: "PATCH", json: { status: status === "online" ? "offline" : "online" } });
    void load(key);
  };

  const payout = async () => {
    if (!key || !ov) return;
    setMsg(null);
    const r = await api<{ amountUsd: number; txRef: string }>("/api/sellers/me/payouts", { key, json: {} });
    setMsg(r.ok && r.data ? `Paid out $${r.data.amountUsd.toFixed(3)} (simulated) · ${r.data.txRef}` : (r.error ?? "Payout failed"));
    void load(key);
  };

  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));
  const shown = key ? (reveal ? key : `${key.slice(0, 14)}••••••••••••`) : "";
  const feePct = quote ? `${(quote.fee.bps / 100).toFixed(quote.fee.bps % 100 ? 1 : 0)}%` : "";

  return (
    <div>
      <header className="pb-8">
        <Label tone="signal">For people with an API</Label>
        <h1 className="mt-3 text-[clamp(2.6rem,8vw,6.5rem)] font-bold uppercase leading-[0.86] tracking-[-0.05em]">
          Get paid <span className="sy-mark">per call.</span>
        </h1>
        <p className="mt-5 max-w-2xl text-xl font-medium">Paste your endpoint, set a price, and every AI agent on Switchyard can hire it. You keep 100% of your price; buyers pay a small platform fee on top. 💰</p>
      </header>

      <Step n="01" title="Create your seller account">
        {!key ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name"><input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="Acme Data" /></Field>
            <Field label="Solana address for payouts" hint="Devnet is fine for testing. We never ask for a private key."><input className={inputCls} value={wallet} onChange={(e) => setWallet(e.target.value)} placeholder="7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU" spellCheck={false} /></Field>
            <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
              <HardButton onClick={signup} disabled={busy || name.trim().length < 2 || wallet.trim().length < 32}>{busy ? "Creating…" : "Create seller account"}</HardButton>
              {error && <p role="alert" className="font-mono text-xs text-fail">{error}</p>}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <CopyBlock value={key} display={shown} />
            <div className="flex flex-wrap items-center gap-4 font-mono text-[11px]">
              <button type="button" onClick={() => setReveal((r) => !r)} className="underline hover:text-signal">{reveal ? "Hide key" : "Show key"}</button>
              <span className="text-muted">Saved in this browser only. It manages your APIs and earnings, so keep it private.</span>
            </div>
          </div>
        )}
      </Step>

      <Step n="02" title="Publish your API">
        {!key ? (
          <p className="font-mono text-xs text-muted">Create your account first.</p>
        ) : (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-3">
              <HardButton variant="ghost" onClick={() => setF((p) => ({ ...p, ...POKE, headerName: "", headerValue: "", method: "GET", bodyTemplate: "" }))}>⚡ Fill with a free example (PokéAPI)</HardButton>
              <span className="font-mono text-[11px] text-muted">Good for trying the whole flow without your own API.</span>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="API name"><input className={inputCls} value={f.name} onChange={(e) => set("name", e.target.value)} maxLength={40} /></Field>
              <Field label="What does it do?"><select className={inputCls} value={f.capability} onChange={(e) => set("capability", e.target.value as CapabilityId)}>{ALL_CAPABILITIES.map((c) => <option key={c} value={c}>{CAPABILITY_LABELS[c]} ({c})</option>)}</select></Field>
              <div className="md:col-span-2"><Field label="Short description"><input className={inputCls} value={f.description} onChange={(e) => set("description", e.target.value)} maxLength={200} /></Field></div>
              <div className="md:col-span-2">
                <Field label="Your endpoint (https)" hint="Use {query} for the main thing the agent is asking about, or {goal} for the full request. Placeholders can only go in the path or query, never the host.">
                  <input className={inputCls} value={f.upstreamUrl} onChange={(e) => set("upstreamUrl", e.target.value)} placeholder="https://api.example.com/v1/lookup/{query}" spellCheck={false} />
                </Field>
              </div>
              <div>
                <Label>Method</Label>
                <div className="mt-2"><SegTabs label="HTTP method" tabs={[{ id: "GET", label: "GET" }, { id: "POST", label: "POST" }]} value={f.method} onChange={(m) => set("method", m)} /></div>
              </div>
              {f.method === "POST" && <Field label="Body template (JSON)" hint='Default: {"query":"{query}"}'><textarea className={`${inputCls} min-h-24`} value={f.bodyTemplate} onChange={(e) => set("bodyTemplate", e.target.value)} placeholder='{"q":"{query}"}' /></Field>}
              <Field label="Secret header name (optional)" hint="E.g. x-api-key. Stored encrypted, never shown to buyers."><input className={inputCls} value={f.headerName} onChange={(e) => set("headerName", e.target.value)} placeholder="x-api-key" spellCheck={false} /></Field>
              <Field label="Secret header value"><input className={inputCls} type="password" autoComplete="off" value={f.headerValue} onChange={(e) => set("headerValue", e.target.value)} /></Field>
              <div className="md:col-span-2"><Field label="Fields to return (optional)" hint="Keeps results small. name,id,sprite=sprites.front_default,types=types.*.type.name"><input className={inputCls} value={f.resultPick} onChange={(e) => set("resultPick", e.target.value)} spellCheck={false} /></Field></div>
              <Field label="Your price per successful call (USD)"><input className={inputCls} inputMode="decimal" value={f.priceUsd} onChange={(e) => set("priceUsd", e.target.value.replace(/[^0-9.]/g, ""))} /></Field>
              <div className="border-2 border-ink bg-surface p-3 shadow-[5px_5px_0_var(--color-signal)]" aria-live="polite">
                <Label tone="signal">Price preview</Label>
                {quote?.buyersPayUsd !== undefined ? (
                  <dl className="mt-2 space-y-1 font-mono text-sm">
                    <div className="flex justify-between"><dt className="text-muted">You earn</dt><dd className="tnum font-bold text-signal">${quote.youEarnUsd?.toFixed(4)}</dd></div>
                    <div className="flex justify-between"><dt className="text-muted">Platform fee ({feePct}, min ${quote.fee.minUsd})</dt><dd className="tnum">${quote.platformFeeUsd?.toFixed(4)}</dd></div>
                    <div className="flex justify-between border-t border-line pt-1"><dt className="text-muted">Buyers pay</dt><dd className="tnum font-bold">${quote.buyersPayUsd?.toFixed(4)}</dd></div>
                  </dl>
                ) : <p className="mt-2 font-mono text-xs text-muted">Enter a price between $0.0001 and $5.</p>}
              </div>
              <Field label="Quality benchmark (0–100)" hint="Self-reported. New APIs start with an unproven reputation."><input className={inputCls} inputMode="decimal" value={f.quality} onChange={(e) => set("quality", e.target.value)} /></Field>
              <Field label="Typical latency (ms)"><input className={inputCls} inputMode="numeric" value={f.latencyMs} onChange={(e) => set("latencyMs", e.target.value)} /></Field>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <HardButton onClick={publish} disabled={busy || !f.name || !f.upstreamUrl || f.description.length < 5}>{busy ? "Publishing…" : "Publish API"}</HardButton>
              {published && <p role="status" className="font-mono text-xs text-signal">{published}</p>}
              {error && <p role="alert" className="font-mono text-xs text-fail">{error}</p>}
            </div>
          </div>
        )}
      </Step>

      <Step n="03" title="Test it, then watch the money">
        {!ov ? (
          <p className="font-mono text-xs text-muted">Your dashboard appears here after you create an account.</p>
        ) : (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-4">
              {[
                ["Available to withdraw", formatUsd(ov.seller.balanceMicro)],
                ["Paid out", formatUsd(ov.seller.paidOutMicro)],
                ["Paid calls", String(ov.totals.calls)],
                ["Failed (not charged)", String(ov.totals.failedNotCharged)],
              ].map(([k, v]) => (
                <div key={k} className="border border-line bg-surface p-4">
                  <Label>{k}</Label>
                  <p className="tnum mt-2 font-mono text-3xl font-bold">{v}</p>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <HardButton onClick={payout} disabled={ov.seller.balanceMicro < ov.minPayoutMicro}>Withdraw to {ov.seller.payoutAddress.slice(0, 4)}…{ov.seller.payoutAddress.slice(-4)}</HardButton>
              <span className="font-mono text-[11px] text-muted">Minimum {formatUsd(ov.minPayoutMicro)}. Simulated until the live Solana rail is connected.</span>
              {msg && <p role="status" className="font-mono text-xs text-signal">{msg}</p>}
            </div>

            <Panel title={`Your APIs (${ov.apis.length})`} bodyClassName="p-0">
              {ov.apis.length === 0 ? (
                <p className="p-4 font-mono text-xs text-muted">Nothing published yet.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {ov.apis.map((a) => {
                    const t = tests[a.id];
                    const svc = a.services[0];
                    return (
                      <li key={a.id} className="space-y-3 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-bold">{a.name} <span className={a.status === "online" ? "font-mono text-[10px] text-signal" : "font-mono text-[10px] text-fail"}>{a.status.toUpperCase()}</span></p>
                            <p className="font-mono text-[11px] text-muted">{svc?.capability} · you earn {svc ? formatUsd(svc.sellerPriceMicro) : "—"} · buyers pay {svc ? formatUsd(svc.buyerPriceMicro) : "—"} · {a.calls} calls · earned {formatUsd(a.earnedMicro)}</p>
                          </div>
                          <div className="flex gap-2">
                            <HardButton variant="ghost" onClick={() => test(a.id)} disabled={t === "running"}>{t === "running" ? "Testing…" : "Test it"}</HardButton>
                            <HardButton variant="ghost" onClick={() => toggle(a.id, a.status)}>{a.status === "online" ? "Pause" : "Resume"}</HardButton>
                          </div>
                        </div>
                        {t && t !== "running" && (
                          <pre className={`max-h-56 overflow-auto border p-3 font-mono text-[11px] ${t.ok ? "border-signal" : "border-fail text-fail"}`}>
                            {t.ok ? `✓ ${t.latencyMs} ms\n${JSON.stringify(t.result, null, 1)}` : `✕ ${t.error}`}
                          </pre>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </Panel>

            {ov.ledger.length > 0 && (
              <Panel title="Recent earnings & payouts" bodyClassName="p-0">
                <ul className="divide-y divide-line font-mono text-xs">
                  {ov.ledger.map((l) => (
                    <li key={l.id} className="flex items-center justify-between gap-3 px-4 py-2">
                      <span className="text-muted">{new Date(l.at).toLocaleString("en-GB", { hour12: false })} · {l.kind.replace("_", " ")}</span>
                      <span className={`tnum ${l.amountMicro < 0 ? "text-pay" : "text-signal"}`}>{l.amountMicro < 0 ? "−" : "+"}{formatUsd(Math.abs(l.amountMicro))}</span>
                    </li>
                  ))}
                </ul>
              </Panel>
            )}
          </div>
        )}
      </Step>
    </div>
  );
}
