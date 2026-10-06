"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

/** A code block with a copy button. `display` is what the user sees, `value` what lands on the clipboard. */
export function CopyBlock({ value, display, className }: { value: string; display?: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked: the text is selectable */
    }
  };
  return (
    <div className={cn("relative border border-line-hi bg-ink", className)}>
      <pre className="overflow-x-auto p-3 pr-24 font-mono text-xs leading-relaxed text-paper">{display ?? value}</pre>
      <button
        type="button"
        onClick={copy}
        className="absolute right-2 top-2 inline-flex min-h-9 items-center gap-1.5 border border-line-hi bg-surface px-2.5 font-mono text-[10px] font-bold uppercase tracking-wider hover:border-signal hover:text-signal"
      >
        {copied ? <Check className="size-3" aria-hidden /> : <Copy className="size-3" aria-hidden />}
        <span aria-live="polite">{copied ? "Copied" : "Copy"}</span>
      </button>
    </div>
  );
}
