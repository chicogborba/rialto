"use client";

import { useCallback, useEffect, useState } from "react";
import { useDataVersion } from "./data-events";

export interface FetchState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  refetch: () => void;
}

/** Minimal GET hook. Refetches on mount, when `url` changes, or when app data changes. */
export function useFetch<T>(url: string | null): FetchState<T> {
  const version = useDataVersion();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(url !== null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (url === null) return;
    const ctrl = new AbortController();
    setLoading(true);
    fetch(url, { signal: ctrl.signal, cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return (await r.json()) as T;
      })
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setError(e instanceof Error ? e.message : "request failed");
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoading(false);
      });
    return () => ctrl.abort();
  }, [url, version, tick]);

  const refetch = useCallback(() => setTick((n) => n + 1), []);
  return { data, error, loading, refetch };
}
