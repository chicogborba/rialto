"use client";

import type { TransactionDetail } from "@/lib/api-types";
import { useFetch } from "@/lib/client/useFetch";
import { formatUsdc } from "@/lib/money";
import { Label, ModeBadge } from "@/components/primitives";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="relative border-l border-line-hi pb-5 pl-5 last:pb-0">
      <span className="absolute -left-[9px] top-0 grid size-4 place-items-center bg-signal font-mono text-[9px] font-bold text-ink">{n}</span>
      <Label tone="paper">{title}</Label>
      <div className="mt-2 font-mono text-xs">{children}</div>
    </li>
  );
}

const json = (v: unknown) => JSON.stringify(v, null, 1);

export function TransactionDrawer({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { data } = useFetch<{ transaction: TransactionDetail }>(id ? `/api/transactions/${id}` : null);
  const tx = id ? data?.transaction : undefined;
  const mine = tx?.events.filter((e) => !("providerId" in e) || e.providerId === tx.providerId) ?? [];
  const policy = mine.find((e) => e.type === "policy.checked");
  const failed = tx?.status === "failed_not_charged";

  return (
    <Sheet open={id !== null} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent className="w-full overflow-y-auto border-l border-line bg-surface text-paper sm:max-w-xl">
        <SheetHeader>
          <Label tone="signal">Transaction trace</Label>
          <SheetTitle className="text-2xl font-bold uppercase tracking-tight">{tx ? `${tx.providerName} · ${tx.capability}` : "Loading…"}</SheetTitle>
          <SheetDescription>{tx ? `${tx.runId} / ${tx.stepId} / ${tx.role}` : ""}</SheetDescription>
        </SheetHeader>
        {tx && (
          <ol className="p-4">
            <Step n={1} title="402 request">
              <pre className="overflow-x-auto border border-line bg-ink p-2 text-[11px]">{json(tx.requirements)}</pre>
            </Step>
            <Step n={2} title="Payment">
              <div className="mb-2 flex items-center gap-2"><ModeBadge mode={tx.mode} /><span className="tnum text-base font-bold">{formatUsdc(tx.amountMicro)}</span></div>
              {policy && policy.type === "policy.checked" && (
                <ul className="mb-2 space-y-0.5">
                  {policy.checks.map((c) => <li key={c.rule} className={c.ok ? "text-signal" : "text-fail"}>{c.ok ? "●" : "✕"} {c.rule} <span className="text-muted">— {c.detail}</span></li>)}
                </ul>
              )}
              {tx.txRef ? <div className="break-all text-muted">ref {tx.txRef}</div> : <div className="text-muted">No settlement{failed ? " — not charged" : ""}.</div>}
              {tx.mode === "live" && tx.explorerUrl ? <a className="text-signal underline" href={tx.explorerUrl} target="_blank" rel="noreferrer">Solana Explorer (devnet)</a> : <div className="text-pay">SIMULATED — no blockchain transaction</div>}
            </Step>
            <Step n={3} title="Provider">
              <div>{tx.provider.name} {tx.provider.isDemo && <span className="text-muted">(demo provider)</span>}</div>
              <div className="text-muted">reputation {tx.provider.reputationScore} · quality {tx.provider.qualityScore}% · {tx.network}</div>
            </Step>
            <Step n={4} title="Execution">
              {tx.latencyMs !== null ? <div>{tx.latencyMs}ms · <span className="text-signal">completed</span></div> : <div className="text-fail">{tx.error ?? "failed"} · not charged</div>}
            </Step>
            <Step n={5} title="Result">
              {tx.result ? <pre className="max-h-72 overflow-auto border border-line bg-ink p-2 text-[11px]">{json(tx.result)}</pre> : <span className="text-muted">No result.</span>}
            </Step>
          </ol>
        )}
      </SheetContent>
    </Sheet>
  );
}
