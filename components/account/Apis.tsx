"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { HardButton, Label, Panel, SegTabs } from "@/components/primitives";
import { ALL_CAPABILITIES, CAPABILITY_LABELS } from "@/lib/agent/capabilities";
import { api } from "@/lib/client/api";
import { useAccount } from "@/lib/client/account";
import { formatUsd } from "@/lib/money";
import type { CapabilityId } from "@/lib/types";
import { Field, inputCls, Notice, shortAddress, Stat } from "./ui";

interface Overview {
  seller: { name: string; payoutAddress: string; balanceMicro: number; paidOutMicro: number };
  totals: { calls: number; failedNotCharged: number; earnedMicro: number };
  apis: { id: string; slug: string; name: string; status: string; calls: number; earnedMicro: number; services: { capability: string; sellerPriceMicro: number; buyerPriceMicro: number }[] }[];
  minPayoutMicro: number;
}
interface Quote {
  youEarnUsd?: number;
  platformFeeUsd?: number;
  buyersPayUsd?: number;
  fee: { bps: number; minUsd: number };
}
interface TestResult {
  ok: boolean;
  latencyMs: number;
  result?: unknown;
  error?: string;
}

const POKE = {
  name: "PokeAPI",
  description: "Pokémon data from the public PokéAPI.",
  capability: "data.lookup" as CapabilityId,
  upstreamUrl: "https://pokeapi.co/api/v2/pokemon/{query}",
  resultPick: "name,id,sprite=sprites.front_default,types=types.*.type.name",
  priceUsd: "0.002",
};
const BLANK = { name: "", description: "", capability: "data.lookup" as CapabilityId, upstreamUrl: "", method: "GET" as "GET" | "POST", bodyTemplate: "", headerName: "", headerValue: "", resultPick: "", priceUsd: "0.01", quality: "85", latencyMs: "400" };

