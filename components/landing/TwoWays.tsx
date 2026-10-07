import Link from "next/link";
import { hardButtonClass } from "@/components/primitives";
import { Buddy } from "./Buddy";
import { Rise } from "./Rise";
import { Slap } from "./Stickers";
import { flowHref } from "@/lib/site";

const SELL = [
  ["📋", "Paste your endpoint", "Any HTTPS API. We call it for you."],
  ["💵", "Set your price", "Per successful call. You keep 100% of it."],
  ["⚡", "Get paid per call", "Agents find and hire you. Withdraw anytime."],
] as const;

const BUY = [
  ["🔑", "Get a key", "Takes ten seconds. Starts with test credit."],
  ["📟", "Paste one command", "Claude Code or Codex. That's the setup."],
  ["🛒", "Just ask", "Your agent hires and pays the best API for the job."],
] as const;

function Card({ tone, tag, title, sub, steps, cta, href, rotate }: { tone: "signal" | "paper"; tag: string; title: React.ReactNode; sub: string; steps: readonly (readonly [string, string, string])[]; cta: string; href: string; rotate: number }) {
  const light = tone === "paper";
  return (
    <div className={`relative flex flex-col border-2 border-ink p-6 md:p-8 ${light ? "bg-paper text-ink" : "bg-signal text-ink"} shadow-[8px_8px_0_var(--color-line-hi)]`}>
      <Slap tone={light ? "signal" : "paper"} rotate={rotate} still className="absolute -top-4 left-5">{tag}</Slap>
      <h3 className="mt-3 text-[clamp(2rem,4.4vw,3.6rem)] font-bold uppercase leading-[0.9] tracking-[-0.04em]">{title}</h3>
      <p className="mt-3 text-lg font-medium opacity-80">{sub}</p>
      <ol className="mt-6 space-y-3">
        {steps.map(([emoji, head, body], i) => (
          <li key={head} className="grid grid-cols-[2.2rem_1fr] items-start gap-3">
            <span aria-hidden className="grid size-9 place-items-center border-2 border-ink bg-ink text-lg">{emoji}</span>
            <span>
              <span className="block font-mono text-[11px] font-bold uppercase tracking-[0.12em] opacity-60">Step {i + 1}</span>
              <span className="block text-lg font-bold leading-tight">{head}</span>
              <span className="block text-sm opacity-75">{body}</span>
            </span>
          </li>
        ))}
      </ol>
      <Link href={href} className={`${hardButtonClass("primary", "lg", "mt-8 self-start !border-ink !bg-ink !text-signal")}`}>{cta}</Link>
    </div>
  );
}

/** The two audiences, each with a three-step flow and one obvious button. */
export function TwoWays() {
  return (
    <section id="start" aria-labelledby="start-title" className="relative scroll-mt-4 border-t border-line">
      <div className="mx-auto max-w-[1440px] px-4 py-16 md:px-10 md:py-24">
        <Rise>
          <h2 id="start-title" className="text-[clamp(2.6rem,8vw,7.5rem)] font-bold uppercase leading-[0.85] tracking-[-0.05em]">
            Pick your <span className="sy-mark">side.</span>
          </h2>
        </Rise>
        <p className="mt-4 max-w-2xl text-lg font-medium text-paper/80">A marketplace needs two kinds of people. Which one are you? 👇</p>
        <div className="mt-12 grid gap-10 lg:grid-cols-2">
          <Card tone="paper" tag="🛠️ I have an API" title={<>Sell it to<br />every agent.</>} sub="Turn an endpoint into income. No billing system, no signup flow, no API keys to hand out." steps={SELL} cta="Publish my API →" href={flowHref("/publish")} rotate={-3} />
          <Card tone="signal" tag="🤖 I use Claude Code / Codex" title={<>Give your agent<br />a marketplace.</>} sub="One command and your agent can pay for the best API for any task, within the budget you set." steps={BUY} cta="Connect my Claude →" href={flowHref("/connect")} rotate={3} />
        </div>
        <div className="mt-12 flex flex-wrap items-center gap-6 border-t border-line pt-8">
          <Buddy mood="wave" className="w-20 md:w-28" />
          <p className="max-w-3xl font-mono text-xs uppercase leading-relaxed tracking-[0.08em] text-muted">
            How it makes money: buyers pay the seller&apos;s price plus a small platform fee, shown upfront on the publish page. Sellers always receive exactly the price they set. Failed calls are never charged.
          </p>
        </div>
      </div>
    </section>
  );
}
