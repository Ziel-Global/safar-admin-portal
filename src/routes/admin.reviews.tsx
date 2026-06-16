import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2, CheckCircle2, XCircle, Flag, Star } from "lucide-react";
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

export const Route = createFileRoute("/admin/reviews")({
  head: () => ({
    meta: [
      { title: "Review Moderation - Admin" },
      { name: "description", content: "Approve, reject or flag pending pilgrim reviews." },
    ],
  }),
  component: () => (
    <ProtectedRoute requireRole="admin">
      <AdminReviewsPage />
    </ProtectedRoute>
  ),
});

type ModStatus = "pending" | "approved" | "rejected" | "flagged";

interface ReviewItem {
  id: string;
  agent_id: string;
  pilgrim_id: string;
  overall_rating: number;
  review_text: string | null;
  moderation_status: ModStatus;
  moderation_note: string | null;
  created_at: string;
  agent_name?: string | null;
  pilgrim_name?: string | null;
}

function AdminReviewsPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<ModStatus>("pending");
  const [rejecting, setRejecting] = useState<ReviewItem | null>(null);

  const refresh = async () => {
    setLoading(true);
    const { data: reviews } = await supabase
      .from("reviews")
      .select("id, agent_id, pilgrim_id, overall_rating, review_text, moderation_status, moderation_note, created_at")
      .order("created_at", { ascending: false });
    const list = (reviews ?? []) as ReviewItem[];
    const agentIds = Array.from(new Set(list.map((r) => r.agent_id)));
    const pilgrimIds = Array.from(new Set(list.map((r) => r.pilgrim_id)));
    const [{ data: agents }, { data: pilgrims }] = await Promise.all([
      agentIds.length
        ? supabase.from("agents").select("id, business_name").in("id", agentIds)
        : Promise.resolve({ data: [] as { id: string; business_name: string }[] }),
      pilgrimIds.length
        ? supabase.from("profiles").select("id, full_name").in("id", pilgrimIds)
        : Promise.resolve({ data: [] as { id: string; full_name: string | null }[] }),
    ]);
    const aMap = new Map((agents ?? []).map((a) => [a.id, a.business_name]));
    const pMap = new Map((pilgrims ?? []).map((p) => [p.id, p.full_name]));
    setItems(
      list.map((r) => ({
        ...r,
        agent_name: aMap.get(r.agent_id) ?? "Unknown agent",
        pilgrim_name: pMap.get(r.pilgrim_id) ?? "Anonymous",
      })),
    );
    setLoading(false);
  };

  useEffect(() => {
    refresh();
  }, []);

  const filtered = items.filter((r) => r.moderation_status === tab);
  const counts = {
    pending: items.filter((r) => r.moderation_status === "pending").length,
    approved: items.filter((r) => r.moderation_status === "approved").length,
    rejected: items.filter((r) => r.moderation_status === "rejected").length,
    flagged: items.filter((r) => r.moderation_status === "flagged").length,
  };

  const updateStatus = async (review: ReviewItem, status: ModStatus, note?: string) => {
    const { error } = await supabase
      .from("reviews")
      .update({ moderation_status: status, moderation_note: note ?? null })
      .eq("id", review.id);
    if (error) {
      toast.error(error.message);
      return false;
    }
    if (user) {
      await logAdminAction(
        user.id,
        status === "approved" ? "review.approve" : status === "rejected" ? "review.reject" : "review.flag",
        "review",
        review.id,
        { agent_id: review.agent_id, note },
      );
    }
    toast.success(`Review ${status}`);
    await refresh();
    return true;
  };

  return (
    <AdminLayout title="Admin · Review moderation">
      <div className="mx-auto w-full max-w-6xl">
        <div className="mb-6">
          <h2 className="text-2xl font-bold tracking-tight">Review moderation queue</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Approve genuine reviews, reject spam or abusive content, flag for further investigation.
          </p>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as ModStatus)}>
          <TabsList>
            <TabsTrigger value="pending">Pending ({counts.pending})</TabsTrigger>
            <TabsTrigger value="approved">Approved ({counts.approved})</TabsTrigger>
            <TabsTrigger value="rejected">Rejected ({counts.rejected})</TabsTrigger>
            <TabsTrigger value="flagged">Flagged ({counts.flagged})</TabsTrigger>
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
                  No {tab} reviews.
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {filtered.map((review) => (
                  <Card key={review.id}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <CardTitle className="text-base">{review.pilgrim_name}</CardTitle>
                          <CardDescription className="mt-0.5">
                            on <span className="font-medium">{review.agent_name}</span> ·{" "}
                            {format(new Date(review.created_at), "PP")}
                          </CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1 rounded-md bg-secondary px-2 py-1 text-sm font-semibold">
                            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-500" />
                            {review.overall_rating}
                          </div>
                          <Badge variant="outline" className="text-[11px] capitalize">
                            {review.moderation_status}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="rounded-md border border-border bg-secondary/30 p-3 text-sm leading-relaxed text-foreground">
                        {review.review_text || <span className="italic text-muted-foreground">No written review</span>}
                      </p>
                      {review.moderation_note ? (
                        <div className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">
                          <strong>Note:</strong> {review.moderation_note}
                        </div>
                      ) : null}
                      {review.moderation_status !== "approved" && (
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" onClick={() => updateStatus(review, "approved")}>
                            <CheckCircle2 className="h-4 w-4" /> Approve
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => setRejecting(review)}>
                            <XCircle className="h-4 w-4" /> Reject
                          </Button>
                          {review.moderation_status !== "flagged" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateStatus(review, "flagged", "Flagged for further review")}
                            >
                              <Flag className="h-4 w-4" /> Flag
                            </Button>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <RejectDialog
        review={rejecting}
        onClose={() => setRejecting(null)}
        onSubmit={async (reason) => {
          if (!rejecting) return;
          const ok = await updateStatus(rejecting, "rejected", reason);
          if (ok) setRejecting(null);
        }}
      />
    </AdminLayout>
  );
}

function RejectDialog({
  review,
  onClose,
  onSubmit,
}: {
  review: ReviewItem | null;
  onClose: () => void;
  onSubmit: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setReason("");
  }, [review]);

  if (!review) return null;
  const submit = async () => {
    if (reason.trim().length < 5) {
      toast.error("Please provide a reason (min 5 characters)");
      return;
    }
    setSubmitting(true);
    await onSubmit(reason.trim());
    setSubmitting(false);
  };

  return (
    <Dialog open={!!review} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reject review</DialogTitle>
          <DialogDescription>
            The reason is logged and visible only to admins.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          rows={4}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Contains personal attack against agent staff."
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
