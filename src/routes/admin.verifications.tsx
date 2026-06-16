import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2, ExternalLink, CheckCircle2, XCircle, Building2, BellRing, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { logAdminAction } from "@/lib/admin";
import {
  getBadgeIcon,
  type AgentBadge,
  type BadgeStatus,
  type BadgeType,
} from "@/lib/badges";

export const Route = createFileRoute("/admin/verifications")({
  head: () => ({
    meta: [
      { title: "Verifications - Admin" },
      { name: "description", content: "Review and approve agent credential submissions." },
    ],
  }),
  component: () => (
    <ProtectedRoute requireRole="admin">
      <AdminVerificationsPage />
    </ProtectedRoute>
  ),
});

interface AgentMini {
  id: string;
  business_name: string;
  slug: string | null;
  logo_url: string | null;
}

interface QueueItem extends AgentBadge {
  agent: AgentMini | null;
  type: BadgeType | null;
}

function AdminVerificationsPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<BadgeStatus>("pending");
  const [reviewing, setReviewing] = useState<QueueItem | null>(null);
  const [rejecting, setRejecting] = useState<QueueItem | null>(null);

  const refresh = async () => {
    setLoading(true);
    const [{ data: badges }, { data: types }] = await Promise.all([
      supabase
        .from("agent_badges")
        .select("*")
        .order("created_at", { ascending: false }) as unknown as Promise<{ data: AgentBadge[] | null }>,
      supabase.from("badge_types").select("*") as unknown as Promise<{ data: BadgeType[] | null }>,
    ]);
    const agentIds = Array.from(new Set((badges ?? []).map((b) => b.agent_id)));
    const { data: agents } = agentIds.length
      ? ((await supabase
          .from("agents")
          .select("id, business_name, slug, logo_url")
          .in("id", agentIds)) as unknown as { data: AgentMini[] | null })
      : { data: [] as AgentMini[] };
    const typeMap = new Map((types ?? []).map((t) => [t.id, t]));
    const agentMap = new Map((agents ?? []).map((a) => [a.id, a]));
    setItems(
      (badges ?? []).map((b) => ({
        ...b,
        agent: agentMap.get(b.agent_id) ?? null,
        type: typeMap.get(b.badge_type) ?? null,
      })),
    );
    setLoading(false);
  };

  useEffect(() => {
    refresh();
  }, []);

  const filtered = items.filter((i) => i.status === tab);
  const counts = {
    pending: items.filter((i) => i.status === "pending").length,
    verified: items.filter((i) => i.status === "verified").length,
    rejected: items.filter((i) => i.status === "rejected").length,
    expired: items.filter((i) => i.status === "expired").length,
  };

  return (
    <AdminLayout title="Admin · Verifications">
      <div className="mx-auto w-full max-w-6xl">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Credential review queue</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Approve or reject agent credential submissions. Documents are private.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <RefreshRatesButton />
            <TestPriceAlertButton />
          </div>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as BadgeStatus)}>
          <TabsList>
            <TabsTrigger value="pending">Pending ({counts.pending})</TabsTrigger>
            <TabsTrigger value="verified">Verified ({counts.verified})</TabsTrigger>
            <TabsTrigger value="rejected">Rejected ({counts.rejected})</TabsTrigger>
            <TabsTrigger value="expired">Expired ({counts.expired})</TabsTrigger>
          </TabsList>

          <TabsContent value={tab} className="mt-6">
            {loading ? (
              <div className="grid gap-4 md:grid-cols-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-48 rounded-xl" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <Card className="border-dashed border-border bg-card/50">
                <CardContent className="py-16 text-center text-sm text-muted-foreground">
                  No {tab} submissions.
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {filtered.map((item) => (
                  <QueueCard
                    key={item.id}
                    item={item}
                    onView={() => setReviewing(item)}
                    onApprove={async () => {
                      const { error } = await supabase
                        .from("agent_badges")
                        .update({ status: "verified", rejection_reason: null })
                        .eq("id", item.id);
                      if (error) toast.error(error.message);
                      else {
                        if (user) {
                          await logAdminAction(user.id, "verification.approve", "agent_badge", item.id, {
                            agent_id: item.agent_id,
                            badge_type: item.badge_type,
                          });
                        }
                        toast.success(`${item.type?.name} approved`);
                        refresh();
                      }
                    }}
                    onReject={() => setRejecting(item)}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <ViewDocumentDialog item={reviewing} onClose={() => setReviewing(null)} />
      <RejectDialog
        item={rejecting}
        onClose={() => setRejecting(null)}
        onSubmitted={() => {
          setRejecting(null);
          refresh();
        }}
      />
    </AdminLayout>
  );
}

function QueueCard({
  item,
  onView,
  onApprove,
  onReject,
}: {
  item: QueueItem;
  onView: () => void;
  onApprove: () => void | Promise<void>;
  onReject: () => void;
}) {
  const Icon = item.type ? getBadgeIcon(item.type.icon_name) : Building2;
  const isPending = item.status === "pending";
  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          <span
            className="grid h-12 w-12 shrink-0 place-content-center rounded-xl"
            style={{ backgroundColor: item.type?.color_hex ?? "#64748b" }}
          >
            <Icon className="h-6 w-6 text-white" />
          </span>
          <div className="flex-1">
            <CardTitle className="text-base">{item.type?.name ?? item.badge_type}</CardTitle>
            <CardDescription className="mt-0.5 flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5" />
              {item.agent?.business_name ?? "Unknown agent"}
            </CardDescription>
          </div>
          <Badge variant="secondary" className="text-[11px]">
            {format(new Date(item.created_at), "PP")}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {item.expires_at ? (
          <p className="text-xs text-muted-foreground">
            Expires {format(new Date(item.expires_at), "PP")}
          </p>
        ) : null}
        {item.rejection_reason ? (
          <div className="rounded-md border border-rose-300 bg-rose-50 p-2 text-xs text-rose-900">
            <strong>Rejected:</strong> {item.rejection_reason}
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={onView}>
            <ExternalLink className="h-4 w-4" /> View document
          </Button>
          {isPending ? (
            <>
              <Button size="sm" onClick={onApprove}>
                <CheckCircle2 className="h-4 w-4" /> Approve
              </Button>
              <Button size="sm" variant="destructive" onClick={onReject}>
                <XCircle className="h-4 w-4" /> Reject
              </Button>
            </>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function ViewDocumentDialog({ item, onClose }: { item: QueueItem | null; onClose: () => void }) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!item?.document_url) {
      setSignedUrl(null);
      return;
    }
    setLoading(true);
    supabase.storage
      .from("agent-credentials")
      .createSignedUrl(item.document_url, 60 * 10)
      .then(({ data, error }) => {
        if (error) toast.error(error.message);
        setSignedUrl(data?.signedUrl ?? null);
        setLoading(false);
      });
  }, [item]);

  if (!item) return null;
  const isPdf = item.document_url?.toLowerCase().endsWith(".pdf");

  return (
    <Dialog open={!!item} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{item.type?.name}</DialogTitle>
          <DialogDescription>
            Submitted by {item.agent?.business_name} on {format(new Date(item.created_at), "PPp")}
          </DialogDescription>
        </DialogHeader>
        <div className="aspect-[4/3] w-full overflow-hidden rounded-lg border border-border bg-secondary/40">
          {loading ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : signedUrl ? (
            isPdf ? (
              <iframe src={signedUrl} className="h-full w-full" title="Document" />
            ) : (
              <img src={signedUrl} alt="Credential document" className="h-full w-full object-contain" />
            )
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Document unavailable
            </div>
          )}
        </div>
        <DialogFooter>
          {signedUrl ? (
            <Button asChild variant="outline">
              <a href={signedUrl} target="_blank" rel="noreferrer">
                Open in new tab <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RejectDialog({
  item,
  onClose,
  onSubmitted,
}: {
  item: QueueItem | null;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const { user } = useAuth();
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setReason("");
  }, [item]);

  if (!item) return null;
  const submit = async () => {
    if (reason.trim().length < 5) {
      toast.error("Please provide a reason (min 5 characters)");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase
      .from("agent_badges")
      .update({ status: "rejected", rejection_reason: reason.trim() })
      .eq("id", item.id);
    setSubmitting(false);
    if (error) toast.error(error.message);
    else {
      if (user) {
        await logAdminAction(user.id, "verification.reject", "agent_badge", item.id, {
          agent_id: item.agent_id,
          badge_type: item.badge_type,
          reason: reason.trim(),
        });
      }
      toast.success("Badge rejected");
      onSubmitted();
    }
  };

  return (
    <Dialog open={!!item} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reject {item.type?.name}</DialogTitle>
          <DialogDescription>
            The agent will see this reason and can resubmit.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          rows={4}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Document is illegible. Please upload a higher-resolution scan."
        />
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={submit} disabled={submitting}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Confirm rejection
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TestPriceAlertButton() {
  const [running, setRunning] = useState(false);
  const handle = async () => {
    setRunning(true);
    const { data, error } = await supabase.functions.invoke("check-price-alerts");
    setRunning(false);
    if (error) {
      toast.error(`Failed: ${error.message}`);
      return;
    }
    const triggered = (data as { triggered?: number } | null)?.triggered ?? 0;
    const scanned = (data as { scanned?: number } | null)?.scanned ?? 0;
    toast.success(`Scanned ${scanned} alert(s) · triggered ${triggered}`);
  };
  return (
    <Button onClick={handle} disabled={running} variant="outline">
      {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellRing className="h-4 w-4" />}
      Test Alert Check
    </Button>
  );
}

function RefreshRatesButton() {
  const [running, setRunning] = useState(false);
  const handle = async () => {
    setRunning(true);
    const { data, error } = await supabase.functions.invoke("fetch-exchange-rates");
    setRunning(false);
    if (error) {
      toast.error(`Failed: ${error.message}`);
      return;
    }
    const payload = data as { ok?: boolean; source?: string; count?: number } | null;
    if (payload?.ok) {
      toast.success(`Refreshed ${payload.count ?? 0} rate(s) from ${payload.source ?? "API"}`);
    } else {
      toast.error("Failed to refresh rates");
    }
  };
  return (
    <Button onClick={handle} disabled={running} variant="outline">
      {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
      Refresh Rates
    </Button>
  );
}
