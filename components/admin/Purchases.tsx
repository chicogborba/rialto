"use client";

import { useCallback, useEffect, useState } from "react";
import { Label, Panel } from "@/components/primitives";
import type { ModeFilter, PurchaseRow } from "@/lib/admin/stats";
import { api } from "@/lib/client/api";
import { cn } from "@/lib/utils";
import { Segmented, usd } from "./Overview";

type StatusFilter = "any" | "settled" | "failed";

/** Every purchase, newest first: who bought what, what it cost upstream and what Rialto kept. */
export function AdminPurchases() {
  const [mode, setMode] = useState<ModeFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("any");
  const [rows, setRows] = useState<PurchaseRow[] | null>(null);
  const [more, setMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPage = useCallback(
    async (before?: string) => {
      const q = new URLSearchParams({ mode, ...(status === "any" ? {} : { status }), ...(before ? { before } : {}) });
      const r = await api<{ rows: PurchaseRow[] }>(`/api/admin/purchases?${q}`);
      if (!r.ok || !r.data) {
        setError(r.error);
        return;
      }
      setError(null);
      const page = r.data.rows;
      setRows((cur) => (before ? [...(cur ?? []), ...page] : page));
      setMore(page.length === 50);
    },
    [mode, status],
  );

  useEffect(() => {
    let alive = true;
    void Promise.resolve().then(() => {
      if (alive) void fetchPage();
    });
    return () => {
      alive = false;
    };
  }, [fetchPage]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-[clamp(2.1rem,4.5vw,3.2rem)] font-bold leading-[0.95] tracking-[-0.05em]">Purchases</h1>
        <div className="flex flex-wrap gap-2">
          <Segmented label="Status" value={status} onChange={setStatus} options={[{ id: "any", label: "All" }, { id: "settled", label: "Paid" }, { id: "failed", label: "Failed" }]} />
          <Segmented label="Payments" value={mode} onChange={setMode} options={[{ id: "all", label: "All" }, { id: "live", label: "On-chain" }, { id: "simulated", label: "Simulated" }]} />
        </div>
      </div>
      {error && <p role="alert" className="font-mono text-xs text-fail">{error}</p>}
      <Panel bodyClassName="p-0" className="overflow-x-auto">
        <table className="w-full min-w-[960px] text-sm">
          <thead>
            <tr className="border-b border-line text-left">
              {["When", "Buyer", "API", "Paid", "Commission", "API cost", "Profit", "Status", ""].map((h, i) => (
                <th key={h || i} className={cn("px-3 py-2", i >= 3 && i <= 6 && "text-right")}><Label>{h}</Label></th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {(rows ?? []).map((r) => (
              <tr key={r.id} className="align-top">
                <td className="whitespace-nowrap px-3 py-2 font-mono text-[11px] text-muted">{new Date(r.at).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "medium" })}</td>
                <td className="max-w-[14rem] truncate px-3 py-2" title={r.buyer}>
                  <span className="font-mono text-[10px] text-muted">{r.buyerKind === "user" ? "ACCOUNT" : r.buyerKind === "wallet" ? "WALLET" : "AGENT"}</span> {r.buyer}
                </td>
                <td className="px-3 py-2">
                  <span className="font-bold">{r.api}</span> <span className="font-mono text-[10px] text-muted">{r.operator ? "RIALTO · " : ""}{r.capability}</span>
                </td>
                <td className="tnum px-3 py-2 text-right font-mono">{usd(r.amountMicro)}</td>
                <td className="tnum px-3 py-2 text-right font-mono text-muted">{usd(r.feeMicro)}</td>
                <td className="tnum px-3 py-2 text-right font-mono text-muted">{r.costMicro ? usd(r.costMicro) : "—"}</td>
                <td className="tnum px-3 py-2 text-right font-mono font-bold">{usd(r.profitMicro)}</td>
                <td className="px-3 py-2 font-mono text-[11px]">
                  <span className={r.status === "settled" ? "text-signal" : "text-fail"}>{r.status === "settled" ? "PAID" : r.status.toUpperCase()}</span>
                  <span className="block text-[10px] text-muted">{r.mode === "live" ? r.network : "simulated"}{r.latencyMs ? ` · ${(r.latencyMs / 1000).toFixed(1)} s` : ""}</span>
                  {r.error && <span className="block max-w-[14rem] truncate text-[10px] text-fail" title={r.error}>{r.error}</span>}
                </td>
                <td className="px-3 py-2 font-mono text-[11px]">
                  {r.explorerUrl && (
                    <a href={r.explorerUrl} target="_blank" rel="noreferrer" className="text-muted underline hover:text-signal">
                      tx ↗
                    </a>
                  )}
                </td>
              </tr>
            ))}
            {rows && rows.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center font-mono text-xs text-muted">Nothing here yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </Panel>
      {more && rows && (
        <button type="button" onClick={() => void fetchPage(rows[rows.length - 1].at)} className="border border-line px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-wider text-muted hover:border-signal hover:text-signal">
          Older purchases
        </button>
      )}
    </div>
  );
}
