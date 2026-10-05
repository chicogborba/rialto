import { cn } from "@/lib/utils";

/** CSS marquee. Duplicates content for seamless loop; static under reduced motion (see globals.css). */
export function Ticker({ items, className }: { items: string[]; className?: string }) {
  const row = (suffix: string, hidden: boolean) => (
    <ul className="flex shrink-0 items-center gap-10 pr-10" aria-hidden={hidden}>
      {items.map((t, i) => (
        <li key={`${suffix}-${i}`} className="whitespace-nowrap font-mono text-[11px] uppercase tracking-[0.12em] text-muted">
          <span className="mr-2 text-signal">▸</span>
          {t}
        </li>
      ))}
    </ul>
  );
  return (
    <div className={cn("overflow-hidden border-y border-line py-3", className)}>
      <div className="sy-marquee flex w-max">
        {row("a", false)}
        {row("b", true)}
      </div>
    </div>
  );
}
