"use client";

import { ChartNoAxesColumn, KeyRound, Receipt, ShieldCheck, Tags, Users } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/client/api";
import { AppFrame, type FrameTab } from "@/components/shell/AppFrame";

const TABS: FrameTab[] = [
  { href: "/admin", label: "Overview", icon: ChartNoAxesColumn },
  { href: "/admin/audit", label: "Audit", icon: ShieldCheck },
  { href: "/admin/purchases", label: "Purchases", icon: Receipt },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/apis", label: "APIs & prices", icon: Tags },
  { href: "/admin/settings", label: "Keys & wallets", icon: KeyRound },
];

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
    <AppFrame
      wide
      tabs={TABS}
      root="/admin"
      badge={<span className="border-2 border-coal bg-lime px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-[0.14em]">ADMIN</span>}
      right={
        <>
          {state.kind === "ok" && <span className="hidden max-w-[16rem] truncate font-mono text-[11px] text-coal/60 md:inline">{state.email}</span>}
          <Link href="/dashboard" className="inline-flex min-h-9 items-center border-2 border-coal bg-surface px-2.5 font-mono text-[11px] font-bold hover:bg-lime">
            ← Dashboard
          </Link>
        </>
      }
    >
      {state.kind === "ok" ? children : state.kind === "denied" ? <p className="font-mono text-sm text-fail">{state.message}</p> : <p className="font-mono text-xs text-muted">Checking access…</p>}
    </AppFrame>
  );
}
