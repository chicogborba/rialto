"use client";

import { useEffect, useState } from "react";
import { api } from "./api";

/** Whether this server lets agents pay from a wallet the user links (it has a spender and real payments on). */
export function usePayWalletAvailable(): boolean {
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    let alive = true;
    void api<{ available: boolean }>("/api/account/pay-wallet").then((r) => alive && setAvailable(Boolean(r.data?.available)));
    return () => {
      alive = false;
    };
  }, []);
  return available;
}
