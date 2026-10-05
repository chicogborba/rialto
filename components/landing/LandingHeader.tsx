import Link from "next/link";
import { hardButtonClass, ModeBadge } from "@/components/primitives";

export function LandingHeader() {
  return (
    <header className="absolute inset-x-0 top-0 z-30 flex flex-wrap items-center justify-between gap-3 px-4 py-4 md:px-10">
      <Link href="/" className="text-xl font-bold uppercase tracking-tight">Switch<span className="text-signal">yard</span></Link>
      <nav aria-label="Primary" className="flex items-center gap-4 font-mono text-[11px] font-bold uppercase tracking-[0.12em]">
        <a href="#why" className="hidden py-2 text-muted hover:text-paper sm:block">Why</a>
        <a href="#compare" className="hidden py-2 text-muted hover:text-paper sm:block">Proof</a>
        <a href="#solana" className="sy-sol-text hidden py-2 sm:block">◎ Solana</a>
        <Link href="/app/marketplace" className="hidden py-2 text-muted hover:text-paper md:block">Exchange</Link>
        <ModeBadge mode="simulated" />
        <Link href="/app" className={hardButtonClass("primary", "md")}>Console</Link>
      </nav>
    </header>
  );
}
