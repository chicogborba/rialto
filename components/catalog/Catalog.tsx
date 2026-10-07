"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

export interface CatalogItem {
  name: string;
  description: string;
  category: string;
  emoji: string;
  color: string;
  priceUsd: number;
  latencyMs: number;
  quality: number;
  trust: number;
  calls: number;
  offline: boolean;
}

const SORTS = [
  { id: "trust", label: "Most trusted" },
  { id: "price", label: "Cheapest" },
  { id: "speed", label: "Fastest" },
] as const;
type SortId = (typeof SORTS)[number]["id"];

const speed = (ms: number) => (ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${ms} ms`);
const count = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : `${Math.round(n / 1000)}K`);
const CHIP = "border-2 border-coal px-3 py-1.5 font-mono text-xs font-bold uppercase tracking-[0.06em] transition-colors";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-coal/50">{label}</dt>
      <dd className="tnum font-mono text-sm font-bold">{value}</dd>
    </div>
  );
}

/** Every API in the market as a stall: striped awning, what it sells, what it costs, how good it is. */
export function Catalog({ items }: { items: CatalogItem[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [sort, setSort] = useState<SortId>("trust");
  const categories = useMemo(() => ["All", ...Array.from(new Set(items.map((i) => i.category)))], [items]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = items.filter((i) => (category === "All" || i.category === category) && (!q || `${i.name} ${i.category} ${i.description}`.toLowerCase().includes(q)));
    const by: Record<SortId, (a: CatalogItem, b: CatalogItem) => number> = {
      trust: (a, b) => b.trust - a.trust,
      price: (a, b) => a.priceUsd - b.priceUsd,
      speed: (a, b) => a.latencyMs - b.latencyMs,
    };
    return list.sort((a, b) => Number(a.offline) - Number(b.offline) || by[sort](a, b));
  }, [items, query, category, sort]);

  return (
    <>
      <div className="flex flex-col gap-4">
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
        {shown.map((item) => (
          <li key={item.name} className={cn("flex flex-col border-2 border-coal bg-[#fffdf7] transition-transform duration-150 hover:-translate-y-1 hover:shadow-[6px_6px_0_var(--color-coal)]", item.offline && "opacity-55")}>
            {/* the awning */}
            <div aria-hidden className="h-4 border-b-2 border-coal" style={{ background: `repeating-linear-gradient(90deg, ${item.color} 0 22px, #fffdf7 22px 44px)` }} />
            <div className="flex flex-1 flex-col p-5">
              <div className="flex items-start gap-3">
                <span aria-hidden className="grid size-12 shrink-0 place-items-center border-2 border-coal text-2xl" style={{ background: item.color }}>
                  {item.emoji}
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-xl font-bold tracking-tight">{item.name}</h2>
                  <p className="font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-coal/55">{item.category}</p>
                </div>
                <p className="shrink-0 text-right">
                  <span className="tnum block font-mono text-xl font-bold leading-none">${item.priceUsd.toFixed(3)}</span>
                  <span className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-coal/50">per call</span>
                </p>
              </div>
              <p className="mt-3 flex-1 leading-snug text-coal/75">{item.description}</p>
              <dl className="mt-4 grid grid-cols-4 gap-2 border-t-2 border-coal/10 pt-3">
                <Stat label="Speed" value={speed(item.latencyMs)} />
                <Stat label="Quality" value={item.quality.toFixed(0)} />
                <Stat label="Trust" value={item.trust.toFixed(0)} />
                <Stat label="Calls" value={count(item.calls)} />
              </dl>
              {item.offline ? <p className="mt-3 font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-[#d43c3c]">Offline</p> : null}
            </div>
          </li>
        ))}
      </ul>
      {shown.length === 0 ? <p className="mt-10 text-center text-lg text-coal/60">Nothing matches that. Try another word.</p> : null}
    </>
  );
}
