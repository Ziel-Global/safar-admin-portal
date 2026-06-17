import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Heart,
  Bell,
  TrendingDown,
  TrendingUp,
  Trash2,
  BellOff,
  Inbox,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { OptimizedImage } from "@/components/ui/optimized-image";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { PriceAlertButton } from "@/components/packages/PriceAlertButton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useWatchlist } from "@/lib/watchlist";
import { usePriceAlerts } from "@/lib/priceAlerts";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dashboard/saved")({
  head: () => ({
    meta: [
      { title: "Saved Packages - Safar" },
      {
        name: "description",
        content: "Your watchlisted Hajj and Umrah packages and active price alerts.",
      },
    ],
  }),
  component: () => (
    <ProtectedRoute requireRole="pilgrim">
      <SavedPage />
    </ProtectedRoute>
  ),
});

interface SavedItem {
  watchlist_id: string;
  package_id: string;
  price_at_save: number | null;
  created_at: string;
  package: {
    id: string;
    slug: string | null;
    title: string;
    thumbnail_url: string | null;
    base_price: number | null;
    currency: string;
    hotel_name: string | null;
    hotel_zone: string | null;
  } | null;
}

function SavedPage() {
  const { user } = useAuth();
  const { toggle } = useWatchlist();
  const { alerts, activePackageIds, refresh: refreshAlerts } = usePriceAlerts();
  const [items, setItems] = useState<SavedItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data: watchlistRows, error } = await supabase
      .from("watchlist")
      .select("id, package_id, price_at_save, created_at")
      .eq("pilgrim_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Couldn't load saved packages");
      setItems([]);
      setLoading(false);
      return;
    }

    const packageIds = (watchlistRows ?? []).map((row) => row.package_id);
    const { data: packages, error: packagesError } = packageIds.length
      ? await supabase
          .from("packages")
          .select("id, slug, title, thumbnail_url, base_price, currency, hotel_name, hotel_zone")
          .in("id", packageIds)
      : { data: [], error: null };

    if (packagesError) {
      toast.error("Couldn't load saved package details");
    }

    const packagesById = new Map((packages ?? []).map((pkg) => [pkg.id, pkg]));
    setItems(
      (watchlistRows ?? []).map((r) => ({
        watchlist_id: r.id,
        package_id: r.package_id,
        price_at_save: r.price_at_save,
        created_at: r.created_at,
        package: packagesById.get(r.package_id) ?? null,
      })),
    );
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleRemove = async (packageId: string) => {
    await toggle(packageId);
    setItems((prev) => prev.filter((i) => i.package_id !== packageId));
    toast.success("Removed from saved packages");
  };

  const handleDeactivateAlert = async (alertId: string) => {
    const { error } = await supabase
      .from("price_alerts")
      .update({ is_active: false })
      .eq("id", alertId);
    if (error) {
      toast.error("Couldn't deactivate alert");
      return;
    }
    toast.success("Alert deactivated");
    refreshAlerts();
  };

  const activeAlerts = alerts.filter((a) => a.is_active);

  return (
    <DashboardLayout variant="pilgrim" title="Saved Packages">
      <div className="mx-auto w-full max-w-6xl">
        <div className="mb-8">
          <h2 className="text-2xl font-bold tracking-tight">Saved packages</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Track prices on packages you're interested in.
          </p>
        </div>

        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Skeleton className="h-56 w-full" />
            <Skeleton className="h-56 w-full" />
            <Skeleton className="h-56 w-full" />
          </div>
        ) : items.length === 0 ? (
          <Card className="border-dashed border-border">
            <CardContent className="flex flex-col items-center p-10 text-center">
              <Heart className="h-10 w-10 text-muted-foreground" />
              <p className="mt-3 text-sm text-muted-foreground">
                You haven't saved any packages yet.
              </p>
              <Button asChild className="mt-4">
                <Link to="/search">Browse packages</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <SavedCard
                key={item.watchlist_id}
                item={item}
                hasAlert={item.package ? activePackageIds.has(item.package.id) : false}
                onRemove={() => handleRemove(item.package_id)}
                onAlertCreated={refreshAlerts}
              />
            ))}
          </div>
        )}

        <section className="mt-12">
          <div className="mb-4 flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold">Active price alerts</h3>
            <Badge variant="secondary">{activeAlerts.length}</Badge>
          </div>
          {activeAlerts.length === 0 ? (
            <Card className="border-dashed border-border">
              <CardContent className="p-6 text-center text-sm text-muted-foreground">
                No active alerts. Set one from any saved package above.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {activeAlerts.map((a) => {
                const item = items.find((i) => i.package_id === a.package_id);
                return (
                  <Card key={a.id} className="border-border">
                    <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">
                          {item?.package?.title ?? "Package"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Notify when ≤ {formatPrice(a.target_price, a.currency)} · Set{" "}
                          {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDeactivateAlert(a.id)}
                      >
                        <BellOff className="h-4 w-4" /> Deactivate
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </DashboardLayout>
  );
}

function SavedCard({
  item,
  hasAlert,
  onRemove,
  onAlertCreated,
}: {
  item: SavedItem;
  hasAlert: boolean;
  onRemove: () => void;
  onAlertCreated: () => void;
}) {
  const pkg = item.package;
  if (!pkg) {
    return (
      <Card className="border-border">
        <CardContent className="p-4 text-sm text-muted-foreground">
          This package is no longer available.
          <Button size="sm" variant="ghost" onClick={onRemove} className="mt-2">
            <Trash2 className="h-4 w-4" /> Remove
          </Button>
        </CardContent>
      </Card>
    );
  }

  const current = pkg.base_price;
  const saved = item.price_at_save;
  const delta = current != null && saved != null ? current - saved : null;
  const deltaAbs = delta != null ? Math.abs(delta) : null;

  return (
    <Card className="overflow-hidden border-border">
      {pkg.slug ? (
        <Link
          to="/packages/$slug"
          params={{ slug: pkg.slug }}
          className="block aspect-[16/10] bg-secondary"
        >
          <OptimizedImage
            src={pkg.thumbnail_url}
            alt={pkg.title}
            size="card"
            wrapperClassName="h-full w-full"
            className="h-full w-full object-cover"
            fallback={
              <div className="flex h-full items-center justify-center text-muted-foreground">
                <Inbox className="h-8 w-8" />
              </div>
            }
          />
        </Link>
      ) : (
        <div className="flex aspect-[16/10] items-center justify-center bg-secondary text-muted-foreground">
          <Inbox className="h-8 w-8" />
        </div>
      )}
      <CardContent className="space-y-3 p-4">
        <div>
          <h4 className="line-clamp-2 text-sm font-semibold">{pkg.title}</h4>
          {pkg.hotel_name ? (
            <p className="mt-0.5 text-xs text-muted-foreground">{pkg.hotel_name}</p>
          ) : null}
        </div>

        <div className="flex items-end justify-between">
          <div>
            <p className="text-lg font-bold text-primary">
              {formatPrice(current, pkg.currency)}
            </p>
            {delta != null && deltaAbs != null && deltaAbs > 0 ? (
              <p
                className={cn(
                  "mt-0.5 inline-flex items-center gap-1 text-xs font-semibold",
                  delta < 0 ? "text-emerald-700" : "text-rose-700",
                )}
              >
                {delta < 0 ? (
                  <TrendingDown className="h-3.5 w-3.5" />
                ) : (
                  <TrendingUp className="h-3.5 w-3.5" />
                )}
                {formatPrice(deltaAbs, pkg.currency)} since saved
              </p>
            ) : saved != null ? (
              <p className="mt-0.5 text-xs text-muted-foreground">No change since saved</p>
            ) : null}
          </div>
          <p className="text-right text-[11px] text-muted-foreground">
            Saved {format(new Date(item.created_at), "MMM d")}
          </p>
        </div>

        <div className="flex items-center gap-2 border-t border-border pt-3">
          <PriceAlertButton
            packageId={pkg.id}
            currentPrice={current}
            currency={pkg.currency}
            hasAlert={hasAlert}
            onCreated={onAlertCreated}
            className="border border-border"
          />
          <Button size="sm" variant="ghost" onClick={onRemove} className="ml-auto">
            <Trash2 className="h-4 w-4" /> Remove
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
