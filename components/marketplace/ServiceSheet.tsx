"use client";

import type { TransactionRow } from "@/lib/api-types";
import { useFetch } from "@/lib/client/useFetch";
import { formatUsd } from "@/lib/money";
import type { Candidate } from "@/lib/types";
import { Label, ModeBadge } from "@/components/primitives";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

export function ServiceSheet({ candidate, onClose }: { candidate: Candidate | null; onClose: () => void }) {
  const { data } = useFetch<{ rows: TransactionRow[] }>(candidate ? "/api/transactions?limit=200" : null);
  const recent = (data?.rows ?? []).filter((t) => candidate && t.providerId === candidate.provider.id).slice(0, 5);
  return (
    <Sheet open={candidate !== null} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent className="w-full overflow-y-auto border-l border-line bg-surface text-paper sm:max-w-lg">
        {candidate && (
          <>
            <SheetHeader>
              <Label tone="signal">{candidate.provider.isDemo ? "Demo provider · fictional" : "Registered provider"}</Label>
              <SheetTitle className="text-2xl font-bold uppercase tracking-tight">{candidate.provider.name}</SheetTitle>
              <SheetDescription>{candidate.provider.description}</SheetDescription>
            </SheetHeader>
            <div className="space-y-5 p-4 font-mono text-xs">
              <dl className="grid grid-cols-2 gap-3">
                <div><dt><Label>Capability</Label></dt><dd className="mt-1">{candidate.service.capability}</dd></div>
                <div><dt><Label>Price</Label></dt><dd className="mt-1 text-base font-bold">{formatUsd(candidate.service.priceMicro)}</dd></div>
                <div><dt><Label>Endpoint</Label></dt><dd className="mt-1 break-all">{candidate.service.endpoint}</dd></div>
                <div><dt><Label>Network</Label></dt><dd className="mt-1">{candidate.provider.network}</dd></div>
              </dl>
              <div><Label>Input schema</Label><pre className="mt-1 overflow-x-auto border border-line bg-ink p-2 text-[11px]">{candidate.service.inputSchema}</pre></div>
              <div><Label>Output schema</Label><pre className="mt-1 overflow-x-auto border border-line bg-ink p-2 text-[11px]">{candidate.service.outputSchema}</pre></div>
              <div>
                <Label>Recent transactions</Label>
                {recent.length === 0 ? <p className="mt-1 text-muted">None yet.</p> : (
                  <ul className="mt-2 space-y-1">
                    {recent.map((t) => (
                      <li key={t.id} className="flex items-center justify-between gap-2 border-b border-line py-1">
                        <span className="tnum">{formatUsd(t.amountMicro)}</span>
                        <span className="text-muted">{t.status.replaceAll("_", " ")}</span>
                        <ModeBadge mode={t.mode} />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
