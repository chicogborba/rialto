import Image from "next/image";
import Link from "next/link";
import { Buddy } from "@/components/landing/Buddy";
import { asset, flowHref, REPO_URL } from "@/lib/site";
import { HeroMarket, Needs } from "./HeroMarket";
import { PitchVideo } from "./PitchVideo";
import { SolanaMark } from "./SolanaMark";
import { SolanaRace } from "./SolanaRace";
import { Caption, Story as StoryScroll } from "./Story";
import { BEATS } from "./story-beats";

const WRAP = "mx-auto w-full max-w-6xl px-5 md:px-8";
const H2 = "text-[clamp(2rem,5.6vw,4rem)] font-bold leading-[1.02] tracking-[-0.04em]";

export function Header() {
  return (
    <header className={`${WRAP} flex items-center justify-between py-5`}>
      <Link href="/" className="flex items-center gap-2 text-xl font-bold tracking-tight">
        <Buddy className="w-8" />
        Rialto
      </Link>
      <nav aria-label="Primary" className="flex items-center gap-6 text-sm font-medium">
        <Link href="/catalog" className="text-coal/70 hover:text-coal">Catalog</Link>
        <Link href="/#story" className="hidden text-coal/70 hover:text-coal md:block">How it works</Link>
        <Link href="/#solana" className="hidden text-coal/70 hover:text-coal md:block">Why Solana</Link>
        <a href={REPO_URL} className="hidden text-coal/70 hover:text-coal sm:block">GitHub</a>
        <Link href={flowHref("/login")} className="hidden text-coal/70 hover:text-coal sm:block">Sign in</Link>
        <Link href={flowHref("/signup")} className="home-btn home-btn-ink !min-h-10 !px-4 text-sm">Get started</Link>
      </nav>
    </header>
  );
}

/** The promise on the left; to the right the whole product in one loop: he walks to a stall, pays, takes his parcel, walks on. */
export function Hero() {
  return (
    <section className="relative isolate overflow-hidden lg:h-[min(88svh,800px)] lg:min-h-[620px]">
      <div className={`${WRAP} pointer-events-none relative z-10 flex flex-col justify-center pb-2 pt-6 lg:h-full lg:pb-16 lg:pt-0`}>
        <h1 className="text-[clamp(3.2rem,8.4vw,7rem)] font-bold leading-[0.9] tracking-[-0.055em]">
          Agents <span className="block whitespace-nowrap">that hire</span>
        </h1>
        <p className="mt-3 text-[clamp(1.5rem,3.6vw,2.9rem)] font-bold leading-tight tracking-[-0.03em]">
          an API for <Needs />
        </p>
        <p className="mt-4 max-w-sm text-lg leading-snug text-coal/75 md:mt-6 md:text-xl">Find, compare, pay per call. No sign-up, no card.</p>
        <div className="pointer-events-auto mt-5 flex flex-wrap gap-2 md:mt-7 md:gap-3">
          <Link href={flowHref("/signup?next=/dashboard/agents")} className="home-btn home-btn-ink max-sm:!px-4 max-sm:text-[15px]"><span aria-hidden>🤖</span> Connect an agent</Link>
          <Link href={flowHref("/signup?next=/dashboard/apis")} className="home-btn home-btn-line bg-cream/70 max-sm:!px-4 max-sm:text-[15px]"><span aria-hidden>🔌</span> Sell an API</Link>
        </div>
        <p className="mt-4 font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-coal/50 md:text-xs">Claude Code · Codex · any MCP agent</p>
      </div>
      <HeroMarket className="home-stage h-[46svh] min-h-[320px] w-full md:h-[56svh] lg:absolute lg:inset-0 lg:h-full" />
      <a href="#video" className="home-bob absolute inset-x-0 bottom-3 z-10 mx-auto hidden w-fit font-mono text-xs font-bold uppercase tracking-[0.16em] text-coal/55 hover:text-coal lg:block">↓ See it in 66 seconds</a>
    </section>
  );
}

