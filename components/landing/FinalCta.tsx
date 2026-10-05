import Link from "next/link";

export function FinalCta() {
  return (
    <section aria-labelledby="cta-title" className="bg-signal text-ink">
      <div className="mx-auto max-w-[1440px] px-4 py-20 md:px-8 md:py-28">
        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.12em]">08 / START</p>
        <h2 id="cta-title" className="mt-4 text-[clamp(2.4rem,7vw,7rem)] font-bold uppercase leading-[0.9] tracking-[-0.045em]">
          Give your agent a goal.<br />Let it buy the way there.
        </h2>
        <Link href="/app" className="mt-10 inline-flex min-h-14 items-center border-2 border-ink bg-ink px-8 font-mono text-sm font-bold uppercase tracking-[0.1em] text-signal shadow-[6px_6px_0_var(--color-paper)] transition-[transform,box-shadow] duration-75 active:translate-x-0.5 active:translate-y-0.5 active:shadow-[3px_3px_0_var(--color-paper)]">
          Open the console
        </Link>
      </div>
      <footer className="border-t border-ink/30">
        <p className="mx-auto max-w-[1440px] px-4 py-5 font-mono text-[11px] uppercase tracking-[0.08em] md:px-8">
          Demo build. Providers are fictional. Payments are simulated unless the LIVE badge is shown.
        </p>
      </footer>
    </section>
  );
}