export function Apis() {
  const { account, refresh } = useAccount();
  const [ov, setOv] = useState<Overview | null>(null);
  const [f, setF] = useState(BLANK);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [tests, setTests] = useState<Record<string, TestResult | "running">>({});
  const hasWallet = account?.user.wallet != null;

  const load = useCallback(async () => {
    const r = await api<Overview>("/api/sellers/me");
    if (r.ok) setOv(r.data);
  }, []);
  useEffect(() => {
    if (!hasWallet) return;
    let alive = true;
    void Promise.resolve().then(() => {
      if (alive) void load();
    });
    return () => {
      alive = false;
    };
  }, [hasWallet, load]);

  useEffect(() => {
    const id = setTimeout(async () => {
      const r = await api<Quote>(`/api/pricing/quote?priceUsd=${encodeURIComponent(f.priceUsd)}`);
      setQuote(r.data);
    }, 250);
    return () => clearTimeout(id);
  }, [f.priceUsd]);

  if (!account) return null;
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));

  const publish = async () => {
    setBusy(true);
    setMsg(null);
    const r = await api<{ buyersPayUsd: number; youEarnUsd: number }>("/api/sellers/me/apis", {
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
    if (!r.ok || !r.data) return setMsg({ tone: "error", text: r.error ?? "Could not publish." });
    setMsg({ tone: "ok", text: `Published. Buyers pay ${formatUsd(Math.round(r.data.buyersPayUsd * 1e6))}; you earn ${formatUsd(Math.round(r.data.youEarnUsd * 1e6))} per call.` });
    setF(BLANK);
    await Promise.all([load(), refresh()]);
  };

  const test = async (id: string) => {
    setTests((t) => ({ ...t, [id]: "running" }));
    const r = await api<TestResult>(`/api/sellers/me/apis/${id}/test`, { json: { goal: "Look up the Pokémon pikachu." } });
    setTests((t) => ({ ...t, [id]: r.data ?? { ok: false, latencyMs: 0, error: r.error ?? "failed" } }));
  };
  const toggle = async (id: string, status: string) => {
    await api(`/api/sellers/me/apis/${id}`, { method: "PATCH", json: { status: status === "online" ? "offline" : "online" } });
    await Promise.all([load(), refresh()]);
  };
  const payout = async () => {
    const r = await api<{ amountUsd: number; txRef: string }>("/api/sellers/me/payouts", { json: {} });
    setMsg(r.ok && r.data ? { tone: "ok", text: `Paid out $${r.data.amountUsd.toFixed(3)} (simulated) · ${r.data.txRef}` } : { tone: "error", text: r.error ?? "Payout failed" });
    await load();
  };

  const feePct = quote ? `${(quote.fee.bps / 100).toFixed(quote.fee.bps % 100 ? 1 : 0)}%` : "";
  return (
    <div className="space-y-8">
      <header>
        <Label tone="signal">My APIs</Label>
        <h1 className="mt-3 text-[clamp(2.2rem,6vw,4.5rem)] font-bold uppercase leading-[0.9] tracking-[-0.05em]">
          Get paid <span className="sy-mark">per call.</span>
        </h1>
        <p className="mt-4 max-w-2xl text-lg font-medium">Paste your endpoint and set a price; every agent on Rialto can hire it. You keep 100% of your price; buyers pay a small platform fee on top.</p>
      </header>

      {!hasWallet ? (
        <Panel title="One thing first" tone="default" className="border-pay" bodyClassName="space-y-3">
          <p className="text-lg font-medium">Where should we pay you?</p>
          <p className="text-sm text-muted">Add the Solana wallet you want to be paid at. Every successful call sends your price there.</p>
          <Link href="/dashboard/wallet" className="inline-flex min-h-11 items-center border border-signal bg-signal px-4 font-mono text-xs font-bold uppercase tracking-[0.1em] text-ink">
            Add my wallet
          </Link>
        </Panel>
      ) : (
        <>
          {ov && (
            <div className="grid gap-4 sm:grid-cols-4">
              <Stat label="Available to withdraw" value={formatUsd(ov.seller.balanceMicro)} />
              <Stat label="Paid to your wallet" value={formatUsd(ov.seller.paidOutMicro)} hint={`at ${shortAddress(ov.seller.payoutAddress)}`} />
              <Stat label="Paid calls" value={String(ov.totals.calls)} />
              <Stat label="Failed (not charged)" value={String(ov.totals.failedNotCharged)} />
            </div>
          )}
          {ov && ov.seller.balanceMicro >= ov.minPayoutMicro && (
            <div className="flex flex-wrap items-center gap-3">
              <HardButton onClick={payout}>Withdraw {formatUsd(ov.seller.balanceMicro)}</HardButton>
              <span className="font-mono text-[11px] text-muted">Simulated payout. On the live rail every call is paid to your wallet as it happens.</span>
            </div>
          )}

          <Panel title={`Your APIs (${ov?.apis.length ?? 0})`} bodyClassName="p-0">
            {!ov || ov.apis.length === 0 ? (
              <p className="p-4 font-mono text-xs text-muted">Nothing published yet. Fill the form below.</p>
            ) : (
              <ul className="divide-y divide-line">
                {ov.apis.map((a) => {
                  const t = tests[a.id];
                  const svc = a.services[0];
                  return (
                    <li key={a.id} className="space-y-3 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-bold">
                            {a.name} <span className={a.status === "online" ? "font-mono text-[10px] text-signal" : "font-mono text-[10px] text-fail"}>{a.status.toUpperCase()}</span>
                          </p>
                          <p className="font-mono text-[11px] text-muted">
                            {svc?.capability} · you earn {svc ? formatUsd(svc.sellerPriceMicro) : "—"} · buyers pay {svc ? formatUsd(svc.buyerPriceMicro) : "—"} · {a.calls} calls · earned {formatUsd(a.earnedMicro)}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <HardButton variant="ghost" onClick={() => test(a.id)} disabled={t === "running"}>
                            {t === "running" ? "Testing…" : "Test it"}
                          </HardButton>
                          <HardButton variant="ghost" onClick={() => toggle(a.id, a.status)}>
                            {a.status === "online" ? "Pause" : "Resume"}
                          </HardButton>
                        </div>
                      </div>
                      {t && t !== "running" && <pre className={`max-h-56 overflow-auto border p-3 font-mono text-[11px] ${t.ok ? "border-signal" : "border-fail text-fail"}`}>{t.ok ? `✓ ${t.latencyMs} ms\n${JSON.stringify(t.result, null, 1)}` : `✕ ${t.error}`}</pre>}
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          <Panel title="Publish a new API" bodyClassName="space-y-5">
            <div className="flex flex-wrap items-center gap-3">
              <HardButton variant="ghost" onClick={() => setF((p) => ({ ...p, ...POKE, headerName: "", headerValue: "", method: "GET", bodyTemplate: "" }))}>
                ⚡ Fill with a free example (PokéAPI)
              </HardButton>
              <span className="font-mono text-[11px] text-muted">Good for trying the whole flow without your own API.</span>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="API name">
                <input className={inputCls} value={f.name} onChange={(e) => set("name", e.target.value)} maxLength={40} />
              </Field>
              <Field label="What does it do?">
                <select className={inputCls} value={f.capability} onChange={(e) => set("capability", e.target.value as CapabilityId)}>
                  {ALL_CAPABILITIES.map((c) => (
                    <option key={c} value={c}>
                      {CAPABILITY_LABELS[c]} ({c})
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Short description" className="md:col-span-2">
                <input className={inputCls} value={f.description} onChange={(e) => set("description", e.target.value)} maxLength={200} />
              </Field>
              <Field label="Your endpoint (https)" hint="Use {query} for the main thing the agent asks about, or {goal} for the whole request. Placeholders go in the path or query, never the host." className="md:col-span-2">
                <input className={inputCls} value={f.upstreamUrl} onChange={(e) => set("upstreamUrl", e.target.value)} placeholder="https://api.example.com/v1/lookup/{query}" spellCheck={false} />
              </Field>
              <div>
                <Label>Method</Label>
                <div className="mt-2">
                  <SegTabs label="HTTP method" tabs={[{ id: "GET", label: "GET" }, { id: "POST", label: "POST" }]} value={f.method} onChange={(m) => set("method", m)} />
                </div>
              </div>
              {f.method === "POST" && (
                <Field label="Body template (JSON)" hint='Default: {"query":"{query}"}'>
                  <textarea className={`${inputCls} min-h-24`} value={f.bodyTemplate} onChange={(e) => set("bodyTemplate", e.target.value)} placeholder='{"q":"{query}"}' />
                </Field>
              )}
              <Field label="Secret header name (optional)" hint="E.g. x-api-key. Stored encrypted, never shown to buyers.">
                <input className={inputCls} value={f.headerName} onChange={(e) => set("headerName", e.target.value)} placeholder="x-api-key" spellCheck={false} />
              </Field>
              <Field label="Secret header value">
                <input className={inputCls} type="password" autoComplete="off" value={f.headerValue} onChange={(e) => set("headerValue", e.target.value)} />
              </Field>
              <Field label="Fields to return (optional)" hint="Keeps results small: name,id,sprite=sprites.front_default" className="md:col-span-2">
                <input className={inputCls} value={f.resultPick} onChange={(e) => set("resultPick", e.target.value)} spellCheck={false} />
              </Field>
              <Field label="Your price per successful call (USD)">
                <input className={inputCls} inputMode="decimal" value={f.priceUsd} onChange={(e) => set("priceUsd", e.target.value.replace(/[^0-9.]/g, ""))} />
              </Field>
              <div className="border-2 border-ink bg-surface p-3 shadow-[5px_5px_0_var(--color-signal)]" aria-live="polite">
                <Label tone="signal">Price preview</Label>
                {quote?.buyersPayUsd !== undefined ? (
                  <dl className="mt-2 space-y-1 font-mono text-sm">
                    <div className="flex justify-between">
                      <dt className="text-muted">You earn</dt>
                      <dd className="tnum font-bold text-signal">${quote.youEarnUsd?.toFixed(4)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted">Platform fee ({feePct}, min ${quote.fee.minUsd})</dt>
                      <dd className="tnum">${quote.platformFeeUsd?.toFixed(4)}</dd>
                    </div>
                    <div className="flex justify-between border-t border-line pt-1">
                      <dt className="text-muted">Buyers pay</dt>
                      <dd className="tnum font-bold">${quote.buyersPayUsd?.toFixed(4)}</dd>
                    </div>
                  </dl>
                ) : (
                  <p className="mt-2 font-mono text-xs text-muted">Enter a price between $0.0001 and $5.</p>
                )}
              </div>
              <Field label="Quality benchmark (0–100)" hint="Self-reported. New APIs start with an unproven reputation.">
                <input className={inputCls} inputMode="decimal" value={f.quality} onChange={(e) => set("quality", e.target.value)} />
              </Field>
              <Field label="Typical latency (ms)">
                <input className={inputCls} inputMode="numeric" value={f.latencyMs} onChange={(e) => set("latencyMs", e.target.value)} />
              </Field>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <HardButton onClick={publish} disabled={busy || !f.name || !f.upstreamUrl || f.description.length < 5}>
                {busy ? "Publishing…" : "Publish API"}
              </HardButton>
              {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}
