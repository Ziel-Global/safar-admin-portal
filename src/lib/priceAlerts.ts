import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface PriceAlert {
  id: string;
  package_id: string;
  target_price: number;
  currency: string;
  is_active: boolean;
  triggered_at: string | null;
  created_at: string;
}

/**
 * Fetches the current user's active price alerts and exposes a Set of package_ids
 * for which an alert exists.
 */
export function usePriceAlerts() {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) {
      setAlerts([]);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("price_alerts")
      .select("id, package_id, target_price, currency, is_active, triggered_at, created_at")
      .eq("pilgrim_id", user.id)
      .order("created_at", { ascending: false });
    setAlerts((data ?? []) as PriceAlert[]);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const activePackageIds = new Set(
    alerts.filter((a) => a.is_active).map((a) => a.package_id),
  );

  return { alerts, activePackageIds, refresh, loading };
}
