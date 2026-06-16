import { useCallback } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { queryKeys } from "./keys";

const KEY = "safar_watchlist";

function readLocal(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}

function writeLocal(ids: string[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(ids));
  window.dispatchEvent(new CustomEvent("safar:watchlist-changed"));
}

/**
 * Loads the watchlist from the server (when signed in), merging any guest
 * IDs from localStorage. Falls back to local-only when signed out.
 */
async function fetchWatchlist(userId: string | null): Promise<string[]> {
  if (!userId) return readLocal();

  // Fields: only package_id — that's all the UI needs to flag saved cards.
  const { data, error } = await supabase
    .from("watchlist")
    .select("package_id")
    .eq("pilgrim_id", userId);
  if (error) throw error;
  const remote = (data ?? []).map((r) => r.package_id as string);

  // Push any guest-saved IDs to the server, then return the merged set.
  const local = readLocal();
  const toPush = local.filter((id) => !remote.includes(id));
  if (toPush.length > 0) {
    const { error: pushError } = await supabase
      .from("watchlist")
      .upsert(
        toPush.map((pid) => ({ pilgrim_id: userId, package_id: pid })),
        { onConflict: "pilgrim_id,package_id" },
      );
    if (pushError) throw pushError;
    const merged = Array.from(new Set([...remote, ...toPush]));
    writeLocal(merged);
    return merged;
  }
  writeLocal(remote);
  return remote;
}

interface ToggleArgs {
  packageId: string;
  priceAtSave?: number | null;
  wasSaved: boolean;
}

interface ToggleContext {
  previous: string[];
}

/**
 * Watchlist hook — fetches saved IDs and exposes an optimistic toggle mutation.
 *
 * The mutation updates the cache immediately (and localStorage so the
 * cross-tab broadcast still works), then writes to the server. On error the
 * cache snapshot is restored.
 */
export function useWatchlist() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const qc = useQueryClient();
  const key = queryKeys.watchlist.forUser(userId);

  const { data: ids = [], isLoading } = useQuery({
    queryKey: key,
    queryFn: () => fetchWatchlist(userId),
    // Spec: 5 minutes for the watchlist.
    staleTime: 5 * 60 * 1000,
  });

  const toggleMutation = useMutation<void, Error, ToggleArgs, ToggleContext>({
    mutationFn: async ({ packageId, priceAtSave, wasSaved }) => {
      if (!userId) {
        // Surface the failure so onError reverts the optimistic state and
        // the UI can prompt the user to sign in instead of silently
        // pretending the save worked.
        throw new Error("not-authenticated");
      }
      if (wasSaved) {
        const { error } = await supabase
          .from("watchlist")
          .delete()
          .eq("pilgrim_id", userId)
          .eq("package_id", packageId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("watchlist").upsert(
          {
            pilgrim_id: userId,
            package_id: packageId,
            price_at_save: priceAtSave ?? null,
          },
          { onConflict: "pilgrim_id,package_id" },
        );
        if (error) throw error;
      }
    },
    onMutate: async ({ packageId, wasSaved }) => {
      // Cancel in-flight refetch so it doesn't overwrite our optimistic value.
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<string[]>(key) ?? [];
      const next = wasSaved
        ? previous.filter((x) => x !== packageId)
        : [...previous, packageId];
      qc.setQueryData<string[]>(key, next);
      // Mirror to localStorage so the cross-tab event keeps working.
      writeLocal(next);
      // Toast only for signed-in users — guests get a sign-in prompt in onError.
      if (userId) {
        toast.success(wasSaved ? "Removed from saved" : "Package saved");
      }
      return { previous };
    },
    onError: (err, _vars, ctx) => {
      if (ctx) {
        qc.setQueryData<string[]>(key, ctx.previous);
        writeLocal(ctx.previous);
      }
      if (err?.message === "not-authenticated") {
        toast.error("Sign in to save packages", {
          description: "Create a free account to keep track of your favourites.",
        });
      } else {
        toast.error("Couldn't update saved list", { description: "Please try again" });
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: key });
    },
  });

  const toggle = useCallback(
    async (packageId: string, priceAtSave?: number | null) => {
      await toggleMutation.mutateAsync({
        packageId,
        priceAtSave,
        wasSaved: ids.includes(packageId),
      });
    },
    [ids, toggleMutation],
  );

  const has = useCallback((packageId: string) => ids.includes(packageId), [ids]);

  return { ids, toggle, has, loading: isLoading };
}

/**
 * Imperative refresh used by other modules (e.g. AuthContext sign-out flow)
 * that want to wipe the local watchlist cache without a hook context.
 */
export function clearWatchlistCache(qc: QueryClient, userId: string | null) {
  qc.removeQueries({ queryKey: queryKeys.watchlist.forUser(userId) });
}
