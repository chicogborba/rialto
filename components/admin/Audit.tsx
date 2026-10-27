"use client";

import { CircleAlert, CircleCheck, ExternalLink, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { shortAddress } from "@/components/account/ui";
import type { Audit, LegAudit } from "@/lib/admin/audit";
import { api } from "@/lib/client/api";
import { cn } from "@/lib/utils";
import { Segmented, usd } from "./Overview";

type Leg = "fee" | "integrations";
const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit" });

/**
 * "Am I really getting my cut?" Reads the commission wallet and the integrations wallet on Solana and
 * matches every recent on-chain purchase to the transfer that paid it.
 */
export function AdminAudit() {
  const [limit, setLimit] = useState<"50" | "100" | "200">("50");
  const [audit, setAudit] = useState<Audit | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [leg, setLeg] = useState<Leg>("fee");

  const load = useCallback(async () => {
    setBusy(true);
    const r = await api<Audit>(`/api/admin/audit?limit=${limit}`);
    setBusy(false);
    if (r.ok && r.data) {
      setAudit(r.data);
      setError(r.data.error ?? null);
    } else setError(r.error ?? "Could not run the audit.");
  }, [limit]);

  useEffect(() => {
    let alive = true;
    void Promise.resolve().then(() => {
      if (alive) void load();
    });
    return () => {
      alive = false;
    };
  }, [load]);

  const fee = audit?.fee;
  const all = (fee?.rows.length ?? 0) + (audit?.integrations.rows.length ?? 0);
  const missing = (fee?.missing ?? 0) + (audit?.integrations.missing ?? 0);
  const shown: LegAudit | undefined = audit ? audit[leg] : undefined;

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[clamp(2.1rem,4.5vw,3.2rem)] font-bold leading-[0.95] tracking-[-0.05em]">Is Rialto getting paid?</h1>
          <p className="mt-2 max-w-2xl text-coal/70">Every recent on-chain purchase, checked against Solana itself: the commission must have reached the commission wallet, and Rialto&apos;s own integrations must have paid the integrations wallet.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented label="How many purchases" value={limit} onChange={setLimit} options={[{ id: "50", label: "Last 50" }, { id: "100", label: "100" }, { id: "200", label: "200" }]} />
          <button type="button" onClick={() => void load()} disabled={busy} className="flex min-h-9 items-center gap-1.5 border-2 border-coal bg-lime px-3 text-sm font-bold shadow-[3px_3px_0_var(--color-coal)] disabled:opacity-60">
            <RefreshCw className={cn("size-4", busy && "animate-spin")} aria-hidden /> {busy ? "Reading Solana…" : "Check again"}
          </button>
        </div>
      </div>

      {error && <p role="alert" className="border-l-4 border-fail py-1 pl-3 text-sm font-medium text-fail">{error}</p>}

      {audit && !audit.error && (
        <>
          {/* the verdict */}
          <section className={cn("flex items-start gap-4 border-2 border-coal p-5 shadow-[5px_5px_0_var(--color-coal)]", missing === 0 ? "bg-lime" : "bg-[#ffd9c2]")}>
            {missing === 0 ? <CircleCheck className="mt-1 size-8 shrink-0" strokeWidth={2.4} aria-hidden /> : <CircleAlert className="mt-1 size-8 shrink-0" strokeWidth={2.4} aria-hidden />}
            <div>
              <p className="text-2xl font-bold tracking-[-0.03em]">
                {all === 0 ? "No on-chain purchases yet." : missing === 0 ? `All ${all} payments to Rialto found on Solana.` : `${missing} of ${all} payments to Rialto not found on Solana.`}
              </p>
              <p className="mt-1 text-coal/75">
                {fee && fee.rows.length > 0 && <>Commission: {usd(fee.confirmedMicro)} confirmed of {usd(fee.expectedMicro)} recorded. </>}
                {audit.integrations.rows.length > 0 && <>Integrations: {usd(audit.integrations.confirmedMicro)} of {usd(audit.integrations.expectedMicro)}. </>}
                {audit.since && <>Purchases since {when(audit.since)}, {audit.network}. </>}
                Checked {when(audit.checkedAt)}.
              </p>
            </div>
          </section>

          <div className="grid gap-4 md:grid-cols-2">
            <WalletCard title="Commission wallet" note={`${audit.feeRule.bps / 100}% of the seller's price, at least ${usd(audit.feeRule.minMicro)} a call`} leg={audit.fee} />
            <WalletCard title="Integrations wallet" note="What Rialto's own APIs sell for: upstream cost plus margin" leg={audit.integrations} />
          </div>

          <section className="border-2 border-coal bg-surface shadow-[5px_5px_0_var(--color-coal)]">
            <header className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-coal px-5 py-3.5">
              <h2 className="text-lg font-bold tracking-[-0.02em]">Purchase by purchase</h2>
              <Segmented label="Which wallet" value={leg} onChange={setLeg} options={[{ id: "fee", label: `Commission (${audit.fee.rows.length})` }, { id: "integrations", label: `Integrations (${audit.integrations.rows.length})` }]} />
            </header>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-sm">
                <thead>
                  <tr className="border-b-2 border-coal/10 text-left text-xs text-coal/60">
                    <th className="px-4 py-2 font-medium">When</th>
                    <th className="px-4 py-2 font-medium">Buyer</th>
                    <th className="px-4 py-2 font-medium">API</th>
                    <th className="px-4 py-2 text-right font-medium">Recorded</th>
                    {leg === "fee" && <th className="px-4 py-2 text-right font-medium">Rule says</th>}
                    <th className="px-4 py-2 text-right font-medium">On Solana</th>
                    <th className="px-4 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y-2 divide-coal/5">
                  {shown?.rows.map((r) => (
                    <tr key={r.id}>
                      <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs text-coal/60">{when(r.at)}</td>
                      <td className="max-w-[14rem] truncate px-4 py-2.5" title={r.buyer}>{r.buyer}</td>
                      <td className="px-4 py-2.5 font-bold">{r.api}</td>
                      <td className="tnum px-4 py-2.5 text-right font-mono">{usd(r.expectedMicro)}</td>
                      {leg === "fee" && <td className={cn("tnum px-4 py-2.5 text-right font-mono", r.formulaMicro !== null && r.formulaMicro !== r.expectedMicro ? "text-pay" : "text-coal/50")} title="What today's commission rule gives for this price">{r.formulaMicro !== null ? usd(r.formulaMicro) : ""}</td>}
                      <td className="tnum px-4 py-2.5 text-right font-mono font-bold">{r.receivedMicro !== null ? usd(r.receivedMicro) : "none"}</td>
                      <td className="whitespace-nowrap px-4 py-2.5">
                        <span className={cn("inline-flex items-center gap-1 border-2 border-coal px-1.5 py-0.5 text-xs font-bold", r.status === "confirmed" ? "bg-lime" : "bg-[#ffb59a]")}>
                          {r.status === "confirmed" ? "Confirmed" : r.status === "missing" ? "Not found" : "Wrong amount"}
                        </span>
                        {r.explorerUrl && (
                          <a href={r.explorerUrl} target="_blank" rel="noreferrer" className="ml-2 inline-flex items-center gap-0.5 text-xs text-coal/60 underline hover:text-coal" title={r.matchedBy === "signature" ? "Matched by its recorded signature" : "Matched by amount and time"}>
                            tx <ExternalLink className="size-3" aria-hidden />
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                  {shown && shown.rows.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-coal/60">No purchases to check here.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {shown && shown.unmatched.length > 0 && (
            <section>
              <h2 className="text-lg font-bold tracking-[-0.02em]">Arrived without a purchase</h2>
              <p className="mt-1 text-sm text-coal/60">Transfers into this wallet in the same period that no recorded purchase accounts for: top-ups, tests, or a purchase older than the window.</p>
              <ul className="mt-3 divide-y-2 divide-coal/10 border-2 border-coal bg-surface">
                {shown.unmatched.map((t) => (
                  <li key={t.signature} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                    <span className="font-mono text-xs text-coal/60">{when(t.at)}</span>
                    <span className="tnum font-mono font-bold">{usd(t.amountMicro)}</span>
                    <a href={t.explorerUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-xs underline">
                      tx <ExternalLink className="size-3" aria-hidden />
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <p className="text-xs text-coal/55">Purchases made from now on record the commission transfer&apos;s own signature and are matched by it. Older ones are matched to the transfer of exactly the recorded amount closest in time (within 10 minutes).</p>
        </>
      )}
      {!audit && !error && <div className="h-40 animate-pulse border-2 border-coal/15 bg-surface" aria-busy="true" />}
    </div>
  );
}

function WalletCard({ title, note, leg }: { title: string; note: string; leg: LegAudit }) {
  return (
    <section className="border-2 border-coal bg-coal p-5 text-cream">
      <p className="text-sm text-cream/60">{title}</p>
      {leg.wallet ? (
        <a href={leg.walletUrl ?? "#"} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-mono text-sm text-cream/80 underline decoration-cream/30 hover:text-cream">
          {shortAddress(leg.wallet)} <ExternalLink className="size-3" aria-hidden />
        </a>
      ) : (
        <p className="font-mono text-sm text-cream/60">not set</p>
      )}
      <p className="mt-4 text-sm text-cream/60">USDC in it now, on Solana</p>
      <p className="tnum text-4xl font-bold tracking-[-0.03em]">{leg.balanceMicro === null ? "none" : usd(leg.balanceMicro)}</p>
      <p className="mt-3 text-xs text-cream/55">{note}</p>
    </section>
  );
}
