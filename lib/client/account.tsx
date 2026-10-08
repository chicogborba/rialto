"use client";

import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { AccountView } from "@/lib/db/users";
import type { PaymentMode } from "@/lib/types";
import { api } from "./api";

export type AccountData = AccountView & {
  mode: PaymentMode;
  /** where deposits go; null unless the live rail is on */
  treasury: { address: string; explorer: string; mint: string; network: "solana-devnet" } | null;
  welcomeCreditMicro: number;
};

interface AccountContext {
  account: AccountData | null;
  /** reload the account from the server */
  refresh: () => Promise<void>;
  signOut: (everywhere?: boolean) => Promise<void>;
}

const Ctx = createContext<AccountContext | null>(null);

/** Loads the signed-in account for everything under /dashboard, and sends signed-out visitors to /login. */
export function AccountProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const path = usePathname();
  const [account, setAccount] = useState<AccountData | null>(null);

  const refresh = useCallback(async () => {
    const r = await api<AccountData>("/api/account");
    if (r.ok && r.data) setAccount(r.data);
    else if (r.status === 401) router.replace(`/login?next=${encodeURIComponent(path)}`);
  }, [router, path]);

  useEffect(() => {
    let alive = true;
    void Promise.resolve().then(() => {
      if (alive) void refresh();
    });
    return () => {
      alive = false;
    };
  }, [refresh]);

  const signOut = useCallback(
    async (everywhere = false) => {
      await api("/api/auth/logout", { json: { everywhere } });
      router.replace("/login");
    },
    [router],
  );

  const value = useMemo(() => ({ account, refresh, signOut }), [account, refresh, signOut]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAccount(): AccountContext {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAccount must be used inside the dashboard");
  return ctx;
}
