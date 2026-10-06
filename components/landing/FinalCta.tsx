import Link from "next/link";
import { Buddy } from "./Buddy";
import { ShaderBackdrop } from "./ShaderBackdrop";

const LIME: [number, number, number] = [0.776, 1.0, 0.239];
const INK: [number, number, number] = [0.043, 0.047, 0.039];

export function FinalCta() {
  return (
    <section aria-labelledby="cta-title" className="relative overflow-hidden bg-signal text-ink">
      <ShaderBackdrop a={LIME} b={INK} className="absolute inset-0 size-full opacity-35" />
      <div className="relative mx-auto max-w-[1440px] px-4 py-24 md:px-10 md:py-36">
        <h2 id="cta-title" className="text-[clamp(3rem,11vw,11rem)] font-bold uppercase leading-[0.84] tracking-[-0.06em]">
          Give it a goal.
          <br />
          It hires the rest. 🫡
        </h2>
        <div className="mt-10 flex flex-wrap items-center gap-5">
        <Link href="/publish" className="inline-flex min-h-16 items-center border-2 border-ink bg-paper px-8 font-mono text-base font-bold uppercase tracking-[0.1em] text-ink shadow-[8px_8px_0_var(--color-ink)] transition-[transform,box-shadow] duration-75 hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-1 active:translate-y-1 active:shadow-[3px_3px_0_var(--color-ink)]">
          Publish my API
        </Link>
        <Link href="/connect" className="inline-flex min-h-16 items-center border-2 border-ink bg-ink px-10 font-mono text-base font-bold uppercase tracking-[0.1em] text-signal shadow-[8px_8px_0_var(--color-paper)] transition-[transform,box-shadow] duration-75 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[11px_11px_0_var(--color-paper)] active:translate-x-1 active:translate-y-1 active:shadow-[3px_3px_0_var(--color-paper)]">
          Connect my Claude →
        </Link>
        </div>
        <Buddy mood="wave" className="absolute bottom-6 right-4 w-28 md:right-16 md:w-64" />
      </div>
      <footer className="relative border-t border-ink/30 bg-signal">
        <p className="mx-auto max-w-[1440px] px-4 py-5 font-mono text-[11px] font-bold uppercase tracking-[0.08em] md:px-10">
          Built for Solana ◎ · x402 · USDC. Demo build: providers are fictional, payments are simulated unless the LIVE badge is shown.
        </p>
      </footer>
    </section>
  );
}
