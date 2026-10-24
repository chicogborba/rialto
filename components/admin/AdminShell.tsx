"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/client/api";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/purchases", label: "Purchases" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/apis", label: "APIs & prices" },
  { href: "/admin/settings", label: "Keys & wallets" },
] as const;

/** Frame of the operator's panel. It shows nothing until the server says this account is an admin. */
export function AdminShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [state, setState] = useState<{ kind: "loading" } | { kind: "ok"; email: string } | { kind: "denied"; message: string }>({ kind: "loading" });

  useEffect(() => {
    let alive = true;
    void api<{ email: string }>("/api/admin/me").then((r) => {
      if (!alive) return;
      if (r.ok && r.data) setState({ kind: "ok", email: r.data.email });
      else if (r.status === 401) router.replace(`/login?next=${encodeURIComponent(path)}`);
      else setState({ kind: "denied", message: r.error ?? "Not allowed." });
    });
    return () => {
      alive = false;
    };
  }, [router, path]);

  return (
    <div className="flex min-h-screen flex-col bg-ink text-paper">
      <header className="border-b border-line px-4 pt-4 md:px-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/" className="flex items-baseline gap-3 text-xl font-bold uppercase tracking-tight">
            <span>
              Rial<span className="text-signal">to</span>
            </span>
            <span className="border border-signal px-2 py-0.5 font-mono text-[10px] tracking-[0.14em] text-signal">ADMIN</span>
          </Link>
          <div className="flex items-center gap-4 font-mono text-[11px]">
            {state.kind === "ok" && <span className="hidden text-muted sm:inline">{state.email}</span>}
            <Link href="/dashboard" className="py-2 font-bold uppercase tracking-wider text-muted underline hover:text-signal">
              Dashboard
            </Link>
          </div>
        </div>
        <nav aria-label="Admin" className="-mb-px mt-4 flex gap-1 overflow-x-auto">
          {TABS.map(({ href, label }) => {
            const active = href === "/admin" ? path === "/admin" : path.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn("whitespace-nowrap border border-b-0 px-4 py-2.5 font-mono text-[11px] font-bold uppercase tracking-[0.12em]", active ? "border-line bg-surface text-signal" : "border-transparent text-muted hover:text-paper")}
              >
                {label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="mx-auto w-full max-w-[1240px] flex-1 px-4 py-8 md:px-10 md:py-10">
        {state.kind === "ok" ? children : state.kind === "denied" ? <p className="font-mono text-sm text-fail">{state.message}</p> : <p className="font-mono text-xs text-muted">Checking access…</p>}
      </main>
    </div>
  );
}
