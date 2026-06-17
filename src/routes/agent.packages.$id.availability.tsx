import { useEffect, useState } from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { ArrowLeft, Loader2 } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { AvailabilityCalendar } from "@/components/agent/AvailabilityCalendar";

export const Route = createFileRoute("/agent/packages/$id/availability")({
  head: () => ({
    meta: [{ title: "Manage Availability - Safar" }],
  }),
  component: () => (
    <ProtectedRoute requireRole="agent">
      <AvailabilityPage />
    </ProtectedRoute>
  ),
  errorComponent: ({ error, reset }) => {
    const router = useRouter();
    return (
      <DashboardLayout variant="agent" title="Availability">
        <div className="mx-auto max-w-xl text-center">
          <p className="text-sm text-destructive">{error.message}</p>
          <Button
            className="mt-4"
            onClick={() => {
              router.invalidate();
              reset();
            }}
          >
            Retry
          </Button>
        </div>
      </DashboardLayout>
    );
  },
  notFoundComponent: () => (
    <DashboardLayout variant="agent" title="Availability">
      <div className="mx-auto max-w-xl text-center">
        <h2 className="text-lg font-bold">Package not found</h2>
        <Button asChild className="mt-4">
          <Link to="/agent/packages">Back to packages</Link>
        </Button>
      </div>
    </DashboardLayout>
  ),
});

function AvailabilityPage() {
  const { id } = Route.useParams();
  const [pkg, setPkg] = useState<{ title: string; base_price: number | null; currency: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("packages")
        .select("title, base_price, currency")
        .eq("id", id)
        .single();
      if (error) {
        setPkg(null);
      } else {
        setPkg(data as { title: string; base_price: number | null; currency: string });
      }
      setLoading(false);
    })();
  }, [id]);

  return (
    <DashboardLayout variant="agent" title="Availability">
      <div className="mx-auto w-full max-w-5xl">
        <div className="mb-4">
          <Link
            to="/agent/packages"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to packages
          </Link>
        </div>
        <div className="mb-6">
          <h2 className="text-2xl font-bold tracking-tight">Availability</h2>
          {pkg && (
            <p className="mt-1 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{pkg.title}</span> · base{" "}
              {pkg.currency} {pkg.base_price ?? "-"}
            </p>
          )}
        </div>

        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : !pkg ? (
          <p className="text-sm text-muted-foreground">Package not found.</p>
        ) : (
          <AvailabilityCalendar packageId={id} />
        )}
      </div>
    </DashboardLayout>
  );
}
