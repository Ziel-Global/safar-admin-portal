import { useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/** Error shape that may indicate an expired/invalid JWT. */
interface MaybeAuthError {
  status?: number;
  code?: string;
  message?: string;
}

function looksLikeAuthError(err: MaybeAuthError | null | undefined): boolean {
  if (!err) return false;
  if (err.status === 401) return true;
  const msg = (err.message ?? "").toLowerCase();
  if (err.code === "PGRST301" || err.code === "PGRST302") return true;
  if (msg.includes("jwt") && (msg.includes("expired") || msg.includes("invalid"))) return true;
  if (msg.includes("not authenticated") || msg.includes("invalid token")) return true;
  return false;
}

let refreshing: Promise<boolean> | null = null;

async function refreshSessionOnce(): Promise<boolean> {
  if (!refreshing) {
    refreshing = (async () => {
      const { data, error } = await supabase.auth.refreshSession();
      return !error && !!data.session;
    })().finally(() => {
      // Clear after a tick so concurrent callers reuse the same in-flight refresh
      setTimeout(() => {
        refreshing = null;
      }, 0);
    });
  }
  return refreshing;
}

async function handleAuthFailure() {
  try {
    await supabase.removeAllChannels();
  } catch {
    /* ignore */
  }
  await supabase.auth.signOut({ scope: "local" });
  toast.error("Your session has expired. Please sign in again.");
  if (typeof window !== "undefined") {
    const here = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.href = `/login?redirect=${here}`;
  }
}

/**
 * Wrap any Supabase call so a JWT-expired error triggers a single refresh + retry.
 * If the refresh fails, the user is signed out cleanly.
 *
 * Usage:
 *   const data = await runWithAuthRetry(() =>
 *     supabase.from("packages").select("*").eq("agent_id", id),
 *   );
 */
export async function runWithAuthRetry<T>(
  call: () => PromiseLike<{ data: T; error: MaybeAuthError | null }>,
): Promise<{ data: T | null; error: MaybeAuthError | null }> {
  const first = await call();
  if (!looksLikeAuthError(first.error)) return first;

  const refreshed = await refreshSessionOnce();
  if (!refreshed) {
    await handleAuthFailure();
    return { data: null, error: first.error };
  }

  const second = await call();
  if (looksLikeAuthError(second.error)) {
    await handleAuthFailure();
  }
  return second;
}

/**
 * React hook variant - returns a stable wrapped runner.
 *
 * const run = useSupabaseQuery();
 * const { data, error } = await run(() => supabase.from(...).select(...));
 */
export function useSupabaseQuery() {
  const ref = useRef(runWithAuthRetry);
  return useCallback(
    <T,>(call: () => PromiseLike<{ data: T; error: MaybeAuthError | null }>) => ref.current(call),
    [],
  );
}
