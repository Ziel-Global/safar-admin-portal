import { supabase } from "@/integrations/supabase/client";

const SESSION_KEY = "safar_pv_seen";

function alreadyTracked(key: string): boolean {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    const set = raw ? new Set<string>(JSON.parse(raw) as string[]) : new Set<string>();
    if (set.has(key)) return true;
    set.add(key);
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(Array.from(set)));
    return false;
  } catch {
    return false;
  }
}

/**
 * Fire-and-forget page view log. Deduped per-session to avoid double counting
 * when React re-mounts during dev or when a user re-navigates.
 */
export async function trackPageView(pageType: "package" | "agent", entityId: string) {
  if (!entityId) return;
  const key = `${pageType}:${entityId}`;
  if (alreadyTracked(key)) return;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("page_views").insert({
      page_type: pageType,
      entity_id: entityId,
      viewer_id: user?.id ?? null,
    });
  } catch {
    /* swallow - analytics must never break the page */
  }
}
