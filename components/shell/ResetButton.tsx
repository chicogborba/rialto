"use client";

import { RotateCcw } from "lucide-react";
import { useState } from "react";
import { emitDataChanged } from "@/lib/client/data-events";
import { HardButton } from "@/components/primitives";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export function ResetButton() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [refused, setRefused] = useState(false);
  const reset = async () => {
    setBusy(true);
    const res = await fetch("/api/reset", { method: "POST" }).catch(() => null);
    setBusy(false);
    // a public server keeps its data: only its operator can reset it
    if (!res?.ok) return setRefused(true);
    setOpen(false);
    emitDataChanged();
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<button type="button" className="inline-flex min-h-9 items-center gap-1.5 border border-line-hi px-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-muted hover:border-signal hover:text-signal" />}>
        <RotateCcw className="size-3" aria-hidden /> Reset demo
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset the demo?</DialogTitle>
          <DialogDescription>
            {refused ? "Resetting is turned off on this server. Run it locally to start from a clean demo." : "Wipes all runs, transactions and registered providers, restores the $10.00 wallet and reseeds the fictional providers."}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <HardButton variant="ghost" onClick={() => setOpen(false)}>Cancel</HardButton>
          {refused ? null : <HardButton variant="pay" onClick={reset} disabled={busy}>{busy ? "Resetting…" : "Reset"}</HardButton>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
