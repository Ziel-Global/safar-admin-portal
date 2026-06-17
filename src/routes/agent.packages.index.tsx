import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Plus, Pencil, Copy, Archive, Trash2, Hotel, Loader2, CalendarDays, BookmarkPlus, FolderOpen, Megaphone } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { fetchActiveCampaignsForPackages, discountLabel, type ActiveCampaignInfo } from "@/lib/campaigns";

export const Route = createFileRoute("/agent/packages/")({
  head: () => ({
    meta: [
      { title: "My Packages - Safar" },
      { name: "description", content: "Manage your Hajj and Umrah packages." },
    ],
  }),
  component: () => (
    <ProtectedRoute requireRole="agent">
      <PackagesPage />
    </ProtectedRoute>
  ),
});

interface PackageRow {
  id: string;
  title: string;
  type: string;
  status: "draft" | "active" | "sold_out" | "archived";
  base_price: number | null;
  currency: string;
  departure_city: string;
  date_start: string | null;
  date_end: string | null;
  hotel_name: string | null;
  thumbnail_url: string | null;
  agent_id: string;
}

const statusVariant: Record<PackageRow["status"], { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-muted text-muted-foreground" },
  active: { label: "Active", className: "bg-primary/15 text-primary" },
  sold_out: { label: "Sold Out", className: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200" },
  archived: { label: "Archived", className: "bg-secondary text-secondary-foreground" },
};

function PackagesPage() {
  const { agent } = useAuth();
  const navigate = useNavigate();
  const [packages, setPackages] = useState<PackageRow[]>([]);
  const [campaignsByPkg, setCampaignsByPkg] = useState<Map<string, ActiveCampaignInfo>>(new Map());
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!agent?.id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("packages")
      .select(
        "id, title, type, status, base_price, currency, departure_city, date_start, date_end, hotel_name, thumbnail_url, agent_id",
      )
      .eq("agent_id", agent.id)
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("Failed to load packages");
    } else {
      const rows = (data ?? []) as PackageRow[];
      setPackages(rows);
      const map = await fetchActiveCampaignsForPackages(rows.map((r) => r.id));
      setCampaignsByPkg(map);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agent?.id]);

  const handleDuplicate = async (pkg: PackageRow) => {
    const { data, error } = await supabase.rpc("duplicate_package", { package_uuid: pkg.id });
    if (error) {
      toast.error("Failed to duplicate: " + error.message);
      return;
    }
    toast.success("Package duplicated as draft");
    if (data) {
      // After RPC, refresh and stay on list (edit page is "coming soon")
      load();
    } else {
      load();
    }
  };

  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateSource, setTemplateSource] = useState<PackageRow | null>(null);

  const openTemplateDialog = (pkg: PackageRow) => {
    setTemplateSource(pkg);
    setTemplateName(pkg.title);
    setTemplateDialogOpen(true);
  };

  const handleSaveTemplate = async () => {
    if (!templateSource || !agent?.id || !templateName.trim()) return;
    const { data: full } = await supabase.from("packages").select("*").eq("id", templateSource.id).single();
    if (!full) {
      toast.error("Failed to load package");
      return;
    }
    const f = full as Record<string, unknown>;
    const template_data = {
      title: f.title,
      type: f.type,
      departure_city: f.departure_city,
      departure_country: f.departure_country,
      base_price: f.base_price,
      currency: f.currency,
      hotel_name: f.hotel_name,
      hotel_stars: f.hotel_stars,
      hotel_zone: f.hotel_zone,
      distance_to_haram_m: f.distance_to_haram_m,
      meals_included: f.meals_included,
      transport_type: f.transport_type,
      visa_included: f.visa_included,
      group_size_min: f.group_size_min,
      group_size_max: f.group_size_max,
      accessibility: f.accessibility,
    };
    const { error } = await supabase.from("package_templates").insert([{
      agent_id: agent.id,
      name: templateName.trim(),
      template_data: template_data as unknown as Record<string, unknown>,
    }] as never);
    if (error) toast.error("Failed to save template: " + error.message);
    else {
      toast.success("Template saved");
      setTemplateDialogOpen(false);
      setTemplateSource(null);
      setTemplateName("");
    }
  };

  const handleArchive = async (pkg: PackageRow) => {
    const { error } = await supabase.from("packages").update({ status: "archived" }).eq("id", pkg.id);
    if (error) toast.error("Failed to archive");
    else {
      toast.success("Package archived");
      load();
    }
  };

  const handleDelete = async (pkg: PackageRow) => {
    const { error } = await supabase.from("packages").delete().eq("id", pkg.id);
    if (error) toast.error("Failed to delete");
    else {
      toast.success("Package deleted");
      load();
    }
  };

  return (
    <DashboardLayout variant="agent" title="My Packages">
      <div className="mx-auto w-full max-w-6xl">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h2 className="text-2xl font-bold tracking-tight text-foreground">My Packages</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Create, edit, and manage every package you offer pilgrims.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" className="flex-1 sm:flex-none" onClick={() => navigate({ to: "/agent/templates" })}>
              <FolderOpen className="mr-1 h-4 w-4" /> Templates
            </Button>
            <Button variant="outline" size="sm" className="flex-1 sm:flex-none" onClick={() => navigate({ to: "/agent/campaigns/new" })}>
              <Megaphone className="mr-1 h-4 w-4" /> New Campaign
            </Button>
            <Button size="sm" className="flex-1 sm:flex-none" onClick={() => navigate({ to: "/agent/packages/new" })}>
              <Plus className="mr-1 h-4 w-4" /> New Package
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex h-48 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : packages.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <Hotel className="h-10 w-10 text-muted-foreground" />
              <div>
                <h3 className="font-semibold text-foreground">No packages yet</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Create your first package to start receiving bookings.
                </p>
              </div>
              <Button onClick={() => navigate({ to: "/agent/packages/new" })}>
                <Plus className="mr-1 h-4 w-4" /> Create Package
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {packages.map((pkg) => {
              const sv = statusVariant[pkg.status];
              const campaign = campaignsByPkg.get(pkg.id);
              return (
                <Card key={pkg.id} className="overflow-hidden border-border">
                  <div className="relative aspect-[4/3] bg-gradient-to-br from-primary/15 via-accent/20 to-primary/10 flex items-center justify-center text-primary/40">
                    <Hotel className="h-12 w-12" />
                    {campaign ? (
                      <div className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-gradient-to-r from-primary to-primary/80 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-primary-foreground shadow-md">
                        <Megaphone className="h-3 w-3" />
                        <span>{discountLabel(campaign)}</span>
                      </div>
                    ) : null}
                  </div>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold leading-tight text-foreground">{pkg.title}</h3>
                      <Badge className={sv.className} variant="outline">
                        {sv.label}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground capitalize">
                      {pkg.type} · {pkg.departure_city}
                    </p>
                    {campaign ? (
                      <p className="mt-1 text-xs font-medium text-primary">
                        Active campaign: {campaign.name}
                      </p>
                    ) : null}
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="text-lg font-bold text-primary">
                      {pkg.currency} {pkg.base_price ?? "-"}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      <Button size="sm" variant="outline" asChild>
                        <Link to="/agent/packages/$id/edit" params={{ id: pkg.id }}>
                          <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
                        </Link>
                      </Button>
                      <Button size="sm" variant="outline" asChild>
                        <Link to="/agent/packages/$id/availability" params={{ id: pkg.id }}>
                          <CalendarDays className="mr-1 h-3.5 w-3.5" /> Availability
                        </Link>
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleDuplicate(pkg)}>
                        <Copy className="mr-1 h-3.5 w-3.5" /> Duplicate
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => openTemplateDialog(pkg)}>
                        <BookmarkPlus className="mr-1 h-3.5 w-3.5" /> Save as Template
                      </Button>
                      {pkg.status !== "archived" && (
                        <Button size="sm" variant="outline" onClick={() => handleArchive(pkg)}>
                          <Archive className="mr-1 h-3.5 w-3.5" /> Archive
                        </Button>
                      )}
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="outline" className="text-destructive">
                            <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete package?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently remove "{pkg.title}". This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(pkg)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        <div className="mt-6 text-sm text-muted-foreground">
          <Link to="/agent/dashboard" className="text-primary hover:underline">
            ← Back to dashboard
          </Link>
        </div>
      </div>

      <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save as Template</DialogTitle>
            <DialogDescription>
              Create a reusable blueprint from this package. Dates, availability, and status will not be saved.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Template name</label>
            <Input
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="e.g. Standard 14-day Umrah package"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTemplateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveTemplate} disabled={!templateName.trim()}>
              Save Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
