import { useCallback, useRef } from "react";
import { useQueryClient, type QueryKey } from "@tanstack/react-query";

const HOVER_DELAY_MS = 200;

/**
 * Returns onMouseEnter / onMouseLeave handlers that prefetch the given query
 * after `HOVER_DELAY_MS`. Cancels the timer if the user moves away first.
 *
 * Use on cards that link into a detail page so the click feels instant.
 */
export function usePrefetchOnHover<T>(
  queryKey: QueryKey,
  queryFn: () => Promise<T>,
  options?: { staleTime?: number; enabled?: boolean },
) {
  const qc = useQueryClient();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onMouseEnter = useCallback(() => {
    if (options?.enabled === false) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      void qc.prefetchQuery({
        queryKey,
        queryFn,
        staleTime: options?.staleTime ?? 5 * 60 * 1000,
      });
    }, HOVER_DELAY_MS);
  }, [qc, queryKey, queryFn, options?.staleTime, options?.enabled]);

  const onMouseLeave = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  return { onMouseEnter, onMouseLeave };
}
