import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { format } from "date-fns";
import { Loader2, RefreshCw, UserPlus, XCircle } from "lucide-react";
import { toast } from "sonner";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import {
  approveAgentAccessRequest,
  filterAccessRequests,
  rejectAgentAccessRequest,
  statusBadgeClass,
  statusLabel,
  type AccessRequestFilter,
  type AgentAccessRequest,
} from "@/lib/agent-access";

export const Route = createFileRoute("/admin/agents/access-requests")({
  head: () => ({
    meta: [
      { title: "Agent Access Requests - Admin" },
      { name: "description", content: "Review and approve agent portal access requests." },
    ],
  }),
  component: () => (
    <ProtectedRoute requireRole="admin">
      <AdminAgentAccessRequestsPage />
    </ProtectedRoute>
  ),
});

function AdminAgentAccessRequestsPage() {
  const [rows, setRows] = useState<AgentAccessRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<AccessRequestFilter>("pending");
  const [rejecting, setRejecting] = useState<AgentAccessRequest | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("agent_access_requests")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error(error.message);
      setRows([]);
    } else {
      setRows((data ?? []) as AgentAccessRequest[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    refresh();
  }, []);

  const filtered = useMemo(() => filterAccessRequests(rows, filter), [rows, filter]);

  const counts = useMemo(
    () => ({
      all: rows.length,
      pending: rows.filter((r) => r.status === "pending").length,
      invited: rows.filter((r) => r.status === "invited").length,
      approved: rows.filter((r) => r.status === "completed").length,
      rejected: rows.filter((r) => r.status === "rejected").length,
    }),
    [rows],
  );

  const handleApprove = async (row: AgentAccessRequest) => {
    setApprovingId(row.id);
    try {
      await approveAgentAccessRequest(row.id);
      toast.success(`Invite sent to ${row.email}`);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to approve request");
    } finally {
      setApprovingId(null);
    }
  };

  return (
    <AdminLayout title="Admin · Agent access requests">
      <div className="mx-auto w-full max-w-7xl space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <Link to="/admin/agents" className="hover:text-primary">
                Agents
              </Link>
              <span>/</span>
              <span>Access requests</span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight">Agent access requests</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Agents apply on the agents portal. Approve to send an invite email; reject to decline.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Refresh
          </Button>
        </div>

        <Tabs value={filter} onValueChange={(v) => setFilter(v as AccessRequestFilter)}>
          <TabsList className="flex h-auto flex-wrap gap-1">
            <TabsTrigger value="all">All ({counts.all})</TabsTrigger>
            <TabsTrigger value="pending">Pending ({counts.pending})</TabsTrigger>
            <TabsTrigger value="invited">Invited ({counts.invited})</TabsTrigger>
            <TabsTrigger value="approved">Approved ({counts.approved})</TabsTrigger>
            <TabsTrigger value="rejected">Rejected ({counts.rejected})</TabsTrigger>
          </TabsList>

          <TabsContent value={filter} className="mt-6">
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full rounded-lg" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
                No requests in this filter.
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-border bg-card">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Full name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Business name</TableHead>
                      <TableHead>City, country</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Submitted</TableHead>
                      <TableHead>Rejection reason</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="font-medium">{row.full_name}</TableCell>
                        <TableCell className="text-muted-foreground">{row.email}</TableCell>
                        <TableCell>{row.business_name}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {[row.city, row.country_code].filter(Boolean).join(", ") || "—"}
                        </TableCell>
                        <TableCell>
                          <Badge className={`border text-[11px] ${statusBadgeClass(row.status)}`}>
                            {statusLabel(row.status)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(row.created_at), "PP")}
                        </TableCell>
                        <TableCell className="max-w-[200px] text-xs text-muted-foreground">
                          {row.rejection_reason ?? "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          {row.status === "pending" ? (
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                onClick={() => handleApprove(row)}
                                disabled={approvingId === row.id}
                              >
                                {approvingId === row.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <UserPlus className="h-4 w-4" />
                                )}
                                Approve & invite
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => setRejecting(row)}
                              >
                                <XCircle className="h-4 w-4" />
                                Reject
                              </Button>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <RejectDialog
        row={rejecting}
        onClose={() => setRejecting(null)}
        onSubmitted={() => {
          setRejecting(null);
          refresh();
        }}
      />
    </AdminLayout>
  );
}

function RejectDialog({
  row,
  onClose,
  onSubmitted,
}: {
  row: AgentAccessRequest | null;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setReason("");
  }, [row]);

  if (!row) return null;

  const submit = async () => {
    setSubmitting(true);
    try {
      await rejectAgentAccessRequest(row.id, reason.trim() || undefined);
      toast.success("Request rejected");
      onSubmitted();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reject request");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={!!row} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reject access request</DialogTitle>
          <DialogDescription>
            Reject {row.full_name} ({row.email}). You can optionally include a reason.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          rows={4}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Optional reason for rejection…"
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
