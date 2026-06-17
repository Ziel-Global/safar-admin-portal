import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2, Save, KeyRound, ShieldAlert, Monitor, AlertTriangle } from "lucide-react";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCurrency } from "@/contexts/CurrencyContext";
import { COUNTRY_OPTIONS } from "@/lib/checklist";
import { toast } from "sonner";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Account settings - Safar" },
      { name: "description", content: "Manage your Safar account, security, and preferences." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <ProtectedRoute>
      <SettingsPage />
    </ProtectedRoute>
  ),
});

const LOCALES = [
  { code: "en", name: "English" },
  { code: "ar", name: "Arabic (العربية)" },
  { code: "ur", name: "Urdu (اردو)" },
  { code: "id", name: "Indonesian (Bahasa)" },
  { code: "tr", name: "Turkish (Türkçe)" },
];

function SettingsPage() {
  const { user, profile, signOut, refreshProfile } = useAuth();
  const { currencies, currency, setCurrency } = useCurrency();

  // Profile form state
  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [country, setCountry] = useState(profile?.country_code ?? "");
  const [locale, setLocale] = useState(profile?.preferred_locale ?? "en");
  const [savingProfile, setSavingProfile] = useState(false);
  const [signingOutAll, setSigningOutAll] = useState(false);

  useEffect(() => {
    setFullName(profile?.full_name ?? "");
    setCountry(profile?.country_code ?? "");
    setLocale(profile?.preferred_locale ?? "en");
  }, [profile]);

  // Password change state
  const [pwOpen, setPwOpen] = useState(false);
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwSubmitting, setPwSubmitting] = useState(false);

  // Delete account state
  const [delOpen, setDelOpen] = useState(false);
  const [delConfirm, setDelConfirm] = useState("");
  const [delSubmitting, setDelSubmitting] = useState(false);

  const handleSaveProfile = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSavingProfile(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: fullName.trim() || null,
        country_code: country || null,
        preferred_locale: locale,
      })
      .eq("id", user.id);
    setSavingProfile(false);
    if (error) {
      toast.error("Couldn't save: " + error.message);
      return;
    }
    await refreshProfile();
    toast.success("Profile updated");
  };

  const handleCurrencyChange = async (code: string) => {
    await setCurrency(code);
    toast.success("Preferred currency updated");
  };

  const handlePasswordSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (newPw.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (newPw !== confirmPw) {
      toast.error("Passwords don't match");
      return;
    }
    setPwSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password: newPw });
    setPwSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Password updated");
    setNewPw("");
    setConfirmPw("");
    setPwOpen(false);
  };

  const handleSignOutAll = async () => {
    if (signingOutAll) return;
    setSigningOutAll(true);
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      setSigningOutAll(false);
      toast.error("Please sign in again before signing out all devices.");
      return;
    }

    const response = await fetch("/api/auth/signout-all-devices", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      setSigningOutAll(false);
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      toast.error("Couldn't sign out all devices: " + (body?.error ?? "Please try again."));
      return;
    }

    await signOut({ scope: "local", silent: true });
    toast.success("Signed out of all devices");
    if (typeof window !== "undefined") window.location.href = "/";
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    if (delConfirm !== "DELETE") {
      toast.error('Type "DELETE" to confirm');
      return;
    }
    setDelSubmitting(true);
    const { error } = await supabase
      .from("profiles")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", user.id);
    if (error) {
      setDelSubmitting(false);
      toast.error("Couldn't delete: " + error.message);
      return;
    }
    // Sign out and redirect home
    await signOut({ scope: "global", silent: true });
    toast.success("Your account has been deleted.");
    if (typeof window !== "undefined") window.location.href = "/";
  };

  return (
    <PublicLayout>
      <main className="mx-auto w-full max-w-3xl px-4 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Account settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your profile, security, and account preferences.
          </p>
        </div>

        <div className="space-y-6">
          {/* Profile */}
          <Card>
            <CardHeader>
              <CardTitle>Profile</CardTitle>
              <CardDescription>
                Update how your name and location appear across Safar.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Full name</Label>
                    <Input
                      id="fullName"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      autoComplete="name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={user?.email ?? ""}
                      disabled
                      readOnly
                      className="text-muted-foreground"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="country">Country</Label>
                    <Select value={country} onValueChange={setCountry}>
                      <SelectTrigger id="country">
                        <SelectValue placeholder="Select country" />
                      </SelectTrigger>
                      <SelectContent>
                        {COUNTRY_OPTIONS.map((c) => (
                          <SelectItem key={c.code} value={c.code}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="locale">Preferred language</Label>
                    <Select value={locale} onValueChange={setLocale}>
                      <SelectTrigger id="locale">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {LOCALES.map((l) => (
                          <SelectItem key={l.code} value={l.code}>
                            {l.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="ccy">Preferred currency</Label>
                    <Select value={currency} onValueChange={handleCurrencyChange}>
                      <SelectTrigger id="ccy">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {currencies.map((c) => (
                          <SelectItem key={c.code} value={c.code}>
                            {c.flag_emoji ? `${c.flag_emoji} ` : ""}
                            {c.code} - {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Saves automatically when you change it.
                    </p>
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button type="submit" disabled={savingProfile}>
                    {savingProfile ? (
                      <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-1 h-4 w-4" />
                    )}
                    Save profile
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Security */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <KeyRound className="h-4 w-4" /> Security
              </CardTitle>
              <CardDescription>Manage your password.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" onClick={() => setPwOpen(true)}>
                Change password
              </Button>
            </CardContent>
          </Card>

          {/* Sessions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Monitor className="h-4 w-4" /> Sessions
              </CardTitle>
              <CardDescription>
                Sign out of every browser and device where you're currently signed in.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" onClick={handleSignOutAll} disabled={signingOutAll}>
                {signingOutAll ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
                Sign out of all devices
              </Button>
            </CardContent>
          </Card>

          {/* Danger zone */}
          <Card className="border-destructive/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <ShieldAlert className="h-4 w-4" /> Danger zone
              </CardTitle>
              <CardDescription>
                Permanently delete your account and associated data. This cannot be undone.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="destructive" onClick={() => setDelOpen(true)}>
                Delete account
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Change password dialog */}
      <Dialog open={pwOpen} onOpenChange={setPwOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change password</DialogTitle>
            <DialogDescription>
              Enter a new password. You'll stay signed in on this device.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newPw">New password</Label>
              <Input
                id="newPw"
                type="password"
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                placeholder="At least 8 characters"
                minLength={8}
                required
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPw">Confirm password</Label>
              <Input
                id="confirmPw"
                type="password"
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                minLength={8}
                required
                autoComplete="new-password"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setPwOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={pwSubmitting}>
                {pwSubmitting ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
                Update password
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete account dialog */}
      <Dialog open={delOpen} onOpenChange={setDelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" /> Delete your account?
            </DialogTitle>
            <DialogDescription>
              This will permanently delete your account and all associated data. This cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="del">
              Type <span className="font-mono font-semibold">DELETE</span> to confirm
            </Label>
            <Input
              id="del"
              value={delConfirm}
              onChange={(e) => setDelConfirm(e.target.value)}
              placeholder="DELETE"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDelOpen(false)} disabled={delSubmitting}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteAccount}
              disabled={delSubmitting || delConfirm !== "DELETE"}
            >
              {delSubmitting ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
              Permanently delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PublicLayout>
  );
}
