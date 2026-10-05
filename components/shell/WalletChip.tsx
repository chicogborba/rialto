"use client";

import type { WalletResponse } from "@/lib/api-types";
import { useFetch } from "@/lib/client/useFetch";
import { formatUsd } from "@/lib/money";
import { CountUp, ModeBadge, StatusDot } from "@/components/primitives";

export function WalletChip() {
  const { data } = useFetch<WalletResponse>("/api/wallet");
  if (!data) return <div className="h-9 w-48 border border-line" aria-hidden />;
  const { wallet, mode } = data;
  const within = wallet.sessionSpendMicro <= wallet.policy.sessionBudgetMicro;
  return (
    <div className="flex items-center gap-3">
      <ModeBadge mode={mode} />
      <div className="flex items-center gap-3 border border-line px-3 py-2 font-mono text-[11px] uppercase tracking-wider" aria-label="Agent wallet">
        <span className="tnum text-paper"><CountUp value={wallet.balanceMicro} format={(n) => `${formatUsd(Math.round(n))} USDC`} /></span>
        <span className="hidden text-muted sm:inline tnum">
          {formatUsd(wallet.sessionSpendMicro)} / {formatUsd(wallet.policy.sessionBudgetMicro)}
        </span>
        <span className="flex items-center gap-1.5 text-muted">
          <StatusDot tone={within ? "ok" : "fail"} />
          <span className="hidden md:inline">{within ? "Within policy" : "Over policy"}</span>
        </span>
      </div>
    </div>
  );
}
