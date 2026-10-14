import Link from "next/link";
import { ModeBadge } from "@/components/primitives";

/** Shell for the pages outside the dashboard: sign up, sign in. */
export function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-4 md:px-10">
        <Link href="/" className="text-xl font-bold uppercase tracking-tight">Rial<span className="text-signal">to</span></Link>
        <nav aria-label="Primary" className="flex items-center gap-4 font-mono text-[11px] font-bold uppercase tracking-[0.12em]">
          <Link href="/catalog" className="py-2 text-muted hover:text-paper">Catalog</Link>
          <Link href="/login" className="py-2 text-muted hover:text-paper">Sign in</Link>
          <Link href="/signup" className="py-2 text-muted hover:text-paper">Create account</Link>
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
