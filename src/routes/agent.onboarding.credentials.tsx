import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Loader2, Upload, CheckCircle2, XCircle, Clock, FileText, ArrowLeft } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  getBadgeIcon,
  type AgentBadge,
  type BadgeType,
  type BadgeStatus,
} from "@/lib/badges";
import { cn } from "@/lib/utils";
import { CalendarIcon } from "lucide-react";

export const Route = createFileRoute("/agent/onboarding/credentials")({
  head: () => ({
    meta: [
      { title: "Verify Your Credentials - Safar" },
      { name: "description", content: "Upload your trade licenses and accreditations to unlock trust badges on your Safar profile." },
    ],
  }),
  component: () => (
    <ProtectedRoute requireRole="agent">
      <CredentialsPage />
    </ProtectedRoute>
  ),
});

const STATUS_BADGE: Record<BadgeStatus, { label: string; className: string; Icon: typeof Clock }> = {
  pending: { label: "Under review", className: "bg-amber-100 text-amber-900 border-amber-300", Icon: Clock },
  verified: { label: "Verified", className: "bg-emerald-100 text-emerald-900 border-emerald-300", Icon: CheckCircle2 },
  expired: { label: "Expired", className: "bg-rose-100 text-rose-900 border-rose-300", Icon: XCircle },
  rejected: { label: "Rejected", className: "bg-rose-100 text-rose-900 border-rose-300", Icon: XCircle },
};

