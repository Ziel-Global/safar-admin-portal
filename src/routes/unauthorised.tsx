import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldOff, ArrowLeft, LayoutDashboard } from "lucide-react";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

export const Route = createFileRoute("/unauthorised")({
  head: () => ({
    meta: [
      { title: "Access denied - Safar" },
      { name: "description", content: "You don't have permission to view this page." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: UnauthorisedPage,
});

function UnauthorisedPage() {
  const { profile, user } = useAuth();
  const dashboardPath =
    profile?.role === "admin"
      ? "/admin"
      : profile?.role === "agent"
      ? "/agent/dashboard"
      : "/dashboard";

  return (
    <PublicLayout>
      <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-16">
        <div className="mx-auto w-full max-w-xl text-center">
          {/* Branded illustration */}
          <div className="relative mx-auto mb-8 h-40 w-40">
            <div className="absolute inset-0 animate-pulse rounded-full bg-gradient-to-br from-primary/20 via-accent/10 to-transparent blur-2xl" />
            <div className="relative flex h-40 w-40 items-center justify-center rounded-full border border-border bg-card shadow-xl shadow-primary/5">
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-destructive/10">
                <ShieldOff className="h-12 w-12 text-destructive" strokeWidth={1.75} />
              </div>
            </div>
          </div>

          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Access denied
          </h1>
          <p className="mt-3 text-base text-muted-foreground">
            You don't have permission to view this page. If you believe this is a mistake, please
            contact support or sign in with a different account.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild variant="outline">
              <Link to="/">
                <ArrowLeft className="mr-1 h-4 w-4" /> Go home
              </Link>
            </Button>
            {user ? (
              <Button asChild>
                <Link to={dashboardPath as "/dashboard"}>
                  <LayoutDashboard className="mr-1 h-4 w-4" /> Go to your dashboard
                </Link>
              </Button>
            ) : (
              <Button asChild>
                <Link to="/login">Sign in</Link>
              </Button>
            )}
          </div>
        </div>
      </main>
    </PublicLayout>
  );
}
