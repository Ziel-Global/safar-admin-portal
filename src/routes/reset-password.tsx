import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Reset Password - Safar" },
      { name: "description", content: "Set a new password for your Safar account." },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Supabase fires PASSWORD_RECOVERY event when redirected from the email link
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setReady(true);
      }
    });
    // Also allow resetting if a session already exists
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      toast.error("Passwords don't match");
      return;
    }
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setSubmitting(false);
      toast.error(error.message);
      return;
    }

    // Sign out the recovery session so the user must log in fresh with their
    // new password instead of being silently auto-logged in.
    await supabase.auth.signOut({ scope: "local" }).catch(() => {});
    setSubmitting(false);
    toast.success("Password updated — please sign in with your new password");
    navigate({ to: "/login", replace: true });
  };

  return (
    <PublicLayout showFooter={false} staticHeader>
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-16">
        <Card className="w-full max-w-md border-border bg-card shadow-lg">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Set a new password</CardTitle>
            <CardDescription>
              {ready
                ? "Enter a new password for your account."
                : "Open this page from the password reset email link."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">New password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={8}
                  required
                  disabled={!ready}
                  autoComplete="new-password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm">Confirm password</Label>
                <Input
                  id="confirm"
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  minLength={8}
                  required
                  disabled={!ready}
                  autoComplete="new-password"
                />
              </div>
              <Button
                type="submit"
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                disabled={submitting || !ready}
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update password"}
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                <Link to="/login" className="font-medium text-primary hover:underline">
                  Back to sign in
                </Link>
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </PublicLayout>
  );
}