/** The scroll-driven scene; people who prefer reduced motion get three stills with the same lines. */
export function Story() {
  return (
    <section id="story" aria-label="How Rialto works, as a story" className="border-b-2 border-coal/10">
      <div className="motion-reduce:hidden">
        <StoryScroll />
      </div>
      <ol className={`${WRAP} hidden gap-6 py-16 motion-reduce:grid md:grid-cols-3`}>
        {(["scratch", "blocked", "rialto"] as const).map((img, i) => (
          <li key={img} className="border-2 border-coal bg-cream">
            <Image src={asset(`/img/story/${img}.jpg`)} alt="" width={960} height={421} unoptimized loading="lazy" className="w-full border-b-2 border-coal" />
            <div className="p-4 [&_p]:text-xl [&_p]:shadow-none">
              <Caption text={BEATS[i].text} bad={BEATS[i].bad} />
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function Pitch() {
  return (
    <section id="video" aria-labelledby="video-title" className={`${WRAP} scroll-mt-6 pb-16 pt-10 md:pb-24 md:pt-14`}>
      <h2 id="video-title" className={`${H2} mb-8 text-center`}>The whole idea in 66 seconds <span aria-hidden>🍿</span></h2>
      <PitchVideo />
    </section>
  );
}

const SOLANA_FACTS = [
  { value: "≈ 400 ms", label: "to settle" },
  { value: "< 1¢", label: "fee per payment" },
  { value: "100×", label: "what a card fee costs next to a $0.003 call" },
] as const;

export function Solana() {
  return (
    <section id="solana" aria-labelledby="solana-title" className="scroll-mt-6 border-y-2 border-coal/10 bg-sand/50 py-16 md:py-24">
      <div className={WRAP}>
        <h2 id="solana-title" className="flex flex-wrap items-baseline gap-x-[0.28em] text-[clamp(2.8rem,8vw,6rem)] font-bold leading-[0.92] tracking-[-0.05em]">
          Why <SolanaMark className="h-[0.62em] w-auto self-center" /> Solana?
        </h2>
        <p className="mt-3 max-w-3xl text-xl font-bold leading-snug text-coal/80 md:text-3xl">Paid before the others leave the start line.</p>
        <div className="mt-8 md:mt-10">
          <SolanaRace />
        </div>
        <dl className="mt-10 grid grid-cols-3 gap-4 md:mt-12 md:gap-8">
          {SOLANA_FACTS.map((fact) => (
            <div key={fact.value}>
              <dt className="tnum whitespace-nowrap font-mono text-xl font-bold md:text-5xl">{fact.value}</dt>
              <dd className="mt-2 text-xs leading-snug text-coal/65 md:text-base">{fact.label}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-8 text-xs text-coal/45">Card payouts take about 2 days, bank transfers 1 to 3, wires up to 5. This build pays with x402 on Solana devnet: test money.</p>
      </div>
    </section>
  );
}

const SIDES = [
  { emoji: "🤖", title: "You run an agent", note: "Claude Code, Codex, any MCP client", steps: ["Paste one command", "Set a spending limit", "Just ask"], cta: "Connect an agent", href: "/signup?next=/dashboard/agents", primary: true },
  { emoji: "🔌", title: "You built an API", note: "No billing code to write", steps: ["Paste your endpoint", "Set a price", "Get paid per call"], cta: "Sell an API", href: "/signup?next=/dashboard/apis", primary: false },
] as const;

/** Who it is for, said early: the people with agents and the people with APIs. */
export function Sides() {
  return (
    <section id="start" aria-labelledby="start-title" className={`${WRAP} scroll-mt-6 pb-16 md:pb-24`}>
      <h2 id="start-title" className={H2}>Two sides. One market.</h2>
      <div className="mt-8 grid gap-6 md:mt-10 md:grid-cols-2">
        {SIDES.map((s) => (
          <div key={s.title} className={`flex flex-col border-2 border-coal p-6 md:p-9 ${s.primary ? "bg-coal text-cream shadow-[8px_8px_0_var(--color-lime)]" : "bg-[#fffdf7] shadow-[8px_8px_0_var(--color-coal)]"}`}>
            <h3 className="flex items-center gap-3 text-2xl font-bold leading-tight tracking-[-0.03em] md:text-4xl">
              <span aria-hidden className={`grid size-11 shrink-0 place-items-center border-2 text-2xl md:size-14 md:text-3xl ${s.primary ? "border-cream/25 bg-cream/10" : "border-coal bg-lime"}`}>{s.emoji}</span>
              {s.title}
            </h3>
            <p className={`mt-3 font-mono text-[11px] font-bold uppercase tracking-[0.1em] md:text-xs ${s.primary ? "text-cream/55" : "text-coal/50"}`}>{s.note}</p>
            <ol className="mt-6 space-y-2">
              {s.steps.map((step, i) => (
                <li key={step} className="flex items-center gap-3 text-lg font-medium md:text-xl">
                  <span className={`grid size-7 shrink-0 place-items-center font-mono text-xs font-bold ${s.primary ? "bg-lime text-coal" : "bg-coal text-cream"}`}>{i + 1}</span>
                  {step}
                </li>
              ))}
            </ol>
            <Link href={flowHref(s.href)} className={`home-btn mt-8 self-start ${s.primary ? "home-btn-lime" : "home-btn-ink"}`}>{s.cta} →</Link>
          </div>
        ))}
      </div>
    </section>
  );
}

/** The way out of the page: the same two doors, and the catalog for people who only want a look. */
export function Start() {
  return (
    <section aria-labelledby="go-title" className={`${WRAP} py-16 text-center md:py-28`}>
      <Buddy mood="wave" className="mx-auto w-16 md:w-20" />
      <h2 id="go-title" className={`${H2} mt-5`}>The market is open <span aria-hidden>🛎️</span></h2>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href={flowHref("/signup?next=/dashboard/agents")} className="home-btn home-btn-ink"><span aria-hidden>🤖</span> Connect an agent</Link>
        <Link href={flowHref("/signup?next=/dashboard/apis")} className="home-btn home-btn-line"><span aria-hidden>🔌</span> Sell an API</Link>
      </div>
      <p className="mt-7 text-lg">
        Just looking?{" "}
        <Link href="/catalog" className="font-bold underline decoration-lime decoration-4 underline-offset-4 hover:decoration-coal">
          Browse the catalog →
        </Link>
      </p>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="border-t-2 border-coal/10">
      <div className={`${WRAP} flex flex-wrap items-center justify-between gap-3 py-6 text-sm text-coal/60`}>
        <p className="flex items-center gap-2">
          <Buddy mood="wave" className="w-7" /> Rialto · hackathon build · devnet test money, never real funds
        </p>
        <a href={REPO_URL} className="font-medium text-coal hover:underline">GitHub ↗</a>
      </div>
    </footer>
  );
}
