import Image from "next/image";
import Link from "next/link";
import { Buddy } from "@/components/landing/Buddy";
import { fmtK, fmtUsd, HIRED, SOLO } from "@/components/landing/compare-data";
import { DuoCanvas } from "@/components/landing/DuoCanvas";
import { asset, flowHref, REPO_URL } from "@/lib/site";
import { HeroCritter } from "./HeroCritter";
import { HowScroll } from "./HowScroll";
import { STEPS } from "./steps";
import { PitchVideo } from "./PitchVideo";
import { SolanaRace } from "./SolanaRace";

const WRAP = "mx-auto w-full max-w-6xl px-5 md:px-8";
const KICKER = "font-mono text-xs font-bold uppercase tracking-[0.18em] text-coal/55";
const H2 = "mt-3 text-[clamp(2rem,5.2vw,3.75rem)] font-bold leading-[1.02] tracking-[-0.035em]";


const SIDES = [
  {
    tag: "For agents",
    title: "Give your agent a marketplace.",
    body: "One command connects Claude Code or Codex. It hires the best API for each task, within your budget.",
    steps: ["Get a key", "Paste one command", "Just ask"],
    cta: "Connect my agent",
    href: "/connect",
    primary: true,
  },
  {
    tag: "For API owners",
    title: "Get paid per call.",
    body: "Publish any HTTPS endpoint and set a price. Agents find you, and you keep exactly what you charge.",
    steps: ["Paste your endpoint", "Set your price", "Withdraw anytime"],
    cta: "Publish my API",
    href: "/publish",
    primary: false,
  },
] as const;

export function Header() {
  return (
    <header className={`${WRAP} flex items-center justify-between py-5`}>
      <Link href="/" className="flex items-center gap-2 text-xl font-bold tracking-tight">
        <Buddy className="w-8" />
        Rialto
      </Link>
      <nav aria-label="Primary" className="flex items-center gap-6 text-sm font-medium">
        <a href="#how" className="hidden text-coal/70 hover:text-coal md:block">How it works</a>
        <a href="#solana" className="hidden text-coal/70 hover:text-coal md:block">Why Solana</a>
        <a href="#start" className="hidden text-coal/70 hover:text-coal md:block">Get started</a>
        <a href={REPO_URL} className="hidden text-coal/70 hover:text-coal sm:block">GitHub</a>
        <Link href={flowHref("/connect")} className="home-btn home-btn-ink !min-h-10 !px-4 text-sm">Connect</Link>
      </nav>
    </header>
  );
}

export function Hero() {
  return (
    <section className={`${WRAP} grid items-center gap-2 pb-12 pt-6 md:grid-cols-[1.1fr_0.9fr] md:gap-8 md:pb-20 md:pt-12`}>
      <div>
        <p className={KICKER}>The API marketplace for AI agents</p>
        <h1 className="mt-4 text-[clamp(3rem,9vw,6.5rem)] font-bold leading-[0.92] tracking-[-0.05em]">
          Agents <span className="home-mark">that hire.</span>
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-relaxed text-coal/75 md:text-xl">
          Rialto lets Claude Code and Codex find, compare and pay for specialist APIs on their own. Per call, within a budget you set. No sign-ups, no API keys.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href={flowHref("/connect")} className="home-btn home-btn-ink">Connect my agent</Link>
          <Link href={flowHref("/publish")} className="home-btn home-btn-line">Publish an API</Link>
        </div>
        <p className="mt-5 font-mono text-[11px] uppercase tracking-[0.12em] text-coal/50">Hackathon build · payments are simulated</p>
      </div>
      <HeroCritter className="order-first h-56 w-full md:order-none md:h-[26rem]" />
    </section>
  );
}

export function Pitch() {
  return (
    <section id="pitch" aria-label="Pitch video" className={`${WRAP} scroll-mt-6 pb-16 md:pb-28`}>
      <PitchVideo />
    </section>
  );
}

