"use client";

import { Dialog as D } from "@base-ui/react/dialog";
import { XIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The app's modal, in the landing's voice: cream card, coal outline, hard shadow. Slides up from the
 * bottom as a sheet on a phone, pops in at the centre on a wider screen. Focus is trapped and Escape
 * closes it (Base UI).
 */
export function Modal({ open, onOpenChange, title, kicker, children, className, wide = false }: { open: boolean; onOpenChange: (open: boolean) => void; title: React.ReactNode; kicker?: React.ReactNode; children: React.ReactNode; className?: string; wide?: boolean }) {
  return (
    <D.Root open={open} onOpenChange={(o) => onOpenChange(o)}>
      <D.Portal>
        <D.Backdrop className="sy-modal-backdrop fixed inset-0 z-50 bg-coal/35 backdrop-blur-[2px]" />
        <D.Popup
          className={cn(
            "light sy-modal fixed z-50 flex max-h-[92dvh] w-full flex-col border-2 border-coal bg-cream text-coal shadow-[8px_8px_0_var(--color-coal)] outline-none",
            "inset-x-0 bottom-0 max-sm:border-x-0 max-sm:border-b-0 max-sm:shadow-none",
            "sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2",
            wide ? "sm:max-w-[860px]" : "sm:max-w-[560px]",
            "sm:w-[calc(100%-2rem)]",
            className,
          )}
        >
          <header className="flex items-start justify-between gap-4 border-b-2 border-coal bg-sand px-5 py-4">
            <div className="min-w-0">
              {kicker && <p className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-coal/60">{kicker}</p>}
              <D.Title className="mt-0.5 truncate text-[22px] font-bold leading-tight tracking-[-0.03em]">{title}</D.Title>
            </div>
            <D.Close aria-label="Close" className="grid size-9 shrink-0 place-items-center border-2 border-coal bg-surface hover:bg-lime">
              <XIcon className="size-4" strokeWidth={2.5} />
            </D.Close>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">{children}</div>
        </D.Popup>
      </D.Portal>
    </D.Root>
  );
}
