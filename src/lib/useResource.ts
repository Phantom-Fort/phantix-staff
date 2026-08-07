import { useCallback, useEffect, useState, useRef } from "react";
import type { Dispatch, SetStateAction } from "react";
import { DEMO_MODE } from "./api";

export type ResourceState<T> = {
  data: T;
  loading: boolean;
  error: string | null;
  refresh: () => void;
  demo: boolean;
  /** Imperatively patch the cached value (optimistic updates / SSE live updates). */
  setData: Dispatch<SetStateAction<T>>;
};

// Simple in-memory cache for stale-while-revalidate.
// Explicit `cacheKey` (third arg) is preferred; falls back to loader source.
const _swrCache = new Map<string, { data: unknown; ts: number }>();
const CACHE_TTL_MS = 60_000;

function loaderKey(loader: () => unknown, cacheKey?: string): string | undefined {
  if (cacheKey) return cacheKey;
  try {
    return String(loader);
  } catch {
    return undefined;
  }
}

/** Load live API data (SWR: show cached value, then revalidate in background). */
export function useResource<T>(
  loader: (signal?: AbortSignal) => Promise<T>,
  initial: T,
  cacheKey?: string,
): ResourceState<T> {
  const key = loaderKey(loader, cacheKey);
  const [data, setData] = useState<T>(() => {
    if (key && _swrCache.has(key)) return _swrCache.get(key)!.data as T;
    return initial;
  });
  const [loading, setLoading] = useState(() => !(key && _swrCache.has(key)));
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const demo = DEMO_MODE;
  const mountedRef = useRef(true);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    const hadCached = key && _swrCache.has(key);
    if (!hadCached) setLoading(true);
    setError(null);

    loader()
      .then((value) => {
        if (!mountedRef.current) return;
        setData(value);
        if (key) _swrCache.set(key, { data: value, ts: Date.now() });
      })
      .catch((err: unknown) => {
        if (!mountedRef.current) return;
        if (!hadCached) setError(err instanceof Error ? err.message : "Failed to load");
      })
      .finally(() => {
        if (!mountedRef.current) return;
        setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, demo]);

  return { data, loading, error, refresh, demo, setData };
}

/** Clear stale entries from SWR cache */
if (typeof window !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of _swrCache) {
      if (now - v.ts > CACHE_TTL_MS) _swrCache.delete(k);
    }
  }, 30_000);
}