export function HowItWorks() {
  return (
    <section id="how" aria-labelledby="how-title" className="scroll-mt-6 border-y-2 border-coal/10 bg-sand/50">
      <h2 id="how-title" className="sr-only">How it works: find, compare, pay, done</h2>
      {/* the scroll-driven scene; people who prefer reduced motion get the plain cards instead */}
      <div className="motion-reduce:hidden">
        <HowScroll />
      </div>
      <div className={`${WRAP} hidden py-16 motion-reduce:block md:py-28`}>
        <p className={KICKER}>How it works</p>
        <ol className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, i) => (
            <li key={step.title} className="flex flex-col border-2 border-coal bg-cream">
              <Image src={asset(`/img/steps/${step.img}.jpg`)} alt="" width={960} height={540} unoptimized loading="lazy" className="aspect-video w-full border-b-2 border-coal object-cover" />
              <div className="p-5">
                <p className="font-mono text-xs font-bold text-coal/50">0{i + 1}</p>
                <h3 className="mt-1 text-2xl font-bold tracking-tight">{step.title}</h3>
                <p className="mt-2 leading-relaxed text-coal/75">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function Proof() {
  const tags = [
    { side: "Built in-house, as code", model: SOLO.model, price: fmtUsd(SOLO.costUsd), detail: `${fmtK(SOLO.triangles)} triangles, untextured`, hired: false },
    { side: "Hired from a specialist API", model: HIRED.model, price: fmtUsd(HIRED.costUsd), detail: "Textured, game-ready", hired: true },
  ];
  return (
    <section id="proof" aria-labelledby="proof-title" className={`${WRAP} scroll-mt-6 py-16 md:py-28`}>
      <p className={KICKER}>Why hire</p>
      <h2 id="proof-title" className={H2}>Same prompt. A generalist against a specialist.</h2>
      <p className="mt-4 max-w-2xl text-lg leading-relaxed text-coal/75">Both robots came from the prompt &ldquo;a robot&rdquo;. Your model is great at reasoning; some jobs are simply done better by an API built for them.</p>
      <div className="mt-10 border-2 border-coal shadow-[6px_6px_0_var(--color-coal)] md:shadow-[10px_10px_0_var(--color-coal)]">
        <div className="relative h-[42vh] min-h-[280px] bg-[radial-gradient(ellipse_at_center,#2a2620_0%,#17120f_75%)] md:h-[56vh]">
          <DuoCanvas modelUrl={HIRED.url} className="absolute inset-0 size-full" />
          <p className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 font-mono text-[10px] uppercase tracking-[0.14em] text-white/50">Drag to spin</p>
        </div>
        <div className="grid grid-cols-2">
          {tags.map((t) => (
            <div key={t.model} className={`border-t-2 border-coal p-4 md:p-6 ${t.hired ? "border-l-2 bg-lime" : "bg-cream"}`}>
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-coal/60 md:text-xs">{t.side}</p>
              <p className="mt-1 text-base font-bold md:text-2xl">{t.model}</p>
              <p className="tnum mt-1 font-mono text-2xl font-bold md:text-4xl">{t.price}</p>
              <p className="mt-1 text-xs text-coal/70 md:text-sm">{t.detail}</p>
            </div>
          ))}
        </div>
      </div>
      <p className="mt-5 max-w-3xl text-xs leading-relaxed text-coal/55">
        Real outputs, not routed through Rialto. Right: Meshy-7 from the 3D Arena benchmark, simplified for the web; {HIRED.credits} API credits ≈ {fmtUsd(HIRED.costUsd)}. Left: three.js code written by {SOLO.model} in one pass; cost is output tokens only.
      </p>
    </section>
  );
}

const SOLANA_FACTS = [
  { value: "≈ 400 ms", label: "Solana block time. A payment confirms in about a second and is final in about thirteen." },
  { value: "< 1¢", label: "Network fee per payment: typically a fraction of a cent, whatever the amount." },
  { value: "100×", label: "A card's 30¢ minimum fee is a hundred times the price of a $0.003 API call." },
] as const;

export function Solana() {
  return (
    <section id="solana" aria-labelledby="solana-title" className="scroll-mt-6 bg-coal py-16 text-cream md:py-28">
      <div className={WRAP}>
        <p className="font-mono text-xs font-bold uppercase tracking-[0.18em] text-cream/55">Why Solana</p>
        <h2 id="solana-title" className={H2}>
          Paid before the others <span className="home-sol">leave the start line.</span>
        </h2>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-cream/75">An API call that costs a third of a cent only works on a payment rail that is faster and cheaper than the call itself.</p>
        <div className="mt-10">
          <SolanaRace />
        </div>
        <dl className="mt-10 grid gap-8 md:mt-14 md:grid-cols-3">
          {SOLANA_FACTS.map((fact) => (
            <div key={fact.value} className="border-l-2 border-cream/25 pl-5">
              <dt className="tnum home-sol inline-block font-mono text-4xl font-bold md:text-5xl">{fact.value}</dt>
              <dd className="mt-2 leading-relaxed text-cream/70">{fact.label}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-8 max-w-3xl text-xs leading-relaxed text-cream/45">
          Typical published figures for when the seller actually has the money (card payouts, ACH, SWIFT); they vary by provider and country. Rialto is designed for x402 payments in USDC on Solana; in this build payments are simulated.
        </p>
      </div>
    </section>
  );
}

export function Sides() {
  return (
    <section id="start" aria-labelledby="start-title" className="scroll-mt-6 border-t-2 border-coal/10 bg-sand/50 py-16 md:py-28">
      <div className={WRAP}>
        <p className={KICKER}>Get started</p>
        <h2 id="start-title" className={H2}>Two sides, one market.</h2>
        <div className="mt-10 grid gap-6 md:mt-14 md:grid-cols-2">
          {SIDES.map((s) => (
            <div key={s.tag} className={`flex flex-col border-2 border-coal p-6 md:p-9 ${s.primary ? "bg-coal text-cream" : "bg-cream"}`}>
              <p className={`font-mono text-xs font-bold uppercase tracking-[0.18em] ${s.primary ? "text-lime" : "text-coal/55"}`}>{s.tag}</p>
              <h3 className="mt-3 text-3xl font-bold leading-tight tracking-[-0.03em] md:text-4xl">{s.title}</h3>
              <p className="mt-3 text-lg leading-relaxed opacity-75">{s.body}</p>
              <ol className="mt-6 space-y-2">
                {s.steps.map((step, i) => (
                  <li key={step} className="flex items-center gap-3 text-lg font-medium">
                    <span className={`grid size-7 shrink-0 place-items-center font-mono text-xs font-bold ${s.primary ? "bg-lime text-coal" : "bg-coal text-cream"}`}>{i + 1}</span>
                    {step}
                  </li>
                ))}
              </ol>
              <Link href={flowHref(s.href)} className={`home-btn mt-8 self-start ${s.primary ? "home-btn-lime" : "home-btn-ink"}`}>{s.cta} →</Link>
            </div>
          ))}
        </div>
        <p className="mt-8 max-w-3xl leading-relaxed text-coal/65">
          Buyers pay the seller&apos;s price plus a small platform fee, shown upfront. Sellers receive exactly the price they set.
        </p>
      </div>
    </section>
  );
}

export function Closing() {
  return (
    <section aria-labelledby="closing-title" className="bg-coal text-cream">
      <div className={`${WRAP} py-20 md:py-32`}>
        <Buddy mood="wave" className="w-20 md:w-28" />
        <h2 id="closing-title" className="mt-6 max-w-4xl text-[clamp(2.4rem,7vw,5.5rem)] font-bold leading-[0.98] tracking-[-0.045em]">
          Give it a goal. <span className="text-lime">It hires the rest.</span>
        </h2>
        <div className="mt-9 flex flex-wrap gap-3">
          <Link href={flowHref("/connect")} className="home-btn home-btn-lime">Connect my agent</Link>
          <Link href={flowHref("/publish")} className="home-btn home-btn-line !border-cream !text-cream">Publish an API</Link>
        </div>
      </div>
      <footer className="border-t border-cream/15">
        <div className={`${WRAP} flex flex-wrap items-center justify-between gap-3 py-6 text-sm text-cream/60`}>
          <p>Built for Solana · x402-style pay-per-call in USDC. Payments are simulated in this build; demo providers are fictional.</p>
          <a href={REPO_URL} className="font-medium text-cream hover:text-lime">GitHub ↗</a>
        </div>
      </footer>
    </section>
  );
}
