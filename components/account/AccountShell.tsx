"use client";

import Link from "next/link";
import { AppFrame, Chip, type FrameTab } from "@/components/shell/AppFrame";
import { useAccount } from "@/lib/client/account";

const TABS: FrameTab[] = [
  { href: "/dashboard", label: "Home", emoji: "🏠" },
  { href: "/dashboard/agents", label: "Agents", emoji: "🤖" },
  { href: "/dashboard/wallet", label: "Wallet", emoji: "👛" },
  { href: "/dashboard/apis", label: "My APIs", emoji: "🔌" },
  { href: "/dashboard/settings", label: "Settings", emoji: "⚙️" },
];

/** Frame of the signed-in platform: who you are, how payments run, and the sections. */
export function AccountShell({ children }: { children: React.ReactNode }) {
  const { account, signOut } = useAccount();
  const live = account?.mode === "live";
  return (
    <AppFrame
      tabs={TABS}
      root="/dashboard"
      right={
        <>
          {account && (
            <Chip className={live ? "bg-lime" : "bg-sand"} title={live ? "Purchases are real x402 payments on Solana" : "Purchases are simulated"}>
              <span aria-hidden className="size-1.5 bg-coal" />
              {live ? (account.testMoney ? "Devnet" : "Mainnet") : "Simulated"}
            </Chip>
          )}
          {account?.isAdmin && (
            <Link href="/admin" className="inline-flex min-h-9 items-center border-2 border-coal bg-coal px-2.5 font-mono text-[11px] font-bold text-cream hover:bg-lime hover:text-coal">
              Admin
            </Link>
          )}
          <span className="hidden max-w-[16rem] truncate font-mono text-[11px] text-coal/60 md:inline">{account?.user.email}</span>
          <button type="button" onClick={() => signOut()} className="min-h-9 px-1 text-sm font-bold text-coal/70 underline decoration-coal/30 underline-offset-4 hover:text-coal">
            Sign out
          </button>
        </>
      }
    >
      {account ? children : <Loading />}
    </AppFrame>
  );
}

function Loading() {
  return (
    <div className="grid gap-4 sm:grid-cols-3" aria-busy="true" aria-label="Loading your account">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-28 animate-pulse border-2 border-coal/15 bg-surface" />
      ))}
    </div>
  );
}
