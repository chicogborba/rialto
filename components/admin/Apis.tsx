"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Label, Panel } from "@/components/primitives";
import { api } from "@/lib/client/api";
import { cn } from "@/lib/utils";
import { Segmented, usd } from "./Overview";

interface ApiRow {
  providerId: string;
  slug: string;
  name: string;
  status: string;
  operator: boolean;
  seller: string;
  model: string | null;
  capability: string;
  costMicro: number;
  sellerPriceMicro: number;
  buyerPriceMicro: number;
  profitMicro: number;
  payTo: string;
  purchases30d: number;
  gross30dMicro: number;
}

/** Every API on sale: for Rialto's own, what fal charges, what Rialto asks and what it keeps per call. */
export function AdminApis() {
  const [rows, setRows] = useState<ApiRow[] | null>(null);
  const [who, setWho] = useState<"rialto" | "sellers">("rialto");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await api<{ rows: ApiRow[] }>("/api/admin/integrations");
    if (r.ok && r.data) setRows(r.data.rows);
    else setError(r.error);
  }, []);
  useEffect(() => {
    let alive = true;
    void Promise.resolve().then(() => {
      if (alive) void load();
    });
    return () => {
      alive = false;
    };
  }, [load]);

  const shown = useMemo(() => (rows ?? []).filter((r) => (who === "rialto" ? r.operator : !r.operator)), [rows, who]);

  const toggle = async (r: ApiRow) => {
    const status = r.status === "offline" ? "online" : "offline";
    const res = await api("/api/admin/integrations", { json: { providerId: r.providerId, status } });
    if (res.ok) void load();
    else setError(res.error);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[clamp(2.1rem,4.5vw,3.2rem)] font-bold leading-[0.95] tracking-[-0.05em]">APIs & prices</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Buyer pays = seller price + commission. For Rialto&apos;s integrations the seller price is fal&apos;s cost + your margin, so each call earns both. Change the margin and the commission in{" "}
            <Link href="/admin/settings" className="text-signal underline">Keys & wallets</Link>.
          </p>
        </div>
        <Segmented label="Whose APIs" value={who} onChange={setWho} options={[{ id: "rialto", label: "Rialto's" }, { id: "sellers", label: "Sellers'" }]} />
      </div>
      {error && <p role="alert" className="font-mono text-xs text-fail">{error}</p>}
      <Panel bodyClassName="p-0" className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-sm">
          <thead>
            <tr className="border-b border-line text-left">
              {["API", who === "rialto" ? "API cost" : "Seller", "Seller price", "Buyer pays", "Rialto keeps", "30 days", "Status"].map((h, i) => (
                <th key={h} className={cn("px-3 py-2", i >= 1 && i <= 5 && "text-right")}><Label>{h}</Label></th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {shown.map((r) => (
              <tr key={`${r.providerId}:${r.capability}`} className={r.status === "offline" ? "opacity-50" : undefined}>
                <td className="px-3 py-2">
                  <span className="block font-bold">{r.name}</span>
                  <span className="block font-mono text-[10px] text-muted">{r.capability}{r.model ? ` · ${r.model}` : ""}</span>
                </td>
                <td className="tnum px-3 py-2 text-right font-mono text-muted">{who === "rialto" ? (r.costMicro ? usd(r.costMicro) : "—") : <span className="font-sans">{r.seller}</span>}</td>
                <td className="tnum px-3 py-2 text-right font-mono">{usd(r.sellerPriceMicro)}</td>
                <td className="tnum px-3 py-2 text-right font-mono font-bold">{usd(r.buyerPriceMicro)}</td>
                <td className="tnum px-3 py-2 text-right font-mono text-signal">
                  {usd(r.profitMicro)}
                  {r.operator && r.costMicro > 0 && <span className="block text-[10px] text-muted">{Math.round((r.profitMicro / r.costMicro) * 100)}% over cost</span>}
                </td>
                <td className="tnum px-3 py-2 text-right font-mono">
                  {r.purchases30d}
                  <span className="block text-[10px] text-muted">{usd(r.gross30dMicro)}</span>
                </td>
                <td className="px-3 py-2">
                  <button type="button" onClick={() => void toggle(r)} className={cn("border px-2 py-1 font-mono text-[10px] font-bold uppercase", r.status === "offline" ? "border-line text-muted hover:border-signal hover:text-signal" : "border-signal text-signal hover:bg-signal hover:text-ink")} title={r.status === "offline" ? "Put back on sale" : "Pause: buyers cannot call it"}>
                    {r.status === "offline" ? "Paused" : "On sale"}
                  </button>
                </td>
              </tr>
            ))}
            {rows && shown.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center font-mono text-xs text-muted">{who === "rialto" ? "No integrations yet: add the fal.ai key in Keys & wallets." : "No seller has published an API yet."}</td>
              </tr>
            )}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}
