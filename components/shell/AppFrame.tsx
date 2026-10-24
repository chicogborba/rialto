"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { asset } from "@/lib/site";
import { cn } from "@/lib/utils";

export interface FrameTab {
  href: string;
  label: string;
  emoji: string;
}

/**
 * The frame of every signed-in screen, in the landing's light style: the logo, who is signed in and
 * what they hold on the right, then the sections as tabs (the active one in lime, like the landing's
 * highlights). Scrolls sideways on a phone instead of wrapping.
 */
export function AppFrame({ tabs, root, badge, right, children, wide = false }: { tabs: FrameTab[]; root: string; badge?: React.ReactNode; right?: React.ReactNode; children: React.ReactNode; wide?: boolean }) {
  const path = usePathname();
  const width = wide ? "max-w-[1240px]" : "max-w-[1100px]";
  return (
    <div className="light flex min-h-screen flex-col">
      <header className="border-b-2 border-coal bg-cream/90 backdrop-blur supports-[backdrop-filter]:bg-cream/75 sticky top-0 z-30">
        <div className={cn("mx-auto flex w-full items-center justify-between gap-3 px-4 py-3 md:px-8", width)}>
          <Link href="/" aria-label="Rialto home" className="flex shrink-0 items-center gap-2.5">
            <Image src={asset("/brand/rialto-logo.svg")} alt="Rialto" width={358} height={100} priority unoptimized className="h-7 w-auto md:h-8" />
            {badge}
          </Link>
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">{right}</div>
        </div>
        <nav aria-label="Sections" className={cn("mx-auto flex w-full gap-1.5 overflow-x-auto px-4 pb-3 md:px-8 [scrollbar-width:none]", width)}>
          {tabs.map((t) => {
            const active = t.href === root ? path === root : path.startsWith(t.href);
            return (
              <Link
                key={t.href}
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 border-2 px-3.5 py-1.5 text-[15px] font-bold tracking-[-0.01em] transition-[transform,box-shadow] duration-100",
                  active ? "border-coal bg-lime text-coal shadow-[3px_3px_0_var(--color-coal)]" : "border-transparent text-coal/60 hover:border-coal/20 hover:text-coal",
                )}
              >
                <span aria-hidden className="text-[15px]">{t.emoji}</span>
                {t.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className={cn("mx-auto w-full flex-1 px-4 py-7 md:px-8 md:py-10", width)}>{children}</main>
      <footer className="border-t-2 border-coal/10">
        <div className={cn("mx-auto flex w-full flex-wrap items-center justify-between gap-2 px-4 py-4 font-mono text-[11px] text-coal/50 md:px-8", width)}>
          <span>Rialto · agents that hire</span>
          <span className="flex gap-4">
            <Link href="/catalog" className="hover:text-coal">Catalog</Link>
            <a href="https://x.com/GalleriaRialto" target="_blank" rel="noreferrer" className="hover:text-coal">@GalleriaRialto</a>
          </span>
        </div>
      </footer>
    </div>
  );
}

/** A small rounded-off chip for the header: balance, email, mode. */
export function Chip({ children, className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span className={cn("inline-flex min-h-9 items-center gap-1.5 border-2 border-coal bg-surface px-2.5 font-mono text-[11px] font-bold", className)} {...props}>
      {children}
    </span>
  );
}
