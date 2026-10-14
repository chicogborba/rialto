import type { Metadata } from "next";
import Link from "next/link";
import { DemoVideo } from "@/components/demo/DemoVideo";
import { GameFrame } from "@/components/demo/GameFrame";
import { Footer, Header } from "@/components/home/Home";
import { GAME_BUILDS, GAME_PROMPT, GAME_PROMPT_SUFFIX, GAME_PURCHASES } from "@/lib/demo/game-demo";
import { formatUsd } from "@/lib/money";
import { flowHref } from "@/lib/site";
import { explorerTx } from "@/lib/x402/solana";

export const metadata: Metadata = {
  title: "Demo · Rialto",
  description: "One request, made twice by the same agent: once alone and once with Rialto. Play both games and read the bill.",
};

const WRAP = "mx-auto w-full max-w-6xl px-5 md:px-8";
const total = GAME_PURCHASES.reduce((sum, p) => sum + p.micro, 0);

function Prompt({ rialto = false }: { rialto?: boolean }) {
  return (
    <p className="flex min-h-[4.25rem] items-center border-2 border-coal bg-coal px-3 py-2.5 font-mono text-[13px] font-bold leading-relaxed text-cream md:text-sm xl:min-h-0">
      <span>
      <span className={rialto ? "text-lime" : "text-cream/50"}>❯ </span>
      {GAME_PROMPT}
      {rialto ? <span className="bg-lime text-coal">{GAME_PROMPT_SUFFIX}</span> : null}
      </span>
    </p>
  );
}

function Facts({ build }: { build: (typeof GAME_BUILDS)[keyof typeof GAME_BUILDS] }) {
  const rows = [
    ["💸 Total cost", build.cost],
    ["🛒 Bought", build.bought],
    ["🎨 Made of", build.madeOf],
  ];
  return (
    <dl className="mt-5 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-base md:text-lg">
      {rows.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="font-mono text-[11px] font-bold uppercase leading-7 tracking-[0.1em] text-coal/55 md:text-xs">{label}</dt>
          <dd className="font-bold">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** The same request, twice: play what the agent built alone and what it built with a wallet on Rialto. */
export default function DemoPage() {
  return (
    <div className="home min-h-screen bg-cream text-coal">
      <Header />
      <main>
        <section className={`${WRAP} pb-10 pt-8 md:pb-14 md:pt-12`}>
          <h1 className="text-[clamp(2.6rem,7vw,5.6rem)] font-bold leading-[0.95] tracking-[-0.05em]">
            Same prompt. <span className="bg-lime px-2">Two more words.</span>
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-snug text-coal/75 md:text-xl">We asked Claude Code for a game, twice. The second time it could shop on Rialto. Both are below, exactly as it left them. <span aria-hidden>🎮</span></p>
        </section>

        <section aria-label="The two games" className={`${WRAP} grid gap-10 pb-16 md:grid-cols-2 md:gap-8 md:pb-24`}>
          <div>
            <Prompt />
            <div className="mt-5">
              <GameFrame {...GAME_BUILDS.plain} title="The game Claude built on its own" tone="plain" />
            </div>
            <Facts build={GAME_BUILDS.plain} />
          </div>
          <div>
            <Prompt rialto />
            <div className="mt-5">
              <GameFrame {...GAME_BUILDS.rialto} title="The game Claude built with Rialto" tone="rialto" />
            </div>
            <Facts build={GAME_BUILDS.rialto} />
          </div>
        </section>

        <section aria-labelledby="bill-title" className={`${WRAP} pb-16 md:pb-24`}>
          <div className="mx-auto max-w-3xl border-2 border-coal bg-[#fffdf7] p-5 shadow-[8px_8px_0_var(--color-coal)] md:p-8">
            <h2 id="bill-title" className="border-b-2 border-dashed border-coal pb-3 text-3xl font-bold tracking-[-0.03em] md:text-4xl">What Claude bought <span aria-hidden>🧾</span></h2>
            <ul className="mt-3 divide-y divide-coal/10">
              {GAME_PURCHASES.map((p) => (
                <li key={p.tx} className="flex items-baseline gap-3 py-2.5">
                  <span aria-hidden>{p.emoji}</span>
                  <span className="min-w-0 flex-1">
                    <span className="font-bold">{p.what}</span> <span className="text-coal/55">· {p.provider}</span>
                  </span>
                  <a href={explorerTx(p.tx)} target="_blank" rel="noreferrer" className="hidden font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-coal/55 underline decoration-coal/30 underline-offset-4 hover:text-coal sm:block">
                    on Solana ↗
                  </a>
                  <span className="tnum font-mono font-bold">{formatUsd(p.micro)}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 flex items-center justify-between border-t-2 border-dashed border-coal pt-4 text-2xl font-bold md:text-3xl">
              Total
              <span className="tnum border-2 border-coal bg-lime px-3 font-mono">{formatUsd(total)}</span>
            </p>
            <p className="mt-4 font-mono text-[11px] font-bold uppercase leading-relaxed tracking-[0.1em] text-coal/55 md:text-xs">{GAME_PURCHASES.length} calls · no sign-up, no API key, no card · each paid on its own in USDC on Solana devnet</p>
          </div>
        </section>

        <section aria-labelledby="film-title" className={`${WRAP} pb-16 md:pb-24`}>
          <h2 id="film-title" className="mb-8 text-center text-[clamp(2rem,5.6vw,4rem)] font-bold leading-[1.02] tracking-[-0.04em]">The whole run, on film <span aria-hidden>🎬</span></h2>
          <DemoVideo />
        </section>

        <section className={`${WRAP} pb-20 text-center md:pb-28`}>
          <div className="flex flex-wrap justify-center gap-3">
            <Link href={flowHref("/signup?next=/dashboard/agents")} className="home-btn home-btn-ink"><span aria-hidden>🤖</span> Connect your agent</Link>
            <Link href="/catalog" className="home-btn home-btn-line">Browse the catalog →</Link>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
