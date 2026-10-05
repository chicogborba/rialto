const WORDS = ["Agentic commerce", "Pay-per-call", "Machine-to-machine", "Zero subscriptions", "x402-native", "Autonomous routing", "On-chain settlement"];

/** Buzzword tape. Pure CSS marquee: no JS, no scroll listeners. */
export function BigStatement() {
  const row = (hidden: boolean) => (
    <ul aria-hidden={hidden} className="flex shrink-0 items-center gap-10 pr-10">
      {WORDS.map((w, i) => (
        <li key={w} className={`whitespace-nowrap text-[clamp(2rem,6vw,5rem)] font-bold uppercase leading-none tracking-[-0.04em] ${i % 2 ? "text-signal" : "sy-stroke"}`}>
          {w}
        </li>
      ))}
    </ul>
  );
  return (
    <section aria-label="What Switchyard is" className="overflow-hidden border-t border-line py-8">
      <div className="sy-marquee flex w-max">
        {row(false)}
        {row(true)}
      </div>
    </section>
  );
}
