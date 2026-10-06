import Link from "next/link";
import { ModeBadge } from "@/components/primitives";

/** Light shell for the onboarding pages (/connect, /publish). */
export function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-4 md:px-10">
        <Link href="/" className="text-xl font-bold uppercase tracking-tight">Switch<span className="text-signal">yard</span></Link>
        <nav aria-label="Primary" className="flex items-center gap-4 font-mono text-[11px] font-bold uppercase tracking-[0.12em]">
          <Link href="/connect" className="py-2 text-muted hover:text-paper">Connect</Link>
          <Link href="/publish" className="py-2 text-muted hover:text-paper">Publish</Link>
          <Link href="/app/marketplace" className="hidden py-2 text-muted hover:text-paper sm:block">Exchange</Link>
          <ModeBadge mode="simulated" />
        </nav>
      </header>
      <main className="mx-auto w-full max-w-[1100px] flex-1 px-4 py-10 md:px-10 md:py-16">{children}</main>
      <footer className="border-t border-line px-4 py-5 font-mono text-[10px] uppercase tracking-[0.08em] text-muted md:px-10">
        Demo build · payments are simulated unless the LIVE badge is shown · built for Solana ◎
      </footer>
    </div>
  );
}

export function Step({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-4 border-t border-line py-8 md:grid-cols-[120px_1fr]" aria-labelledby={`step-${n}`}>
      <p className="font-mono text-5xl font-bold leading-none text-signal md:text-6xl">{n}</p>
      <div className="min-w-0 space-y-4">
        <h2 id={`step-${n}`} className="text-2xl font-bold uppercase leading-none tracking-tight md:text-4xl">{title}</h2>
        {children}
      </div>
    </section>
  );
}
