import Image from "next/image";
import Link from "next/link";
import { Buddy } from "@/components/landing/Buddy";
import { fmtK, fmtUsd, HIRED, SOLO } from "@/components/landing/compare-data";
import { DuoCanvas } from "@/components/landing/DuoCanvas";
import { asset, flowHref, REPO_URL } from "@/lib/site";
import { HeroCritter } from "./HeroCritter";
import { HeroDemo } from "./HeroDemo";
import { HowScroll } from "./HowScroll";
import { PitchVideo } from "./PitchVideo";
import { SolanaRace } from "./SolanaRace";
import { STEPS } from "./steps";

const WRAP = "mx-auto w-full max-w-6xl px-5 md:px-8";
const H2 = "mt-3 max-w-4xl text-[clamp(2rem,5.2vw,3.75rem)] font-bold leading-[1.02] tracking-[-0.035em]";

/** Chapter label: the page reads top to bottom as one argument, so every section is numbered. */
function Kicker({ n, children, dark }: { n: string; children: React.ReactNode; dark?: boolean }) {
  return (
    <p className={`font-mono text-xs font-bold uppercase tracking-[0.18em] ${dark ? "text-cream/55" : "text-coal/55"}`}>
      <span className={`mr-2 ${dark ? "text-cream" : "text-coal"}`}>{n}</span>
      {children}
    </p>
  );
}

export function Header() {
  return (
    <header className={`${WRAP} flex items-center justify-between py-5`}>
      <Link href="/" className="flex items-center gap-2 text-xl font-bold tracking-tight">
        <Buddy className="w-8" />
        Rialto
      </Link>
      <nav aria-label="Primary" className="flex items-center gap-6 text-sm font-medium">
        <a href="#problem" className="hidden text-coal/70 hover:text-coal lg:block">Why</a>
        <a href="#how" className="hidden text-coal/70 hover:text-coal md:block">How it works</a>
        <a href="#features" className="hidden text-coal/70 hover:text-coal md:block">Features</a>
        <a href="#solana" className="hidden text-coal/70 hover:text-coal md:block">Solana</a>
        <a href={REPO_URL} className="hidden text-coal/70 hover:text-coal sm:block">GitHub</a>
        <Link href={flowHref("/connect")} className="home-btn home-btn-ink !min-h-10 !px-4 text-sm">Connect</Link>
      </nav>
    </header>
  );
}

export function Hero() {
  return (
    <section className={`${WRAP} grid items-center gap-8 pb-14 pt-6 md:grid-cols-[1.05fr_0.95fr] md:gap-12 md:pb-24 md:pt-10`}>
      <div>
        <p className="font-mono text-xs font-bold uppercase tracking-[0.18em] text-coal/55">The API marketplace for AI agents</p>
        <h1 className="mt-4 text-[clamp(3rem,9vw,6.5rem)] font-bold leading-[0.92] tracking-[-0.05em]">
          Agents <span className="home-mark">that hire.</span>
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-relaxed text-coal/75 md:text-xl">
          When your agent hits a job a specialist does better, Rialto lets it find one, compare the options and pay per call. On its own, inside a budget you set. No sign-ups, no API keys.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href={flowHref("/connect")} className="home-btn home-btn-ink">Connect my agent</Link>
          <Link href={flowHref("/publish")} className="home-btn home-btn-line">Publish an API</Link>
        </div>
        <p className="mt-5 font-mono text-[11px] uppercase tracking-[0.12em] text-coal/50">Works with Claude Code and Codex · hackathon build, payments simulated</p>
      </div>
      {/* the critter stands on a real session: this is what using it looks like */}
      <div>
        <HeroCritter className="relative z-10 mx-auto -mb-9 block h-44 w-full max-w-sm md:-mb-14 md:h-64" />
        <HeroDemo />
      </div>
    </section>
  );
}

