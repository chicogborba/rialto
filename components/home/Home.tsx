import Image from "next/image";
import Link from "next/link";
import { Buddy } from "@/components/landing/Buddy";
import { asset, flowHref, REPO_URL } from "@/lib/site";
import { HeroMarket, Needs } from "./HeroMarket";
import { PitchVideo } from "./PitchVideo";
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
        <Link href="/#video" className="hidden text-coal/70 hover:text-coal md:block">Video</Link>
        <Link href="/#solana" className="hidden text-coal/70 hover:text-coal md:block">Why Solana</Link>
        <a href={REPO_URL} className="hidden text-coal/70 hover:text-coal sm:block">GitHub</a>
        <Link href={flowHref("/connect")} className="home-btn home-btn-ink !min-h-10 !px-4 text-sm">Connect</Link>
      </nav>
    </header>
  );
}

/** The promise on the left, the critter on the right. Nothing else. */
export function Hero() {
  return (
    <section className={`${WRAP} grid items-center gap-6 py-10 md:min-h-[min(78svh,720px)] md:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] md:py-0`}>
      <div>
        <h1 className="text-[clamp(2.4rem,6vw,4.5rem)] font-bold leading-[0.98] tracking-[-0.05em]">
          Agents that hire
          <br />
          an API for
          <br />
          <Needs />
        </h1>
        <p className="mt-6 max-w-md text-lg leading-snug text-coal/70">They find it, compare it and pay per call. On their own.</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href={flowHref("/connect")} className="home-btn home-btn-ink">Connect my agent</Link>
          <Link href={flowHref("/publish")} className="home-btn home-btn-line">Publish an API</Link>
        </div>
      </div>
      <HeroMarket className="h-[42svh] min-h-[300px] w-full md:h-[min(64svh,560px)]" />
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

const WINS = [
  { word: "Cheaper", bg: "bg-lime", tilt: "-rotate-2" },
  { word: "Faster", bg: "bg-[#5ce1e6]", tilt: "rotate-1" },
  { word: "Better", bg: "bg-[#ffd23f]", tilt: "-rotate-1" },
] as const;

/** What you end up with, in the video's three words. */
export function Wins() {
  return (
    <section aria-label="What you get" className={`${WRAP} py-16 text-center md:py-24`}>
      <ul className="flex flex-wrap items-center justify-center gap-4 md:gap-7">
        {WINS.map((w) => (
          <li key={w.word} className={`${w.bg} ${w.tilt} border-[3px] border-coal px-5 pb-1 text-[clamp(2.4rem,7.5vw,6rem)] font-bold leading-[1.1] tracking-[-0.05em] shadow-[6px_6px_0_var(--color-coal)] md:border-4 md:px-9 md:shadow-[10px_10px_0_var(--color-coal)]`}>
            {w.word}
          </li>
        ))}
      </ul>
      <p className="mt-9 text-xl font-bold text-coal/75 md:text-3xl">One key. One wallet. Your spending limit.</p>
    </section>
  );
}

export function Pitch() {
  return (
    <section id="video" aria-labelledby="video-title" className={`${WRAP} scroll-mt-6 py-16 md:py-24`}>
      <h2 id="video-title" className={`${H2} mb-8 text-center`}>Or watch it. 66 seconds.</h2>
      <PitchVideo />
    </section>
  );
}

const SOLANA_FACTS = [
  { value: "≈ 400 ms", label: "block time" },
  { value: "< 1¢", label: "fee per payment" },
  { value: "100×", label: "a card's 30¢ fee next to a $0.003 call" },
] as const;

export function Solana() {
  return (
    <section id="solana" aria-labelledby="solana-title" className="scroll-mt-6 border-y-2 border-coal/10 bg-sand/50 py-16 md:py-24">
      <div className={WRAP}>
        <h2 id="solana-title" className="text-[clamp(2.8rem,8vw,6rem)] font-bold leading-[0.92] tracking-[-0.05em]">
          Why <span className="home-sol">Solana?</span>
        </h2>
        <p className="mt-3 max-w-3xl text-xl font-bold leading-snug text-coal/80 md:text-3xl">It is paid before the others leave the start line.</p>
      </div>
      <div className="mt-8 md:mt-10">
        <SolanaRace />
      </div>
      <div className={WRAP}>
        <dl className="mt-10 grid grid-cols-3 gap-4 md:mt-12 md:gap-8">
          {SOLANA_FACTS.map((fact) => (
            <div key={fact.value}>
              <dt className="tnum home-sol inline-block whitespace-nowrap font-mono text-xl font-bold md:text-5xl">{fact.value}</dt>
              <dd className="mt-1 text-xs leading-snug text-coal/65 md:text-base">{fact.label}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-8 text-xs text-coal/45">Real time: a card payout takes about 2 days, a bank transfer 1 to 3, a wire up to 5. Built for x402 on Solana; payments are simulated in this build.</p>
      </div>
    </section>
  );
}

const SIDES = [
  { title: "I use Claude Code or Codex", steps: ["Get a key", "Paste one command", "Just ask"], cta: "Connect my agent", href: "/connect", primary: true },
  { title: "I have an API", steps: ["Paste your endpoint", "Set a price", "Get paid per call"], cta: "Publish my API", href: "/publish", primary: false },
] as const;

export function Start() {
  return (
    <section id="start" aria-labelledby="start-title" className={`${WRAP} scroll-mt-6 py-16 md:py-24`}>
      <h2 id="start-title" className={H2}>Pick your side.</h2>
      <div className="mt-8 grid gap-6 md:mt-10 md:grid-cols-2">
        {SIDES.map((s) => (
          <div key={s.title} className={`flex flex-col border-2 border-coal p-6 md:p-9 ${s.primary ? "bg-coal text-cream shadow-[8px_8px_0_var(--color-lime)]" : "bg-cream shadow-[8px_8px_0_var(--color-coal)]"}`}>
            <h3 className="text-2xl font-bold leading-tight tracking-[-0.03em] md:text-4xl">{s.title}</h3>
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
      <p className="mt-8 text-lg">
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
          <Buddy mood="wave" className="w-7" /> Rialto · hackathon build, payments simulated
        </p>
        <a href={REPO_URL} className="font-medium text-coal hover:underline">GitHub ↗</a>
      </div>
    </footer>
  );
}
