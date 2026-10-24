"use client";

import { useState } from "react";

export interface Bar {
  /** label under the bar (may be empty to thin out the axis) */
  tick: string;
  /** what the tooltip calls this bar */
  title: string;
  value: number;
}

/**
 * One series of bars on the dashboard surface: coal marks with rounded tops (lime under the pointer), a 2 px gap between
 * bars, a recessive baseline and a tooltip on hover or focus. The numbers are also in a table for
 * screen readers.
 */
export function BarChart({ bars, format, height = 160, label }: { bars: Bar[]; format: (v: number) => string; height?: number; label: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(0, ...bars.map((b) => b.value));
  const w = 100 / Math.max(1, bars.length);
  const active = hover === null ? null : bars[hover];
  return (
    <figure className="relative">
      <div className="relative" style={{ height }} onMouseLeave={() => setHover(null)}>
        <div aria-hidden className="absolute inset-x-0 bottom-0 border-t border-line-hi" />
        <div aria-hidden className="absolute inset-x-0 top-0 border-t border-dashed border-line" />
        <span aria-hidden className="tnum absolute -top-5 right-0 font-mono text-[10px] text-muted">{format(max)}</span>
        {max === 0 && <span className="absolute inset-0 grid place-items-center font-mono text-[11px] text-muted">Nothing yet in this range</span>}
        <div className="absolute inset-0 flex items-end">
          {bars.map((b, i) => {
            const h = max > 0 ? Math.max(b.value > 0 ? 2 : 0, (b.value / max) * (height - 4)) : 0;
            return (
              <button
                key={i}
                type="button"
                aria-label={`${b.title}: ${format(b.value)}`}
                onMouseEnter={() => setHover(i)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                className="group flex h-full items-end px-px focus-visible:outline-none"
                style={{ width: `${w}%` }}
              >
                <span className={`block w-full rounded-t-[4px] transition-colors ${hover === i ? "bg-signal outline-2 outline-paper" : "bg-paper"} group-focus-visible:bg-signal`} style={{ height: h }} />
              </button>
            );
          })}
        </div>
        {active && hover !== null && (
          <div className="pointer-events-none absolute z-10 -translate-x-1/2 border border-line-hi bg-raised px-2.5 py-1.5 font-mono text-[11px] shadow-lg" style={{ left: `${Math.min(92, Math.max(8, (hover + 0.5) * w))}%`, bottom: height + 6 }}>
            <span className="block whitespace-nowrap text-muted">{active.title}</span>
            <span className="tnum block font-bold text-paper">{format(active.value)}</span>
          </div>
        )}
      </div>
      <div aria-hidden className="mt-1.5 flex">
        {bars.map((b, i) => (
          <span key={i} className="truncate text-center font-mono text-[9px] text-muted" style={{ width: `${w}%` }}>
            {b.tick}
          </span>
        ))}
      </div>
      <table className="sr-only">
        <caption>{label}</caption>
        <tbody>
          {bars.map((b, i) => (
            <tr key={i}>
              <th scope="row">{b.title}</th>
              <td>{format(b.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