export function Pitch() {
  return (
    <section id="pitch" aria-label="Pitch video" className={`${WRAP} scroll-mt-6 pb-16 md:pb-28`}>
      <p className="mb-4 text-center font-mono text-xs font-bold uppercase tracking-[0.18em] text-coal/55">The whole idea in 66 seconds</p>
      <PitchVideo />
    </section>
  );
}

const PROBLEMS = [
  { img: "scratch", title: "Build it from scratch", body: "Sprites, 3D models, voice, live data: it writes everything by hand. Slow, expensive, and rarely as good as a tool made for the job." },
  { img: "blocked", title: "Or stop and ask you", body: "The good APIs exist, but each one wants a sign-up, a credit card and one more secret key in your .env." },
] as const;

export function Problem() {
  return (
    <section id="problem" aria-labelledby="problem-title" className="scroll-mt-6 border-t-2 border-coal/10 bg-sand/50 py-16 md:py-28">
      <div className={WRAP}>
        <Kicker n="01">The problem</Kicker>
        <h2 id="problem-title" className={H2}>Today your agent has two bad options.</h2>
        <div className="mt-10 grid gap-6 md:mt-14 md:grid-cols-2">
          {PROBLEMS.map((p, i) => (
            <div key={p.img} className="border-2 border-coal bg-cream">
              <Image src={asset(`/img/story/${p.img}.jpg`)} alt="" width={960} height={421} unoptimized loading="lazy" className="w-full border-b-2 border-coal" />
              <div className="p-5 md:p-7">
                <p className="font-mono text-xs font-bold uppercase tracking-[0.14em] text-[#d43c3c]">Option {i + 1}</p>
                <h3 className="mt-1 text-2xl font-bold tracking-tight md:text-3xl">{p.title}</h3>
                <p className="mt-2 leading-relaxed text-coal/75 md:text-lg">{p.body}</p>
              </div>
            </div>
          ))}
          <div className="grid border-2 border-coal bg-lime shadow-[6px_6px_0_var(--color-coal)] md:col-span-2 md:grid-cols-2 md:shadow-[10px_10px_0_var(--color-coal)]">
            <Image src={asset("/img/story/rialto.jpg")} alt="" width={960} height={421} unoptimized loading="lazy" className="h-full w-full border-b-2 border-coal object-cover md:border-b-0 md:border-r-2" />
            <div className="flex flex-col justify-center p-5 md:p-9">
              <p className="font-mono text-xs font-bold uppercase tracking-[0.14em] text-coal/60">With Rialto</p>
              <h3 className="mt-1 text-3xl font-bold leading-tight tracking-[-0.03em] md:text-4xl">It just hires.</h3>
              <p className="mt-3 leading-relaxed text-coal/80 md:text-lg">One catalog of specialist APIs and one wallet. Your agent picks the best service for the job and pays for that single call.</p>
              <ul className="mt-5 flex flex-wrap gap-2 font-mono text-xs font-bold uppercase tracking-[0.06em]">
                {["One key", "One wallet", "Your spending limit"].map((item) => (
                  <li key={item} className="border-2 border-coal bg-cream px-3 py-1.5">✓ {item}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function HowItWorks() {
  return (
    <section id="how" aria-labelledby="how-title" className="scroll-mt-6 border-y-2 border-coal/10">
      <h2 id="how-title" className="sr-only">How it works: find, compare, pay, done</h2>
      {/* the scroll-driven scene; people who prefer reduced motion get the plain cards instead */}
      <div className="motion-reduce:hidden">
        <HowScroll />
      </div>
      <div className={`${WRAP} hidden py-16 motion-reduce:block md:py-28`}>
        <Kicker n="02">How it works</Kicker>
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

const Bar = ({ label, value, width }: { label: string; value: string; width: number }) => (
  <div className="flex items-center gap-2">
    <span className="w-14 shrink-0">{label}</span>
    <div className="h-2.5 flex-1 border-2 border-coal bg-cream">
      <div className="h-full bg-coal" style={{ width: `${width}%` }} />
    </div>
    <span className="w-6 shrink-0 text-right">{value}</span>
  </div>
);
const Pair = ({ k, v, dim }: { k: string; v: string; dim?: boolean }) => (
  <p className={`flex justify-between gap-3 ${dim ? "text-coal/50" : ""}`}>
    <span>{k}</span>
    <span>{v}</span>
  </p>
);

/** Each feature is drawn as the thing itself: a command, a policy, a score, a receipt. */
const FEATURES: { title: string; body: string; visual: React.ReactNode }[] = [
  {
    title: "One command to connect",
    body: "Claude Code, Codex or any MCP client. Your agent gets the whole marketplace as tools.",
    visual: (
      <pre className="w-full whitespace-pre-wrap break-all bg-coal p-3 text-[11px] leading-relaxed text-cream">
        <span className="text-lime">$</span> claude mcp add --transport http rialto https://your-rialto/api/mcp --header &quot;Authorization: Bearer rl_buyer_…&quot;
      </pre>
    ),
  },
  {
    title: "A wallet with rules",
    body: "Each agent has its own balance and a spending policy. A call that would break it is refused before any money moves.",
    visual: (
      <div className="w-full space-y-2">
        <Pair k="Session budget" v="$0.42 / $1.00" />
        <div className="h-2.5 border-2 border-coal bg-cream">
          <div className="h-full w-[42%] bg-lime" />
        </div>
        <div className="space-y-1 border-t-2 border-coal/15 pt-2">
          <Pair k="Max per call" v="$0.05" />
          <Pair k="Minimum quality" v="80 / 100" />
        </div>
      </div>
    ),
  },
  {
    title: "It picks the best one",
    body: "Candidates are scored on quality, price, speed and reputation, and the choice comes with its reasons.",
    visual: (
      <div className="w-full space-y-1.5">
        <Bar label="Quality" value="92" width={92} />
        <Bar label="Price" value="88" width={88} />
        <Bar label="Speed" value="95" width={95} />
        <Bar label="Trust" value="97" width={97} />
      </div>
    ),
  },
  {
    title: "Pay per call",
    body: "No subscriptions and no minimums. The price is charged only when the call succeeds.",
    visual: (
      <div className="w-full">
        <p className="tnum text-4xl leading-none">$0.003</p>
        <div className="mt-3 space-y-1 border-t-2 border-coal/15 pt-2">
          <Pair k="200 OK" v="charged" />
          <Pair k="error or timeout" v="$0.000" dim />
        </div>
      </div>
    ),
  },
  {
    title: "Automatic fallback",
    body: "If a provider fails, the agent moves to the next best one. You only pay for the call that worked.",
    visual: (
      <div className="flex w-full items-center gap-2 text-[11px]">
        <span className="flex-1 border-2 border-coal/40 bg-cream px-2 py-2 text-coal/50 line-through">PixelForge · timeout</span>
        <span aria-hidden>→</span>
        <span className="flex-1 border-2 border-coal bg-lime px-2 py-2">SpriteForge · 200</span>
      </div>
    ),
  },
  {
    title: "Every cent on a ledger",
    body: "An append-only record of who paid what to whom. The seller gets exactly the price they set.",
    visual: (
      <div className="w-full space-y-1">
        <Pair k="agent wallet" v="−$0.003" />
        <Pair k="seller" v="+$0.002" />
        <Pair k="platform fee" v="+$0.001" />
      </div>
    ),
  },
];

export function Features() {
  return (
    <section id="features" aria-labelledby="features-title" className={`${WRAP} scroll-mt-6 py-16 md:py-28`}>
      <Kicker n="03">What you get</Kicker>
      <h2 id="features-title" className={H2}>Everything an agent needs to spend money safely.</h2>
      <ul className="mt-10 grid gap-6 sm:grid-cols-2 md:mt-14 lg:grid-cols-3">
        {FEATURES.map((f) => (
          <li key={f.title} className="flex flex-col border-2 border-coal bg-cream">
            <div className="flex h-40 items-center border-b-2 border-coal bg-sand/60 p-4 font-mono text-xs font-bold">{f.visual}</div>
            <div className="p-5">
              <h3 className="text-xl font-bold tracking-tight">{f.title}</h3>
              <p className="mt-2 leading-relaxed text-coal/75">{f.body}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function Proof() {
  const tags = [
    { side: "Built in-house, as code", model: SOLO.model, price: fmtUsd(SOLO.costUsd), detail: `${fmtK(SOLO.triangles)} triangles, untextured`, hired: false },
    { side: "Hired from a specialist API", model: HIRED.model, price: fmtUsd(HIRED.costUsd), detail: "Textured, game-ready", hired: true },
  ];
  return (
    <section id="proof" aria-labelledby="proof-title" className="scroll-mt-6 border-t-2 border-coal/10 bg-sand/50 py-16 md:py-28">
      <div className={WRAP}>
        <Kicker n="04">Why hire</Kicker>
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
      </div>
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
        <Kicker n="05" dark>Why Solana</Kicker>
        <h2 id="solana-title" className={H2}>
          Paid before the others <span className="home-sol">leave the start line.</span>
        </h2>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-cream/75">An API call that costs a third of a cent only works on a payment rail that is faster and cheaper than the call itself. Watch them run, in real time.</p>
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
          Typical published figures for when the seller actually has the money (card payouts in about 2 days, ACH in 1 to 3, SWIFT in up to 5); they vary by provider and country. Rialto is designed for x402 payments in USDC on Solana; in this build payments are simulated.
        </p>
      </div>
    </section>
  );
}

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

export function Sides() {
  return (
    <section id="start" aria-labelledby="start-title" className={`${WRAP} scroll-mt-6 py-16 md:py-28`}>
      <Kicker n="06">Get started</Kicker>
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
    </section>
  );
}

const QUESTIONS = [
  {
    q: "Is this live on Solana?",
    a: "Not yet. This is a hackathon build: the marketplace, routing, wallets, ledger and MCP server are real and tested, but settlement is simulated. Live x402 payments in USDC on Solana devnet are the next milestone.",
  },
  { q: "Which agents work with it?", a: "Claude Code and Codex today, through MCP. Any other MCP client can connect to the same endpoint." },
  { q: "What does it cost?", a: "Sellers set a price per call. Buyers pay that price plus a small platform fee (5%, minimum $0.001), shown upfront. Failed calls are never charged." },
  { q: "Can my agent overspend?", a: "No. Every agent has its own wallet and policy: a session budget, a maximum per call and a minimum quality. A call that would break the policy is refused before any money moves." },
  { q: "I have an API. How do I get listed?", a: "Paste an HTTPS endpoint, set a price and publish. Rialto runs the payment flow, calls your API and credits you exactly your price on every successful call." },
] as const;

export function Faq() {
  return (
    <section id="faq" aria-labelledby="faq-title" className="scroll-mt-6 border-t-2 border-coal/10 bg-sand/50 py-16 md:py-24">
      <div className={`${WRAP} grid gap-8 md:grid-cols-[0.8fr_1.2fr] md:gap-12`}>
        <div>
          <Kicker n="07">Straight answers</Kicker>
          <h2 id="faq-title" className={H2}>What is real, and what is next.</h2>
        </div>
        <div className="border-t-2 border-coal">
          {QUESTIONS.map((item) => (
            <details key={item.q} className="group border-b-2 border-coal">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-lg font-bold md:text-xl [&::-webkit-details-marker]:hidden">
                {item.q}
                <span aria-hidden className="font-mono text-2xl leading-none transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="max-w-2xl pb-5 leading-relaxed text-coal/75">{item.a}</p>
            </details>
          ))}
        </div>
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
