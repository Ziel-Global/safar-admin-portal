import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, FolderOpen, Loader2, Plus, Sparkles, Trash2 } from "lucide-react";
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
import { toast } from "sonner";

export const Route = createFileRoute("/agent/templates")({
  head: () => ({
    meta: [
      { title: "Package Templates - Safar" },
      { name: "description", content: "Reusable templates for your packages." },
    ],
  }),
  component: () => (
    <ProtectedRoute requireRole="agent">
      <TemplatesPage />
    </ProtectedRoute>
  ),
});

interface Template {
  id: string;
  name: string;
  template_data: Record<string, unknown>;
  usage_count: number;
  created_at: string;
}

function TemplatesPage() {
  const { agent } = useAuth();
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [usingId, setUsingId] = useState<string | null>(null);

  const load = async () => {
    if (!agent?.id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("package_templates")
      .select("id, name, template_data, usage_count, created_at")
      .eq("agent_id", agent.id)
      .order("created_at", { ascending: false });
    if (error) toast.error("Failed to load templates");
    else setTemplates((data ?? []) as unknown as Template[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agent?.id]);

  const handleUse = async (tpl: Template) => {
    setUsingId(tpl.id);
    const { data, error } = await supabase.rpc("create_package_from_template", {
      template_uuid: tpl.id,
    });
    setUsingId(null);
    if (error) {
      toast.error("Failed to create package: " + error.message);
      return;
    }
    toast.success(`Created draft package from "${tpl.name}"`);
    void data;
    navigate({ to: "/agent/packages" });
  };

  const handleDelete = async (tpl: Template) => {
    const { error } = await supabase.from("package_templates").delete().eq("id", tpl.id);
    if (error) toast.error("Failed to delete template");
    else {
      toast.success("Template deleted");
      load();
    }
  };

  return (
    <DashboardLayout variant="agent" title="Templates">
      <div className="mx-auto w-full max-w-6xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Package Templates</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Save reusable blueprints from your packages and spin up new drafts in seconds.
            </p>
          </div>
          <Button variant="outline" asChild>
            <Link to="/agent/packages">
              <ArrowLeft className="mr-1 h-4 w-4" /> Back to Packages
            </Link>
          </Button>
        </div>

        {loading ? (
          <div className="flex h-48 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : templates.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <FolderOpen className="h-10 w-10 text-muted-foreground" />
              <div>
                <h3 className="font-semibold text-foreground">No templates yet</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Open any package and click "Save as Template" to create your first.
                </p>
              </div>
              <Button asChild>
                <Link to="/agent/packages">
                  <Plus className="mr-1 h-4 w-4" /> View Packages
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {templates.map((tpl) => {
              const data = tpl.template_data as Record<string, unknown>;
              const type = (data.type as string) ?? "-";
              const city = (data.departure_city as string) ?? "-";
              const price = data.base_price as number | null | undefined;
              const currency = (data.currency as string) ?? "GBP";
              return (
                <Card key={tpl.id} className="overflow-hidden border-border">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold leading-tight text-foreground">{tpl.name}</h3>
                      <Badge variant="outline" className="bg-primary/10 text-primary">
                        {tpl.usage_count} uses
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground capitalize">
                      {type} · {city}
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="text-lg font-bold text-primary">
                      {price != null ? `${currency} ${price}` : "-"}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      <Button size="sm" onClick={() => handleUse(tpl)} disabled={usingId === tpl.id}>
                        {usingId === tpl.id ? (
                          <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Sparkles className="mr-1 h-3.5 w-3.5" />
                        )}
                        Use Template
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="outline" className="text-destructive">
                            <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete template?</AlertDialogTitle>
                            <AlertDialogDescription>
                              "{tpl.name}" will be permanently removed.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(tpl)}
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
      </div>
    </DashboardLayout>
  );
}
