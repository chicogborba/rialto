"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import type { ProviderWithServices } from "@/lib/api-types";
import { ALL_CAPABILITIES, CAPABILITY_LABELS } from "@/lib/agent/capabilities";
import { flattenServices } from "@/lib/client/flatten";
import { useFetch } from "@/lib/client/useFetch";
import { formatUsd } from "@/lib/money";
import type { Candidate, CapabilityId } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Label, SegTabs, StatusDot, Sticker } from "@/components/primitives";
import { ServiceSheet } from "./ServiceSheet";

type SortKey = "price" | "quality" | "latency" | "reputation";
const SORTS: { id: SortKey; label: string }[] = [
  { id: "reputation", label: "Reputation" },
  { id: "price", label: "Price" },
  { id: "quality", label: "Quality" },
  { id: "latency", label: "Latency" },
];

function sortValue(c: Candidate, k: SortKey): number {
  switch (k) {
    case "price": return c.service.priceMicro;
    case "quality": return -c.provider.qualityScore;
    case "latency": return c.provider.latencyMs;
    case "reputation": return -c.provider.reputationScore;
  }
}

function X402({ ok }: { ok: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-wider", ok ? "text-signal" : "text-muted")}>
      <StatusDot tone={ok ? "ok" : "idle"} /> {ok ? "x402" : "no x402"}
    </span>
  );
}

function ProviderName({ c, unproven }: { c: Candidate; unproven: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="font-bold">{c.provider.name}</span>
      {c.provider.isDemo && <span className="border border-line-hi px-1 font-mono text-[9px] uppercase tracking-wider text-muted">Demo provider</span>}
      {unproven && <Sticker tone="pay">Unproven</Sticker>}
      {c.provider.status !== "online" && <span className="font-mono text-[10px] uppercase text-fail">{c.provider.status}</span>}
    </div>
  );
}

export function MarketTable() {
  const { data, loading, error } = useFetch<{ providers: ProviderWithServices[] }>("/api/providers");
  const [cap, setCap] = useState<CapabilityId | "all">("all");
  const [sort, setSort] = useState<SortKey>("reputation");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<Candidate | null>(null);

  const unproven = useMemo(() => new Set((data?.providers ?? []).filter((p) => p.unproven).map((p) => p.provider.id)), [data]);
  const rows = useMemo(() => {
    const all = flattenServices(data?.providers ?? []);
    const needle = q.trim().toLowerCase();
    return all
      .filter((c) => (cap === "all" || c.service.capability === cap) && (!needle || c.provider.name.toLowerCase().includes(needle) || c.service.capability.includes(needle)))
      .sort((a, b) => sortValue(a, sort) - sortValue(b, sort) || a.provider.name.localeCompare(b.provider.name));
  }, [data, cap, sort, q]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by capability">
          {(["all", ...ALL_CAPABILITIES] as const).map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={cap === c}
              onClick={() => setCap(c)}
              className={cn("min-h-9 border px-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.1em]",
                cap === c ? "border-signal bg-signal text-ink" : "border-line-hi text-muted hover:text-paper")}
            >
              {c === "all" ? "All" : CAPABILITY_LABELS[c]}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex min-h-11 items-center gap-2 border border-line-hi px-3 focus-within:border-signal">
          <Search className="size-4 text-muted" aria-hidden />
          <span className="sr-only">Search providers</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search providers…" className="bg-transparent font-mono text-sm outline-none placeholder:text-muted/60" />
        </label>
        <div className="flex items-center gap-2"><Label>Sort</Label><SegTabs label="Sort by" tabs={SORTS} value={sort} onChange={setSort} /></div>
      </div>

      {error && <p className="font-mono text-xs text-fail">Failed to load: {error}</p>}
      {loading && !data && <p className="font-mono text-xs text-muted">Loading…</p>}

      {/* desktop table */}
      <div className="hidden overflow-x-auto border border-line md:block">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead>
            <tr className="border-b border-line bg-surface">
              {["Provider", "Capability", "Price", "Quality", "Latency", "Success", "Reputation", "Requests", "Network", "x402"].map((h) => (
                <th key={h} scope="col" className="px-3 py-2"><Label>{h}</Label></th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.service.id} className="tnum cursor-pointer border-b border-line font-mono text-xs hover:bg-raised focus-within:bg-raised" onClick={() => setOpen(c)}>
                <td className="px-3 py-2.5 font-display text-sm">
                  <button type="button" onClick={(e) => { e.stopPropagation(); setOpen(c); }} className="text-left"><ProviderName c={c} unproven={unproven.has(c.provider.id)} /></button>
                </td>
                <td className="px-3 py-2.5 text-muted">{c.service.capability}</td>
                <td className="px-3 py-2.5 font-bold">{formatUsd(c.service.priceMicro)}</td>
                <td className="px-3 py-2.5">{c.provider.qualityScore}%</td>
                <td className="px-3 py-2.5">{c.provider.latencyMs}ms</td>
                <td className="px-3 py-2.5">{c.provider.successRate}%</td>
                <td className="px-3 py-2.5 text-signal">{c.provider.reputationScore}</td>
                <td className="px-3 py-2.5">{c.provider.requestCount.toLocaleString("en-US")}</td>
                <td className="px-3 py-2.5 text-muted">{c.provider.network}</td>
                <td className="px-3 py-2.5"><X402 ok={c.provider.x402Enabled} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* mobile cards */}
      <ul className="space-y-3 md:hidden">
        {rows.map((c) => (
          <li key={c.service.id}>
            <button type="button" onClick={() => setOpen(c)} className="block min-h-11 w-full border border-line bg-surface p-3 text-left">
              <ProviderName c={c} unproven={unproven.has(c.provider.id)} />
              <div className="mt-1 font-mono text-[11px] text-muted">{c.service.capability}</div>
              <div className="tnum mt-3 grid grid-cols-3 gap-2 font-mono text-xs">
                <span><Label>Price</Label><br />{formatUsd(c.service.priceMicro)}</span>
                <span><Label>Quality</Label><br />{c.provider.qualityScore}%</span>
                <span><Label>Rep</Label><br /><span className="text-signal">{c.provider.reputationScore}</span></span>
                <span><Label>Latency</Label><br />{c.provider.latencyMs}ms</span>
                <span><Label>Success</Label><br />{c.provider.successRate}%</span>
                <span><Label>x402</Label><br /><X402 ok={c.provider.x402Enabled} /></span>
              </div>
            </button>
          </li>
        ))}
      </ul>
      {rows.length === 0 && !loading && <p className="font-mono text-xs text-muted">No providers match.</p>}
      <ServiceSheet candidate={open} onClose={() => setOpen(null)} />
    </div>
  );
}
