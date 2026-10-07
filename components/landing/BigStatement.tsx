import { Buddy } from "./Buddy";

const A = ["Built for Solana", "◎", "Agentic commerce", "🤝", "Pay-per-call", "⚡", "Machine-to-machine", "🤖", "Zero subscriptions", "💸"];
const B = ["400 ms blocks", "⚡", "x402-native", "🚦", "Autonomous routing", "🧠", "On-chain settlement", "⛓️", "No humans in the loop", "👀"];

function Tape({ words, className, reverse }: { words: string[]; className: string; reverse?: boolean }) {
  const row = (hidden: boolean) => (
    <ul aria-hidden={hidden} className="flex shrink-0 items-center gap-8 pr-8">
      {words.map((w) => (
        <li key={w} className="whitespace-nowrap text-[clamp(1.4rem,3.6vw,3rem)] font-bold uppercase leading-none tracking-[-0.03em]">{w}</li>
      ))}
    </ul>
  );
  return (
    <div className={`absolute left-[-5%] w-[110%] border-y-2 border-ink py-3 ${className}`}>
      <div className={`${reverse ? "sy-marquee-rev" : "sy-marquee"} flex w-max`}>
        {row(false)}
        {row(true)}
      </div>
    </div>
  );
}

/** Two crossing buzzword tapes. Pure CSS: no JS, no scroll listeners. */
export function BigStatement() {
  return (
    <section aria-label="What Rialto is, in buzzwords" className="relative h-52 overflow-hidden border-t border-line md:h-64">
      <Tape words={A} className="top-8 -rotate-3 bg-signal text-ink md:top-12" />
      <Tape words={B} className="top-24 rotate-2 bg-paper text-ink md:top-32" reverse />
      {/* he strolls across between the tapes */}
      <div aria-hidden className="sy-walk absolute bottom-1 left-0">
        <Buddy mood="happy" className="w-16 md:w-24" />
      </div>
    </section>
  );
}