function CredentialsPage() {
  const { agent } = useAuth();
  const navigate = useNavigate();
  const [badgeTypes, setBadgeTypes] = useState<BadgeType[]>([]);
  const [submissions, setSubmissions] = useState<AgentBadge[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    if (!agent?.id) return;
    const [{ data: types }, { data: subs }] = await Promise.all([
      supabase.from("badge_types").select("*").order("name") as unknown as Promise<{ data: BadgeType[] | null }>,
      supabase
        .from("agent_badges")
        .select("*")
        .eq("agent_id", agent.id) as unknown as Promise<{ data: AgentBadge[] | null }>,
    ]);
    setBadgeTypes(types ?? []);
    setSubmissions(subs ?? []);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agent?.id]);

  const verifiedCount = submissions.filter((s) => s.status === "verified").length;

  return (
    <DashboardLayout variant="agent" title="Verify your credentials">
      <div className="mx-auto w-full max-w-4xl">
        <div className="mb-6 flex items-center justify-between gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/agent/dashboard" })}>
            <ArrowLeft className="h-4 w-4" /> Back to dashboard
          </Button>
          <Badge variant="secondary" className="px-3 py-1.5">
            {verifiedCount} / {badgeTypes.length} verified
          </Badge>
        </div>

        <div className="mb-8">
          <h2 className="text-2xl font-bold tracking-tight">Build trust with verified badges</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Upload your official documents. Our team reviews each submission within 1–2 business days.
          </p>
        </div>

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-72 rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {badgeTypes.map((type) => (
              <CredentialCard
                key={type.id}
                type={type}
                submission={submissions.find((s) => s.badge_type === type.id)}
                agentId={agent?.id ?? ""}
                onChanged={refresh}
              />
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

function CredentialCard({
  type,
  submission,
  agentId,
  onChanged,
}: {
  type: BadgeType;
  submission?: AgentBadge;
  agentId: string;
  onChanged: () => void;
}) {
  const Icon = getBadgeIcon(type.icon_name);
  const status = submission?.status;
  const [file, setFile] = useState<File | null>(null);
  const [expiry, setExpiry] = useState<Date | undefined>(
    submission?.expires_at ? new Date(submission.expires_at) : undefined,
  );
  const [uploading, setUploading] = useState(false);

  const canEdit = !submission || submission.status === "rejected" || submission.status === "expired";

  const handleSubmit = async () => {
    if (!file) {
      toast.error("Please choose a document");
      return;
    }
    if (!agentId) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "pdf";
      const path = `${(await supabase.auth.getUser()).data.user?.id}/${agentId}/${type.id}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("agent-credentials")
        .upload(path, file, { contentType: file.type, upsert: true });
      if (upErr) throw upErr;

      if (submission) {
        const { error } = await supabase
          .from("agent_badges")
          .update({
            document_url: path,
            expires_at: expiry ? format(expiry, "yyyy-MM-dd") : null,
            status: "pending",
            rejection_reason: null,
          })
          .eq("id", submission.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("agent_badges").insert({
          agent_id: agentId,
          badge_type: type.id,
          document_url: path,
          expires_at: expiry ? format(expiry, "yyyy-MM-dd") : null,
          status: "pending",
        });
        if (error) throw error;
      }
      toast.success(`${type.name} submitted`, { description: "We'll review it shortly." });
      setFile(null);
      onChanged();
    } catch (err) {
      const e = err as { message?: string };
      toast.error("Upload failed", { description: e.message ?? "Please try again." });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card className="flex flex-col border-border">
      <CardHeader>
        <div className="flex items-start gap-3">
          <span
            className="grid h-12 w-12 shrink-0 place-content-center rounded-xl"
            style={{ backgroundColor: type.color_hex }}
          >
            <Icon className="h-6 w-6 text-white" />
          </span>
          <div className="flex-1">
            <CardTitle className="flex flex-wrap items-center gap-2 text-base">
              {type.name}
              {status ? (
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                    STATUS_BADGE[status].className,
                  )}
                >
                  {(() => {
                    const StatusIcon = STATUS_BADGE[status].Icon;
                    return <StatusIcon className="h-3 w-3" />;
                  })()}
                  {STATUS_BADGE[status].label}
                </span>
              ) : null}
            </CardTitle>
            <CardDescription className="mt-1">{type.description}</CardDescription>
            <p className="mt-1 text-[11px] text-muted-foreground">Issued by {type.authority}</p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-3">
        {submission?.status === "rejected" && submission.rejection_reason ? (
          <div className="rounded-md border border-rose-300 bg-rose-50 p-3 text-xs text-rose-900">
            <strong>Reason:</strong> {submission.rejection_reason}
          </div>
        ) : null}

        {submission?.status === "verified" ? (
          <div className="rounded-md border border-emerald-300 bg-emerald-50 p-3 text-xs text-emerald-900">
            Verified on {submission.verified_at ? format(new Date(submission.verified_at), "PP") : "-"}
            {submission.expires_at ? ` · Expires ${format(new Date(submission.expires_at), "PP")}` : ""}
          </div>
        ) : null}

        {canEdit ? (
          <>
            <div className="space-y-1.5">
              <Label htmlFor={`file-${type.id}`} className="text-xs font-semibold">
                Document (PDF, JPEG, PNG)
              </Label>
              <label
                htmlFor={`file-${type.id}`}
                className={cn(
                  "flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-border bg-secondary/40 px-4 py-5 text-center transition-colors hover:bg-secondary",
                  file && "border-primary/40 bg-primary/5",
                )}
              >
                {file ? (
                  <>
                    <FileText className="h-6 w-6 text-primary" />
                    <span className="text-xs font-medium text-foreground">{file.name}</span>
                    <span className="text-[11px] text-muted-foreground">
                      {(file.size / 1024).toFixed(0)} KB
                    </span>
                  </>
                ) : (
                  <>
                    <Upload className="h-6 w-6 text-muted-foreground" />
                    <span className="text-xs font-medium text-foreground">Click to upload</span>
                    <span className="text-[11px] text-muted-foreground">Max 10MB</span>
                  </>
                )}
              </label>
              <Input
                id={`file-${type.id}`}
                type="file"
                accept="application/pdf,image/jpeg,image/png"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f && f.size > 10 * 1024 * 1024) {
                    toast.error("File too large (max 10MB)");
                    return;
                  }
                  setFile(f ?? null);
                }}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Expiry date (optional)</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      "justify-start text-left font-normal",
                      !expiry && "text-muted-foreground",
                    )}
                  >
                    <CalendarIcon className="h-4 w-4" />
                    {expiry ? format(expiry, "PP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={expiry}
                    onSelect={setExpiry}
                    disabled={(d) => d < new Date()}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <Button onClick={handleSubmit} disabled={uploading || !file} className="mt-auto">
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {submission ? "Resubmit" : "Submit for review"}
            </Button>
          </>
        ) : (
          <div className="mt-auto rounded-md border border-border bg-secondary/40 p-3 text-xs text-muted-foreground">
            Submitted {submission?.created_at ? format(new Date(submission.created_at), "PP") : ""}.
            We'll email you when the review is complete.
          </div>
        )}

        {type.help_url ? (
          <a
            href={type.help_url}
            target="_blank"
            rel="noreferrer"
            className="text-[11px] font-semibold text-primary hover:underline"
          >
            Learn about {type.name} →
          </a>
        ) : null}
      </CardContent>
    </Card>
  );
}

// Suppress unused warnings
void Link;
