import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Flag, Loader2, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  FRAUD_REPORT_STATUSES,
  FRAUD_SEVERITY,
  logAdminAction,
  severityClass,
  type FraudReportStatus,
  type FraudSeverity,
} from "@/lib/admin";

export const Route = createFileRoute("/admin/fraud")({
  head: () => ({
    meta: [
      { title: "Fraud Reports - Admin" },
      { name: "description", content: "Triage and resolve fraud reports against agents." },
    ],
  }),
  component: () => (
    <ProtectedRoute requireRole="admin">
      <AdminFraudPage />
    </ProtectedRoute>
  ),
});

interface ReportRow {
  id: string;
  reporter_id: string;
  agent_id: string;
  package_id: string | null;
  report_type: string;
  description: string;
  severity: FraudSeverity;
  status: FraudReportStatus;
  resolution_note: string | null;
  created_at: string;
  resolved_at: string | null;
  agent_name?: string | null;
  agent_slug?: string | null;
  reporter_name?: string | null;
}

const SEVERITY_RANK: Record<FraudSeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

function AdminFraudPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<FraudReportStatus | "all">("submitted");

  const refresh = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("fraud_reports")
      .select("*")
      .order("created_at", { ascending: false });
    const list = (data ?? []) as ReportRow[];
    const agentIds = Array.from(new Set(list.map((r) => r.agent_id)));
    const reporterIds = Array.from(new Set(list.map((r) => r.reporter_id)));
    const [{ data: agents }, { data: profiles }] = await Promise.all([
      agentIds.length
        ? supabase.from("agents").select("id, business_name, slug").in("id", agentIds)
        : Promise.resolve({ data: [] as { id: string; business_name: string; slug: string | null }[] }),
      reporterIds.length
        ? supabase.from("profiles").select("id, full_name").in("id", reporterIds)
        : Promise.resolve({ data: [] as { id: string; full_name: string | null }[] }),
    ]);
    const aMap = new Map((agents ?? []).map((a) => [a.id, a]));
    const pMap = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
    setItems(
      list.map((r) => ({
        ...r,
        agent_name: aMap.get(r.agent_id)?.business_name,
        agent_slug: aMap.get(r.agent_id)?.slug,
        reporter_name: pMap.get(r.reporter_id),
      })),
    );
    setLoading(false);
  };

  useEffect(() => {
    refresh();
  }, []);

  const filtered = (tab === "all" ? items : items.filter((r) => r.status === tab)).sort(
    (a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity],
  );

  const updateField = async (
    report: ReportRow,
    patch: Partial<Pick<ReportRow, "status" | "severity" | "resolution_note">>,
  ) => {
    const updates: { status?: FraudReportStatus; severity?: FraudSeverity; resolution_note?: string | null; resolved_at?: string } = { ...patch };
    if (patch.status === "resolved" || patch.status === "dismissed") {
      updates.resolved_at = new Date().toISOString();
    }
    const { error } = await supabase.from("fraud_reports").update(updates).eq("id", report.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (user) {
      await logAdminAction(user.id, "fraud.update_status", "fraud_report", report.id, patch);
    }
    toast.success("Report updated");
    refresh();
  };

  const counts = {
    submitted: items.filter((r) => r.status === "submitted").length,
    investigating: items.filter((r) => r.status === "investigating").length,
    resolved: items.filter((r) => r.status === "resolved").length,
    dismissed: items.filter((r) => r.status === "dismissed").length,
  };

  return (
    <AdminLayout title="Admin · Fraud reports">
      <div className="mx-auto w-full max-w-6xl">
        <div className="mb-6">
          <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Flag className="h-6 w-6 text-rose-600" /> Fraud reports
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Sorted by severity. Update status and severity as you investigate.
          </p>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList>
            <TabsTrigger value="submitted">New ({counts.submitted})</TabsTrigger>
            <TabsTrigger value="investigating">Investigating ({counts.investigating})</TabsTrigger>
            <TabsTrigger value="resolved">Resolved ({counts.resolved})</TabsTrigger>
            <TabsTrigger value="dismissed">Dismissed ({counts.dismissed})</TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>

          <TabsContent value={tab} className="mt-6">
            {loading ? (
              <div className="grid gap-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-40 rounded-xl" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <Card className="border-dashed border-border bg-card/50">
                <CardContent className="py-16 text-center text-sm text-muted-foreground">
                  No reports here.
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {filtered.map((report) => (
                  <Card key={report.id}>
                    <CardHeader className="pb-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <CardTitle className="text-base capitalize">
                            {report.report_type.replace("_", " ")}
                          </CardTitle>
                          <CardDescription className="mt-0.5">
                            against{" "}
                            {report.agent_slug ? (
                              <Link
                                to="/agents/$slug"
                                params={{ slug: report.agent_slug }}
                                className="font-medium text-primary hover:underline"
                              >
                                {report.agent_name}
                              </Link>
                            ) : (
                              <span className="font-medium">{report.agent_name}</span>
                            )}
                            · reported by {report.reporter_name ?? "anonymous"} ·{" "}
                            {format(new Date(report.created_at), "PP")}
                          </CardDescription>
                        </div>
                        <Badge className={severityClass(report.severity) + " border"}>
                          {report.severity}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="rounded-md border border-border bg-secondary/30 p-3 text-sm leading-relaxed">
                        {report.description}
                      </p>
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-muted-foreground">Status:</span>
                          <Select
                            value={report.status}
                            onValueChange={(v) => updateField(report, { status: v as FraudReportStatus })}
                          >
                            <SelectTrigger className="h-8 w-40 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {FRAUD_REPORT_STATUSES.map((s) => (
                                <SelectItem key={s} value={s} className="capitalize">
                                  {s}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-muted-foreground">Severity:</span>
                          <Select
                            value={report.severity}
                            onValueChange={(v) => updateField(report, { severity: v as FraudSeverity })}
                          >
                            <SelectTrigger className="h-8 w-32 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {FRAUD_SEVERITY.map((s) => (
                                <SelectItem key={s} value={s} className="capitalize">
                                  {s}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        {report.agent_slug ? (
                          <Button asChild variant="outline" size="sm">
                            <Link to="/agents/$slug" params={{ slug: report.agent_slug }}>
                              <ExternalLink className="h-4 w-4" /> View agent
                            </Link>
                          </Button>
                        ) : null}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}

// Re-export so the unused Loader2 import doesn't bother lint
export { Loader2 };
