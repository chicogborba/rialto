import Link from "next/link";
import { hardButtonClass, ModeBadge } from "@/components/primitives";

export function LandingHeader() {
  return (
    <header className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3 px-4 py-4 md:px-8">
      <Link href="/" className="text-xl font-bold uppercase tracking-tight">Switch<span className="text-signal">yard</span></Link>
      <nav aria-label="Primary" className="flex flex-wrap items-center gap-4 font-mono text-[11px] font-bold uppercase tracking-[0.12em]">
        <Link href="/app" className="py-2 text-muted hover:text-paper">Console</Link>
        <Link href="/app/marketplace" className="py-2 text-muted hover:text-paper">Exchange</Link>
        <a href="#developers" className="py-2 text-muted hover:text-paper">Docs</a>
        <ModeBadge mode="simulated" />
        <a href="#demo" className={hardButtonClass("primary", "md")}>Run the agent</a>
      </nav>
    </header>
  );
}
