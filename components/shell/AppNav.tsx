"use client";

import { Activity, Boxes, Gauge, Plug, Receipt, Rocket, Settings, Store } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/app", label: "Console", icon: Activity },
  { href: "/app/marketplace", label: "Exchange", icon: Store },
  { href: "/app/providers", label: "Providers", icon: Boxes },
  { href: "/app/transactions", label: "Transactions", icon: Receipt },
  { href: "/app/reputation", label: "Reputation", icon: Gauge },
  { href: "/app/settings", label: "Settings", icon: Settings },
  { href: "/connect", label: "Connect", icon: Plug },
  { href: "/publish", label: "Publish", icon: Rocket },
] as const;

export function AppNav() {
  const path = usePathname();
  return (
    <nav aria-label="App" className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-ink md:static md:w-44 md:shrink-0 md:flex-col md:border-r md:border-t-0">
      {ITEMS.map(({ href, label, icon: Icon }) => {
        const active = href === "/app" ? path === "/app" : path.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-14 flex-1 flex-col items-center justify-center gap-1 font-mono text-[9px] font-bold uppercase tracking-[0.1em] md:min-h-11 md:flex-none md:flex-row md:justify-start md:gap-3 md:px-4 md:text-[11px]",
              active ? "bg-signal text-ink" : "text-muted hover:bg-raised hover:text-paper",
            )}
          >
            <Icon className="size-4" aria-hidden />
            <span className="max-[400px]:sr-only md:not-sr-only">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
