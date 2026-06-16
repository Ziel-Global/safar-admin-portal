import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Admin Login - Safar" },
      { name: "description", content: "Sign in to access the Safar admin portal." },
      { property: "og:title", content: "Admin Login - Safar" },
      { property: "og:description", content: "Sign in to access the Safar admin portal." },
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

  // Only auto-redirect already-logged-in users when they were explicitly sent
  // here with a ?redirect= target (e.g. by a protected route). When a user
  // deliberately navigates to /login, show the page so they can switch accounts.
  // Use SPA navigation (not window.location.href) so the in-memory auth session
  // is preserved — a hard reload here can race with auth rehydration and leave
  // the user looping back to /login.
  useEffect(() => {
    if (loading || !user || !profile) return;
    const intended = safeRedirect(search.redirect);
    if (!intended) return; // deliberate visit — render the login page
    // SPA navigation only — never window.location here, it causes a refresh loop
    // by re-mounting AuthContext mid-redirect.
    navigate({ to: intended as "/admin", replace: true });
  }, [loading, user, profile, navigate, search.redirect]);

  const dashboardPath = "/admin";

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setSubmitting(false);

    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Welcome back");
    // Redirect handled by the effect above once profile loads
  };

  return (
      <div className="flex min-h-screen items-center justify-center px-4 py-16">
        <Card className="w-full max-w-md border-border bg-card shadow-lg">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Admin sign in</CardTitle>
            <CardDescription>Sign in to access the admin portal</CardDescription>
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
                    onClick={() => navigate({ to: dashboardPath })}
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
                <Label htmlFor="password">Password</Label>
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
  );
}
