"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ModeBadge } from "@/components/primitives";
import { useAccount } from "@/lib/client/account";
import { formatUsd } from "@/lib/money";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/agents", label: "Agents" },
  { href: "/dashboard/apis", label: "My APIs" },
  { href: "/dashboard/wallet", label: "Wallet" },
  { href: "/dashboard/settings", label: "Settings" },
] as const;

/** Frame of the signed-in platform: who you are, what you hold, and the sections. */
export function AccountShell({ children }: { children: React.ReactNode }) {
  const { account, signOut } = useAccount();
  const path = usePathname();
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-line px-4 pt-4 md:px-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/" className="text-xl font-bold uppercase tracking-tight">
            Rial<span className="text-signal">to</span>
          </Link>
          <div className="flex flex-wrap items-center gap-3 font-mono text-[11px]">
            {account && <ModeBadge mode={account.mode} />}
            {account ? (
              <Link href="/dashboard/wallet" className="tnum border border-line px-3 py-2 uppercase tracking-wider hover:border-signal" title="Money on your account, not yet given to an agent">
                {formatUsd(account.user.balanceMicro)} USDC
              </Link>
            ) : (
              <span className="h-9 w-28 border border-line" aria-hidden />
            )}
            <span className="hidden text-muted sm:inline">{account?.user.email}</span>
            <button type="button" onClick={() => signOut()} className="py-2 font-bold uppercase tracking-wider text-muted underline hover:text-signal">
              Sign out
            </button>
          </div>
        </div>
        <nav aria-label="Dashboard" className="-mb-px mt-4 flex gap-1 overflow-x-auto">
          {TABS.map(({ href, label }) => {
            const active = href === "/dashboard" ? path === "/dashboard" : path.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn("whitespace-nowrap border border-b-0 px-4 py-2.5 font-mono text-[11px] font-bold uppercase tracking-[0.12em]", active ? "border-line bg-ink text-signal" : "border-transparent text-muted hover:text-paper")}
              >
                {label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="mx-auto w-full max-w-[1100px] flex-1 px-4 py-8 md:px-10 md:py-12">{account ? children : <p className="font-mono text-xs text-muted">Loading your account…</p>}</main>
    </div>
  );
}
