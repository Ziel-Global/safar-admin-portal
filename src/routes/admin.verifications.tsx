import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Loader2,
  ExternalLink,
  CheckCircle2,
  XCircle,
  BellRing,
  RefreshCw,
  FileX2,
  FileCheck2,
  ChevronRight,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
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

type AgentFilter = "all" | "pending" | "incomplete";

interface AgentMini {
  id: string;
  business_name: string;
  slug: string | null;
  logo_url: string | null;
  country_code: string | null;
  verification_level: string;
}

type BadgeSubmission = AgentBadge & { type: BadgeType };

interface AgentVerificationRow {
  agent: AgentMini;
  uploaded: BadgeSubmission[];
  missing: BadgeType[];
  pendingCount: number;
  verifiedCount: number;
}

const STATUS_LABEL: Record<BadgeStatus, string> = {
  pending: "Pending review",
  verified: "Verified",
  rejected: "Rejected",
  expired: "Expired",
};

const STATUS_CLASS: Record<BadgeStatus, string> = {
  pending: "bg-amber-100 text-amber-900 border-amber-300",
  verified: "bg-emerald-100 text-emerald-900 border-emerald-300",
  rejected: "bg-rose-100 text-rose-900 border-rose-300",
  expired: "bg-slate-100 text-slate-700 border-slate-300",
};

const VERIFICATION_MODAL_CLASS =
  "flex max-h-[min(92dvh,100vh-1rem)] w-[calc(100vw-1.5rem)] flex-col gap-4 overflow-hidden p-4 sm:max-w-2xl sm:p-6";

const DOCUMENT_MODAL_CLASS =
  "flex max-h-[min(92dvh,100vh-1rem)] w-[calc(100vw-1.5rem)] flex-col gap-4 overflow-hidden p-4 sm:max-w-3xl sm:p-6 lg:max-w-4xl";

const MODAL_FOOTER_CLASS =
  "shrink-0 flex-col gap-2 sm:flex-row sm:justify-end [&>button]:w-full sm:[&>button]:w-auto";

function latestSubmissionPerType(
  badges: AgentBadge[],
  types: BadgeType[],
): { uploaded: BadgeSubmission[]; missing: BadgeType[] } {
  const byType = new Map<string, AgentBadge>();

  for (const badge of badges) {
    const existing = byType.get(badge.badge_type);
    if (!existing || new Date(badge.created_at) > new Date(existing.created_at)) {
      byType.set(badge.badge_type, badge);
    }
  }

  const uploaded: BadgeSubmission[] = [];
  const missing: BadgeType[] = [];

  for (const type of types) {
    const badge = byType.get(type.id);
    if (badge) {
      uploaded.push({ ...badge, type });
    } else {
      missing.push(type);
    }
  }

  return { uploaded, missing };
}

function CountBadge({
  value,
  variant = "default",
}: {
  value: number;
  variant?: "default" | "missing" | "pending" | "verified";
}) {
  const active =
    variant === "missing"
      ? value > 0
        ? "border-amber-300 bg-amber-50 text-amber-900"
        : "border-border bg-muted/40 text-muted-foreground"
      : variant === "pending"
        ? value > 0
          ? STATUS_CLASS.pending
          : "border-border bg-muted/40 text-muted-foreground"
        : variant === "verified"
          ? value > 0
            ? "border-emerald-300 bg-emerald-50 text-emerald-900"
            : "border-border bg-muted/40 text-muted-foreground"
          : "border-border bg-muted/40 text-muted-foreground";

  return (
    <span
      className={`inline-flex min-w-[2rem] items-center justify-center rounded-full border px-2.5 py-0.5 text-xs font-medium tabular-nums ${active}`}
    >
      {value}
    </span>
  );
}

function AdminVerificationsPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<AgentVerificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<AgentFilter>("all");
  const [selected, setSelected] = useState<AgentVerificationRow | null>(null);
  const [reviewing, setReviewing] = useState<BadgeSubmission | null>(null);
  const [rejecting, setRejecting] = useState<BadgeSubmission | null>(null);

  const refresh = async (): Promise<AgentVerificationRow[]> => {
    setLoading(true);
    const [{ data: agents }, { data: badges }, { data: types }] = await Promise.all([
      supabase
        .from("agents")
        .select("id, business_name, slug, logo_url, country_code, verification_level")
        .order("business_name") as unknown as Promise<{ data: AgentMini[] | null }>,
      supabase
        .from("agent_badges")
        .select("*")
        .order("created_at", { ascending: false }) as unknown as Promise<{ data: AgentBadge[] | null }>,
      supabase.from("badge_types").select("*").order("name") as unknown as Promise<{
        data: BadgeType[] | null;
      }>,
    ]);

    const badgeTypes = types ?? [];
    const badgesByAgent = new Map<string, AgentBadge[]>();
    for (const badge of badges ?? []) {
      const list = badgesByAgent.get(badge.agent_id) ?? [];
      list.push(badge);
      badgesByAgent.set(badge.agent_id, list);
    }

    const nextRows: AgentVerificationRow[] = (agents ?? []).map((agent) => {
      const agentBadges = badgesByAgent.get(agent.id) ?? [];
      const { uploaded, missing } = latestSubmissionPerType(agentBadges, badgeTypes);
      return {
        agent,
        uploaded,
        missing,
        pendingCount: uploaded.filter((u) => u.status === "pending").length,
        verifiedCount: uploaded.filter((u) => u.status === "verified").length,
      };
    });

    setRows(nextRows);
    setLoading(false);
    return nextRows;
  };

  useEffect(() => {
    refresh();
  }, []);

  const filtered = useMemo(() => {
    switch (filter) {
      case "pending":
        return rows.filter((r) => r.pendingCount > 0);
      case "incomplete":
        return rows.filter((r) => r.missing.length > 0);
      default:
        return rows;
    }
  }, [rows, filter]);

  const counts = useMemo(
    () => ({
      all: rows.length,
      pending: rows.filter((r) => r.pendingCount > 0).length,
      incomplete: rows.filter((r) => r.missing.length > 0).length,
    }),
    [rows],
  );

  const handleApprove = async (submission: BadgeSubmission) => {
    const { error } = await supabase
      .from("agent_badges")
      .update({ status: "verified", rejection_reason: null })
      .eq("id", submission.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (user) {
      await logAdminAction(user.id, "verification.approve", "agent_badge", submission.id, {
        agent_id: submission.agent_id,
        badge_type: submission.badge_type,
      });
    }
    toast.success(`${submission.type.name} approved`);
    const nextRows = await refresh();
    setSelected((prev) => {
      if (!prev) return null;
      return nextRows.find((r) => r.agent.id === prev.agent.id) ?? null;
    });
  };

  return (
    <AdminLayout title="Admin · Verifications">
      <div className="mx-auto w-full max-w-7xl">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Credential review queue</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Select an agent to review uploaded documents and see what is still missing.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Refresh
            </Button>
            <RefreshRatesButton />
            <TestPriceAlertButton />
          </div>
        </div>

        <Tabs value={filter} onValueChange={(v) => setFilter(v as AgentFilter)}>
          <TabsList>
            <TabsTrigger value="all">All agents ({counts.all})</TabsTrigger>
            <TabsTrigger value="pending">Pending review ({counts.pending})</TabsTrigger>
            <TabsTrigger value="incomplete">Incomplete ({counts.incomplete})</TabsTrigger>
          </TabsList>

          <TabsContent value={filter} className="mt-6">
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full rounded-lg" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <Card className="border-dashed border-border bg-card/50">
                <CardContent className="py-16 text-center text-sm text-muted-foreground">
                  No agents match this filter.
                </CardContent>
              </Card>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-border bg-card">
                <Table className="min-w-[640px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Agent</TableHead>
                      <TableHead>Country</TableHead>
                      <TableHead className="text-center">Uploaded</TableHead>
                      <TableHead className="text-center">Missing</TableHead>
                      <TableHead className="text-center">Pending</TableHead>
                      <TableHead className="text-center">Verified</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((row) => (
                      <TableRow
                        key={row.agent.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => setSelected(row)}
                      >
                        <TableCell className="font-medium">{row.agent.business_name}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {row.agent.country_code ?? "—"}
                        </TableCell>
                        <TableCell className="text-center">
                          <CountBadge value={row.uploaded.length} />
                        </TableCell>
                        <TableCell className="text-center">
                          <CountBadge value={row.missing.length} variant="missing" />
                        </TableCell>
                        <TableCell className="text-center">
                          <CountBadge value={row.pendingCount} variant="pending" />
                        </TableCell>
                        <TableCell className="text-center">
                          <CountBadge value={row.verifiedCount} variant="verified" />
                        </TableCell>
                        <TableCell>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
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

      <AgentDocumentsDialog
        row={selected}
        onClose={() => setSelected(null)}
        onView={(submission) => setReviewing(submission)}
        onApprove={(submission) => handleApprove(submission)}
        onReject={setRejecting}
      />

      <ViewDocumentDialog
        submission={reviewing}
        agent={selected?.agent ?? null}
        onClose={() => setReviewing(null)}
      />

      <RejectDialog
        submission={rejecting}
        onClose={() => setRejecting(null)}
        onSubmitted={async () => {
          setRejecting(null);
          const nextRows = await refresh();
          setSelected((prev) => {
            if (!prev) return null;
            return nextRows.find((r) => r.agent.id === prev.agent.id) ?? null;
          });
        }}
      />
    </AdminLayout>
  );
}

function AgentDocumentsDialog({
  row,
  onClose,
  onView,
  onApprove,
  onReject,
}: {
  row: AgentVerificationRow | null;
  onClose: () => void;
  onView: (submission: BadgeSubmission) => void;
  onApprove: (submission: BadgeSubmission) => void | Promise<void>;
  onReject: (submission: BadgeSubmission) => void;
}) {
  if (!row) return null;

  return (
    <Dialog open={!!row} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className={`${VERIFICATION_MODAL_CLASS} overflow-y-auto`}>
        <DialogHeader className="shrink-0 pr-8">
          <DialogTitle className="break-words">{row.agent.business_name}</DialogTitle>
          <DialogDescription className="break-words">
            {row.agent.country_code ?? "Country unknown"} · {row.verifiedCount} verified ·{" "}
            {row.uploaded.length} uploaded · {row.missing.length} missing
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto pr-1">
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <FileCheck2 className="h-4 w-4 text-emerald-600" />
            <h3 className="text-sm font-semibold">Uploaded documents</h3>
          </div>
          {row.uploaded.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
              No documents uploaded yet.
            </p>
          ) : (
            <ul className="divide-y rounded-lg border border-border">
              {row.uploaded.map((submission) => {
                const Icon = getBadgeIcon(submission.type.icon_name);
                const isPending = submission.status === "pending";
                return (
                  <li key={submission.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <span
                        className="grid h-10 w-10 shrink-0 place-content-center rounded-lg"
                        style={{ backgroundColor: submission.type.color_hex }}
                      >
                        <Icon className="h-5 w-5 text-white" />
                      </span>
                      <div className="min-w-0">
                        <p className="font-medium">{submission.type.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Submitted {format(new Date(submission.created_at), "PPp")}
                        </p>
                        {submission.rejection_reason ? (
                          <p className="mt-1 text-xs text-rose-700">{submission.rejection_reason}</p>
                        ) : null}
                        <Badge
                          className={`mt-2 border text-[11px] ${STATUS_CLASS[submission.status]}`}
                        >
                          {STATUS_LABEL[submission.status]}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full sm:w-auto"
                        onClick={() => onView(submission)}
                      >
                        <ExternalLink className="h-4 w-4" /> View
                      </Button>
                      {isPending ? (
                        <>
                          <Button
                            size="sm"
                            className="w-full sm:w-auto"
                            onClick={() => onApprove(submission)}
                          >
                            <CheckCircle2 className="h-4 w-4" /> Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="w-full sm:w-auto"
                            onClick={() => onReject(submission)}
                          >
                            <XCircle className="h-4 w-4" /> Reject
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <FileX2 className="h-4 w-4 text-amber-600" />
            <h3 className="text-sm font-semibold">Still missing</h3>
          </div>
          {row.missing.length === 0 ? (
            <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              All required credential types have been uploaded.
            </p>
          ) : (
            <ul className="divide-y rounded-lg border border-border">
              {row.missing.map((type) => {
                const Icon = getBadgeIcon(type.icon_name);
                return (
                  <li key={type.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <span
                        className="grid h-10 w-10 shrink-0 place-content-center rounded-lg opacity-60"
                        style={{ backgroundColor: type.color_hex }}
                      >
                        <Icon className="h-5 w-5 text-white" />
                      </span>
                      <div className="min-w-0">
                        <p className="font-medium text-muted-foreground">{type.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {type.authority} · Not uploaded
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className="w-fit border-amber-300 text-amber-900 sm:ml-auto"
                    >
                      Missing
                    </Badge>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
        </div>

        <DialogFooter className={MODAL_FOOTER_CLASS}>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ViewDocumentDialog({
  submission,
  agent,
  onClose,
}: {
  submission: BadgeSubmission | null;
  agent: AgentMini | null;
  onClose: () => void;
}) {
  const [step, setStep] = useState<"summary" | "document">("summary");
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setStep("summary");
    setSignedUrl(null);
    setLoading(false);
  }, [submission?.id]);

  const openDocument = async () => {
    if (!submission?.document_url) return;
    setStep("document");
    setLoading(true);
    setSignedUrl(null);
    const { data, error } = await supabase.storage
      .from("agent-credentials")
      .createSignedUrl(submission.document_url, 60 * 10);
    if (error) toast.error(error.message);
    setSignedUrl(data?.signedUrl ?? null);
    setLoading(false);
  };

  if (!submission) return null;
  const isPdf = submission.document_url?.toLowerCase().endsWith(".pdf");
  const agentName = agent?.business_name ?? "Unknown agent";
  const country = agent?.country_code ?? "—";
  const credentialType = submission.type.name;
  const submittedAt = format(new Date(submission.created_at), "PPp");

  return (
    <Dialog
      open={!!submission}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className={DOCUMENT_MODAL_CLASS}>
        {step === "summary" ? (
          <>
            <DialogHeader className="shrink-0 pr-8">
              <DialogTitle>Review submission</DialogTitle>
              <DialogDescription>
                Confirm this is the correct submission before opening the document.
              </DialogDescription>
            </DialogHeader>
            <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-border bg-muted/40 p-4">
              <dl className="grid gap-4 sm:grid-cols-2">
                <div className="min-w-0">
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Agent
                  </dt>
                  <dd className="mt-1 break-words text-sm font-medium">{agentName}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Country
                  </dt>
                  <dd className="mt-1 break-words text-sm font-medium">{country}</dd>
                </div>
                <div className="min-w-0 sm:col-span-2">
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Credential type
                  </dt>
                  <dd className="mt-1 break-words text-sm font-medium">{credentialType}</dd>
                </div>
                <div className="min-w-0 sm:col-span-2">
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Submitted
                  </dt>
                  <dd className="mt-1 break-words text-sm font-medium">{submittedAt}</dd>
                </div>
              </dl>
            </div>
            <DialogFooter className={`${MODAL_FOOTER_CLASS} sm:justify-between`}>
              <Button variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={openDocument} disabled={!submission.document_url}>
                <ExternalLink className="h-4 w-4" />
                Open document
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader className="shrink-0 pr-8">
              <DialogTitle className="break-words">{credentialType}</DialogTitle>
              <DialogDescription className="break-words">
                {agentName} · {country} · {submittedAt}
              </DialogDescription>
            </DialogHeader>
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <div className="min-h-[16rem] flex-1 overflow-auto rounded-lg border border-border bg-secondary/40 sm:min-h-[20rem] md:min-h-[24rem]">
                {loading ? (
                  <div className="flex h-full min-h-[16rem] items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : signedUrl ? (
                  isPdf ? (
                    <iframe
                      src={signedUrl}
                      className="h-full min-h-[16rem] w-full border-0 sm:min-h-[20rem] md:min-h-[24rem]"
                      title="Document"
                    />
                  ) : (
                    <img
                      src={signedUrl}
                      alt="Credential document"
                      className="mx-auto h-auto max-h-[min(70dvh,36rem)] w-full object-contain p-2"
                    />
                  )
                ) : (
                  <div className="flex h-full min-h-[16rem] items-center justify-center px-4 text-center text-sm text-muted-foreground">
                    Document unavailable
                  </div>
                )}
              </div>
            </div>
            <DialogFooter className={`${MODAL_FOOTER_CLASS} sm:justify-between`}>
              <Button variant="outline" onClick={() => setStep("summary")}>
                Back to summary
              </Button>
              {signedUrl ? (
                <Button asChild variant="outline">
                  <a href={signedUrl} target="_blank" rel="noreferrer">
                    Open in new tab <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              ) : null}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function RejectDialog({
  submission,
  onClose,
  onSubmitted,
}: {
  submission: BadgeSubmission | null;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const { user } = useAuth();
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setReason("");
  }, [submission]);

  if (!submission) return null;
  const submit = async () => {
    if (reason.trim().length < 5) {
      toast.error("Please provide a reason (min 5 characters)");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase
      .from("agent_badges")
      .update({ status: "rejected", rejection_reason: reason.trim() })
      .eq("id", submission.id);
    setSubmitting(false);
    if (error) toast.error(error.message);
    else {
      if (user) {
        await logAdminAction(user.id, "verification.reject", "agent_badge", submission.id, {
          agent_id: submission.agent_id,
          badge_type: submission.badge_type,
          reason: reason.trim(),
        });
      }
      toast.success("Badge rejected");
      onSubmitted();
    }
  };

  return (
    <Dialog open={!!submission} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className={`${VERIFICATION_MODAL_CLASS} sm:max-w-lg`}>
        <DialogHeader className="pr-8">
          <DialogTitle className="break-words">Reject {submission.type.name}</DialogTitle>
          <DialogDescription>The agent will see this reason and can resubmit.</DialogDescription>
        </DialogHeader>
        <Textarea
          rows={4}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Document is illegible. Please upload a higher-resolution scan."
        />
        <DialogFooter className={MODAL_FOOTER_CLASS}>
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
    <Button onClick={handle} disabled={running} variant="outline" size="sm">
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
    <Button onClick={handle} disabled={running} variant="outline" size="sm">
      {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
      Refresh Rates
    </Button>
  );
}
