"use client";

import { useEffect, useState } from "react";

const EVENT = "sy:data";

/** Tell every mounted data consumer (wallet chip, dashboard, tables) to refetch. */
export function emitDataChanged(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(EVENT));
}

/** Increments whenever data changes elsewhere in the app. Use as a refetch dependency. */
export function useDataVersion(): number {
  const [v, setV] = useState(0);
  useEffect(() => {
    const on = () => setV((n) => n + 1);
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, []);
  return v;
}
