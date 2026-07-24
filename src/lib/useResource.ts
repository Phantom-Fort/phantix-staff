import { useState, useEffect, useCallback, useRef } from "react";
import { api, ApiError } from "./api";

export interface ResourceState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useResource<T>(
  fetcher: (signal: AbortSignal) => Promise<T>,
  deps: unknown[] = [],
): ResourceState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const version = useRef(0);

  const refresh = useCallback(() => {
    version.current += 1;
    const v = version.current;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    fetcher(controller.signal)
      .then((res) => {
        if (v === version.current) {
          setData(res);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (v === version.current && err.name !== "AbortError") {
          setError(err instanceof ApiError ? err.message : "Failed to load data");
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, deps);

  useEffect(() => {
    const cancel = refresh();
    return cancel;
  }, [refresh]);

  return { data, loading, error, refresh };
}

export function useApi<T>(path: string, params?: Record<string, string | number | boolean>): ResourceState<T> {
  return useResource(
    (signal) => api.get<T>(path, { params }),
    [path, JSON.stringify(params)],
  );
}
