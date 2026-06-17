import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, Clock, Mail } from "lucide-react";
import { z } from "zod";
import { zodValidator } from "@tanstack/zod-adapter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";

const searchSchema = z.object({
  id: z.string().uuid().optional(),
  count: z.number().int().nonnegative().default(0),
});

export const Route = createFileRoute("/rfq/sent")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({
    meta: [
      { title: "Request Sent - Safar" },
      { name: "description", content: "Your quote request has been delivered to verified agents." },
    ],
  }),
  component: SentPage,
});

function SentPage() {
  return (
    <ProtectedRoute requireRole="pilgrim">
      <SentContent />
    </ProtectedRoute>
  );
}

function SentContent() {
  const { id, count } = Route.useSearch();
  return (
    <DashboardLayout variant="pilgrim" title="Request Sent">
      <div className="mx-auto w-full max-w-xl">
        <Card className="border-border">
          <CardContent className="p-8 text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
              <CheckCircle2 className="h-10 w-10 text-primary" />
            </div>
            <h2 className="mt-6 text-2xl font-bold tracking-tight text-foreground">
              Your request is on its way
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {count > 0 ? (
                <>
                  We've sent your request to <strong className="text-foreground">{count}</strong>{" "}
                  verified {count === 1 ? "agent" : "agents"} matching your trip details.
                </>
              ) : (
                <>
                  We're still expanding our agent network for your route. We'll keep matching as new
                  agents join - check back soon.
                </>
              )}
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-border p-3 text-left">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Clock className="h-4 w-4 text-primary" /> 24–48h
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Typical time to receive your first quotes.
                </p>
              </div>
              <div className="rounded-lg border border-border p-3 text-left">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Mail className="h-4 w-4 text-primary" /> Notifications
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  We'll let you know in your dashboard the moment quotes arrive.
                </p>
              </div>
            </div>

            <div className="mt-7 flex flex-col gap-2 sm:flex-row sm:justify-center">
              {id ? (
                <Button asChild>
                  <Link to="/dashboard/rfqs/$id" params={{ id }}>
                    View this request
                  </Link>
                </Button>
              ) : null}
              <Button variant="outline" asChild>
                <Link to="/dashboard">Back to dashboard</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
