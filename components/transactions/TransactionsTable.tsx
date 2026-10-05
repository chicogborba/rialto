"use client";

import { useState } from "react";
import type { TransactionRow } from "@/lib/api-types";
import { useFetch } from "@/lib/client/useFetch";
import { formatUsd } from "@/lib/money";
import { cn } from "@/lib/utils";
import { Label, ModeBadge } from "@/components/primitives";
import { TransactionDrawer } from "./TransactionDrawer";

export function statusLabel(s: TransactionRow["status"]): { text: string; cls: string } {
  if (s === "settled") return { text: "SETTLED", cls: "text-signal" };
  if (s === "failed_not_charged") return { text: "FAILED · NOT CHARGED", cls: "text-fail" };
  return { text: "REJECTED BY POLICY", cls: "text-pay" };
}

export function TransactionsTable() {
  const { data, loading } = useFetch<{ rows: TransactionRow[] }>("/api/transactions?limit=100");
  const [openId, setOpenId] = useState<string | null>(null);
  const rows = data?.rows ?? [];
  return (
    <>
      <div className="overflow-x-auto border border-line">
        <table className="w-full min-w-[900px] text-left">
          <thead>
            <tr className="border-b border-line bg-surface">
              {["Timestamp", "Agent", "Capability", "Provider", "Amount", "Network", "Status", "Mode"].map((h) => (
                <th key={h} scope="col" className="px-3 py-2"><Label>{h}</Label></th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => {
              const st = statusLabel(t.status);
              return (
                <tr key={t.id} className="tnum cursor-pointer border-b border-line font-mono text-xs hover:bg-raised" onClick={() => setOpenId(t.id)}>
                  <td className="px-3 py-2.5">
                    <button type="button" className="text-left underline-offset-2 hover:underline" onClick={(e) => { e.stopPropagation(); setOpenId(t.id); }}>
                      {new Date(t.createdAt).toLocaleString("en-GB", { hour12: false })}
                    </button>
                  </td>
                  <td className="px-3 py-2.5 text-muted">{t.agentId.replace("agent_", "")}</td>
                  <td className="px-3 py-2.5">{t.capability}</td>
                  <td className="px-3 py-2.5 font-display text-sm font-bold">{t.providerName}</td>
                  <td className={cn("px-3 py-2.5 font-bold", t.status !== "settled" && "text-muted line-through")}>{formatUsd(t.amountMicro)}</td>
                  <td className="px-3 py-2.5 text-muted">{t.network}</td>
                  <td className={cn("px-3 py-2.5 text-[10px] font-bold tracking-wider", st.cls)}>{st.text}</td>
                  <td className="px-3 py-2.5"><ModeBadge mode={t.mode} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && !loading && <p className="p-4 font-mono text-xs text-muted">No transactions yet. Run the agent.</p>}
      </div>
      <TransactionDrawer id={openId} onClose={() => setOpenId(null)} />
    </>
  );
}
