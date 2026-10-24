import Image from "next/image";
import Link from "next/link";
import { asset } from "@/lib/site";

/** Shell for the pages outside the dashboard (sign up, sign in), in the landing's light style. */
export function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="light flex min-h-screen flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-5 py-4 md:px-8 md:py-5">
        <Link href="/" aria-label="Rialto home" className="flex shrink-0 items-center">
          <Image src={asset("/brand/rialto-logo.svg")} alt="Rialto" width={358} height={100} priority unoptimized className="h-8 w-auto sm:h-9" />
        </Link>
        <nav aria-label="Primary" className="flex items-center gap-5 text-sm font-medium">
          <Link href="/catalog" className="text-coal/70 hover:text-coal">Catalog</Link>
          <Link href="/demo" className="text-coal/70 hover:text-coal">Demo</Link>
        </nav>
      </header>
      <main className="mx-auto flex w-full max-w-6xl flex-1 items-start justify-center px-5 pb-16 pt-4 md:items-center md:px-8 md:pt-0">{children}</main>
    </div>
  );
}
