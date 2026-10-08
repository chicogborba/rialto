"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CAPABILITY_LABELS } from "@/lib/agent/capabilities";
import type { CatalogEntry } from "@/lib/api-types";
import { STATIC_PREVIEW, flowHref } from "@/lib/site";
import { cn } from "@/lib/utils";
import { LOOK } from "./look";

const SORTS = [
  { id: "trust", label: "Most trusted" },
  { id: "price", label: "Cheapest" },
  { id: "speed", label: "Fastest" },
] as const;
type SortId = (typeof SORTS)[number]["id"];
type Group = "live" | "demo";

const speed = (ms: number) => (ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${ms} ms`);
const count = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 10_000 ? `${Math.round(n / 1000)}K` : n.toLocaleString("en-US"));
const CHIP = "border-2 border-coal px-3 py-1.5 font-mono text-xs font-bold uppercase tracking-[0.06em] transition-colors";
const TAG = "border-2 border-coal px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.1em]";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-coal/50">{label}</dt>
      <dd className="tnum font-mono text-sm font-bold">{value}</dd>
    </div>
  );
}

interface Loaded {
  live: CatalogEntry[];
  demo: CatalogEntry[];
}

/**
 * The catalog. On a running Rialto it asks the server what exists right now (the same database the
 * agents discover from), so it shows the APIs people really published first and the fictional demo
 * providers apart. The static preview has no server, so it shows the demo ones and says so.
 */
export function Catalog({ fallback }: { fallback: CatalogEntry[] }) {
  const [data, setData] = useState<Loaded | null>(STATIC_PREVIEW ? { live: [], demo: fallback } : null);
  const [failed, setFailed] = useState(false);
  const [group, setGroup] = useState<Group | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [sort, setSort] = useState<SortId>("trust");

  useEffect(() => {
    if (STATIC_PREVIEW) return;
    let alive = true;
    fetch("/api/catalog", { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<Loaded>) : Promise.reject(new Error("catalog"))))
      .then((d) => alive && setData(d))
      .catch(() => alive && (setFailed(true), setData({ live: [], demo: fallback })));
    return () => {
      alive = false;
    };
  }, [fallback]);

  const active: Group = group ?? (data && data.live.length === 0 ? "demo" : "live");
  const items = useMemo(() => (data ? data[active] : []), [data, active]);
  const categories = useMemo(() => ["All", ...Array.from(new Set(items.map((i) => CAPABILITY_LABELS[i.capability])))], [items]);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = items.filter((i) => {
      const cat = CAPABILITY_LABELS[i.capability];
      return (category === "All" || cat === category) && (!q || `${i.name} ${cat} ${i.description}`.toLowerCase().includes(q));
    });
    const by: Record<SortId, (a: CatalogEntry, b: CatalogEntry) => number> = {
      trust: (a, b) => b.reputation - a.reputation,
      price: (a, b) => a.priceMicro - b.priceMicro,
      speed: (a, b) => a.latencyMs - b.latencyMs,
    };
    return list.sort((a, b) => Number(a.offline) - Number(b.offline) || by[sort](a, b));
  }, [items, query, category, sort]);

  if (!data) return <p className="mt-10 font-mono text-sm text-coal/60">Loading what is on sale right now…</p>;

  return (
    <>
      <div role="tablist" aria-label="Which APIs" className="flex flex-wrap gap-3">
        {(
          [
            { id: "live", label: "Live on Rialto", n: data.live.length, hint: "Published by people, really callable" },
            { id: "demo", label: "Demo providers", n: data.demo.length, hint: "Fictional, simulated payments" },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={active === t.id}
            onClick={() => {
              setGroup(t.id);
              setCategory("All");
            }}
            className={cn("border-2 border-coal px-4 py-2.5 text-left transition-colors", active === t.id ? "bg-coal text-cream shadow-[4px_4px_0_var(--color-lime)]" : "bg-[#fffdf7] hover:bg-sand")}
          >
            <span className="block font-bold">
              {t.label} <span className="tnum font-mono text-sm opacity-70">({t.n})</span>
            </span>
            <span className="block font-mono text-[10px] font-bold uppercase tracking-[0.08em] opacity-60">{t.hint}</span>
          </button>
        ))}
      </div>

      {STATIC_PREVIEW ? (
        <p className="mt-4 border-l-4 border-coal bg-sand/60 px-4 py-3 text-sm">This is the static preview: it can only show the fictional demo providers. A running Rialto lists the APIs people really published here.</p>
      ) : failed ? (
        <p className="mt-4 border-l-4 border-coal bg-sand/60 px-4 py-3 text-sm">Could not reach the server, so this is the demo list.</p>
      ) : active === "demo" ? (
        <p className="mt-4 border-l-4 border-coal bg-sand/60 px-4 py-3 text-sm">These providers are fictional and their payments are simulated. They are here so an agent has a market to compare while real APIs are few.</p>
      ) : null}

      {active === "live" && data.live.length === 0 ? (
        <div className="mt-8 border-2 border-coal bg-[#fffdf7] p-8 text-center shadow-[6px_6px_0_var(--color-coal)]">
          <p className="text-2xl font-bold tracking-tight">Nothing published yet.</p>
          <p className="mt-2 text-coal/70">Be the first: paste an endpoint, set a price, get paid per call.</p>
          <Link href={flowHref("/signup?next=/dashboard/apis")} className="home-btn home-btn-ink mt-6">
            Publish an API →
          </Link>
        </div>
      ) : (
        <>
          <div className="mt-6 flex flex-col gap-4">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search: sprites, translation, market data…"
              aria-label="Search the catalog"
              className="w-full border-2 border-coal bg-[#fffdf7] px-4 py-3 text-lg font-medium shadow-[5px_5px_0_var(--color-coal)] outline-none placeholder:text-coal/40 focus:shadow-[5px_5px_0_var(--color-lime)]"
            />
            <div className="flex flex-wrap items-center gap-2">
              {categories.map((c) => (
                <button key={c} type="button" onClick={() => setCategory(c)} aria-pressed={category === c} className={cn(CHIP, category === c ? "bg-coal text-cream" : "bg-transparent hover:bg-sand")}>
                  {c}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs font-bold uppercase tracking-[0.12em] text-coal/50">Sort</span>
              {SORTS.map((s) => (
                <button key={s.id} type="button" onClick={() => setSort(s.id)} aria-pressed={sort === s.id} className={cn(CHIP, sort === s.id ? "bg-lime" : "bg-transparent hover:bg-sand")}>
                  {s.label}
                </button>
              ))}
              <span className="ml-auto font-mono text-xs font-bold uppercase tracking-[0.12em] text-coal/50">{shown.length} APIs</span>
            </div>
          </div>

          <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((item) => {
              const look = LOOK[item.capability];
              return (
                <li key={item.id} className={cn("flex flex-col border-2 border-coal bg-[#fffdf7] transition-transform duration-150 hover:-translate-y-1 hover:shadow-[6px_6px_0_var(--color-coal)]", item.offline && "opacity-55")}>
                  {/* the awning */}
                  <div aria-hidden className="h-4 border-b-2 border-coal" style={{ background: `repeating-linear-gradient(90deg, ${look.color} 0 22px, #fffdf7 22px 44px)` }} />
                  <div className="flex flex-1 flex-col p-5">
                    <div className="flex items-start gap-3">
                      <span aria-hidden className="grid size-12 shrink-0 place-items-center border-2 border-coal text-2xl" style={{ background: look.color }}>
                        {look.emoji}
                      </span>
                      <div className="min-w-0 flex-1">
                        <h2 className="truncate text-xl font-bold tracking-tight">{item.name}</h2>
                        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-coal/55">{CAPABILITY_LABELS[item.capability]}</p>
                      </div>
                      <p className="shrink-0 text-right">
                        <span className="tnum block font-mono text-xl font-bold leading-none">${(item.priceMicro / 1_000_000).toFixed(3)}</span>
                        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-coal/50">per call</span>
                      </p>
                    </div>
                    <p className="mt-3 flex-1 leading-snug text-coal/75">{item.description}</p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {item.demo ? (
                        <span className={cn(TAG, "bg-sand")}>Demo · fictional</span>
                      ) : (
                        <>
                          <span className={cn(TAG, "bg-lime")}>Live</span>
                          <span className={cn(TAG, "bg-transparent")}>{item.settlement === "solana-devnet" ? "Pays on Solana devnet" : "Simulated payment"}</span>
                          {item.unproven && <span className={cn(TAG, "bg-[#ffd23f]")}>New · no calls yet</span>}
                        </>
                      )}
                      {item.offline && <span className={cn(TAG, "bg-[#ff4d4d] text-white")}>Paused</span>}
                    </div>
                    <dl className="mt-4 grid grid-cols-4 gap-2 border-t-2 border-coal/10 pt-3">
                      <Stat label="Speed" value={speed(item.latencyMs)} />
                      <Stat label="Quality" value={item.quality.toFixed(0)} />
                      <Stat label="Trust" value={item.reputation.toFixed(0)} />
                      <Stat label="Calls" value={count(item.calls)} />
                    </dl>
                  </div>
                </li>
              );
            })}
          </ul>
          {shown.length === 0 ? <p className="mt-10 text-center text-lg text-coal/60">Nothing matches that. Try another word.</p> : null}
        </>
      )}
    </>
  );
}
