import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Loader2, ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Login - Safar" },
      { name: "description", content: "Sign in to your Safar account to manage Hajj and Umrah bookings." },
      { property: "og:title", content: "Login - Safar" },
      { property: "og:description", content: "Sign in to your Safar account." },
    ],
  }),
  component: LoginPage,
});

function safeRedirect(target: string | undefined): string | null {
  if (!target) return null;
  // Only allow same-origin relative paths to prevent open-redirect attacks.
  if (target.startsWith("/") && !target.startsWith("//")) return target;
  return null;
}

function LoginPage() {
  const { user, profile, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [justLoggedIn, setJustLoggedIn] = useState(false);

  // Only auto-redirect already-logged-in users when they were explicitly sent
  // here with a ?redirect= target (e.g. by a protected route). When a user
  // deliberately navigates to /login, show the page so they can switch accounts.
  // Use SPA navigation (not window.location.href) so the in-memory auth session
  // is preserved — a hard reload here can race with auth rehydration and leave
  // the user looping back to /login.
  useEffect(() => {
    if (loading || !user || !profile) return;
    const intended = safeRedirect(search.redirect);
    if (intended) {
      navigate({ to: intended as "/admin", replace: true });
      return;
    }
    if (justLoggedIn) {
      navigate({ to: "/admin", replace: true });
    }
  }, [loading, user, profile, navigate, search.redirect, justLoggedIn]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setSubmitting(false);

    if (error) {
      toast.error(error.message);
      return;
    }
    setJustLoggedIn(true);
    toast.success("Welcome back");
  };

  return (
    <PublicLayout showFooter={false} staticHeader>
      <div className="flex min-h-[calc(100vh-4.5rem)] items-center justify-center px-4 py-16">
        <Card className="w-full max-w-md border-border bg-card shadow-lg">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex items-center justify-center gap-2.5">
              <span className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <ShieldAlert className="h-5 w-5" />
              </span>
              <span className="text-xl font-bold tracking-tight text-primary">Safar Admin</span>
            </div>
            <CardTitle className="text-2xl">Welcome back</CardTitle>
            <CardDescription>Sign in to the Safar Admin console</CardDescription>
          </CardHeader>
          <CardContent>
            {user && profile && (
              <div className="mb-4 rounded-md border border-border bg-muted/50 p-3 text-sm">
                <p className="text-muted-foreground">
                  You're already signed in
                  {profile.full_name ? ` as ${profile.full_name}` : ""}.
                </p>
                <div className="mt-2 flex items-center gap-3">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => navigate({ to: "/admin" })}
                  >
                    Continue to admin
                  </Button>
                  <button
                    type="button"
                    className="text-xs text-primary hover:underline"
                    onClick={() => signOut()}
                  >
                    Sign out to switch accounts
                  </button>
                </div>
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <Link to="/forgot-password" className="text-xs text-primary hover:underline">
                    Forgot password?
                  </Link>
                </div>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </div>
              <Button
                type="submit"
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                disabled={submitting}
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign in"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </PublicLayout>
  );
}
