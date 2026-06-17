import { createFileRoute } from "@tanstack/react-router";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Package, Calendar, Users, BarChart3, ShieldAlert } from "lucide-react";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { useAuth } from "@/contexts/AuthContext";
import { VerificationProgress } from "@/components/agent/VerificationProgress";
import { AvailabilityToggle } from "@/components/agent/AvailabilityToggle";
import { TrustBreakdownCard } from "@/components/agent/TrustBreakdownCard";
import { ComplianceWidget } from "@/components/agent/ComplianceWidget";
import { RegulatoryUpdatesWidget } from "@/components/agent/RegulatoryUpdatesWidget";

export const Route = createFileRoute("/agent/dashboard")({
  head: () => ({
    meta: [
      { title: "Agent Dashboard - Safar" },
      { name: "description", content: "Manage your Hajj and Umrah packages, bookings, and customers as a verified Safar agent." },
      { property: "og:title", content: "Agent Dashboard - Safar" },
      { property: "og:description", content: "Your agent dashboard." },
    ],
  }),
  component: AgentDashboardPage,
});

function AgentDashboardPage() {
  return (
    <ProtectedRoute requireRole="agent">
      <AgentDashboardContent />
    </ProtectedRoute>
  );
}

function AgentDashboardContent() {
  const { agent, profile } = useAuth();
  const name = agent?.business_name ?? profile?.full_name ?? "agent";
  return (
    <DashboardLayout
      variant="agent"
      title="Agent Dashboard"
      headerExtras={agent?.id ? <AvailabilityToggle agentId={agent.id} /> : null}
    >
      <div className="mx-auto w-full max-w-6xl">
        <div className="mb-8">
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            Welcome back, {name}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your packages and connect with pilgrims worldwide.
          </p>
        </div>

        {agent?.status === "suspended" || agent?.status === "banned" ? (
          <Alert variant="destructive" className="mb-6">
            <ShieldAlert className="h-4 w-4" />
            <AlertTitle>
              {agent.status === "banned"
                ? "Your account has been permanently banned"
                : "Your account is currently suspended"}
            </AlertTitle>
            <AlertDescription>
              {agent.status === "banned"
                ? "Your account has been disabled and your packages are no longer visible to pilgrims. Contact the Safar trust team if you believe this is a mistake."
                : "Your packages are hidden from search and new leads are paused until the suspension is lifted. Check your notifications for details, or contact the Safar trust team."}
            </AlertDescription>
          </Alert>
        ) : null}



        {agent?.id ? (
          <>
            <div className="mb-6 grid gap-6 lg:grid-cols-2">
              <VerificationProgress agentId={agent.id} />
              <TrustBreakdownCard agentId={agent.id} />
            </div>
            <div className="mb-6 grid gap-6 lg:grid-cols-2">
              <ComplianceWidget agentId={agent.id} />
              <RegulatoryUpdatesWidget countryCode={agent?.country_code ?? null} />
            </div>
          </>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Package, title: "Active packages", value: "0" },
            { icon: Calendar, title: "Bookings", value: "0" },
            { icon: Users, title: "Customers", value: "0" },
            { icon: BarChart3, title: "Revenue", value: "$0" },
          ].map((c) => (
            <Card key={c.title} className="border-border">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardDescription>{c.title}</CardDescription>
                  <c.icon className="h-4 w-4 text-primary" />
                </div>
                <CardTitle className="text-2xl">{c.value}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-2 rounded-full bg-secondary" />
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="mt-6 border-border">
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
            <CardDescription>Your latest bookings and inquiries will appear here.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-48 rounded-md bg-secondary/60" />
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
