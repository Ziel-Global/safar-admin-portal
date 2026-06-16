import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Gavel, Loader2, ShieldAlert } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ENFORCEMENT_LEVELS, logAdminAction } from "@/lib/admin";

export const Route = createFileRoute("/admin/enforcement")({
  head: () => ({
    meta: [
      { title: "Enforcement - Admin" },
      { name: "description", content: "Issue warnings, suspensions and bans against agents." },
    ],
  }),
  component: () => (
    <ProtectedRoute requireRole="admin">
      <AdminEnforcementPage />
    </ProtectedRoute>
  ),
});

interface AgentRow {
  id: string;
  business_name: string;
  slug: string | null;
  status: string;
}

interface ActionRow {
  id: string;
  agent_id: string;
  level: 1 | 2 | 3 | 4;
  reason: string;
  status: string;
  issued_at: string;
  expires_at: string | null;
  agent_name?: string;
  agent_slug?: string | null;
}

function AdminEnforcementPage() {
  const { user } = useAuth();
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [actions, setActions] = useState<ActionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const refresh = async () => {
    setLoading(true);
    const [{ data: ag }, { data: ac }] = await Promise.all([
      supabase
        .from("agents")
        .select("id, business_name, slug, status")
        .order("business_name"),
      supabase
        .from("enforcement_actions")
        .select("id, agent_id, level, reason, status, issued_at, expires_at")
        .order("issued_at", { ascending: false }),
    ]);
    const agentList = (ag ?? []) as AgentRow[];
    const actionList = (ac ?? []) as ActionRow[];
    const aMap = new Map(agentList.map((a) => [a.id, a]));
    setAgents(agentList);
    setActions(
      actionList.map((a) => ({
        ...a,
        agent_name: aMap.get(a.agent_id)?.business_name,
        agent_slug: aMap.get(a.agent_id)?.slug ?? null,
      })),
    );
    setLoading(false);
  };

  useEffect(() => {
    refresh();
  }, []);

  const filteredAgents = agents.filter((a) =>
    search ? a.business_name.toLowerCase().includes(search.toLowerCase()) : true,
  );

  const issueAction = async (input: {
    agentId: string;
    level: 1 | 2 | 3 | 4;
    reason: string;
    expiresAt: string | null;
  }) => {
    if (!user) return false;
    const { error } = await supabase.from("enforcement_actions").insert({
      agent_id: input.agentId,
      level: input.level,
      reason: input.reason,
      issued_by: user.id,
      expires_at: input.expiresAt,
    });
    if (error) {
      toast.error(error.message);
      return false;
    }
    await logAdminAction(user.id, "enforcement.issue", "agent", input.agentId, {
      level: input.level,
      reason: input.reason,
    });

    // The agent is notified automatically for all levels by a database
    // trigger (apply_enforcement_side_effects), so no client-side insert here.



    toast.success(`Enforcement L${input.level} issued`);
    refresh();
    return true;
  };

  const revokeAction = async (action: ActionRow) => {
    if (!user) return;
    const { error } = await supabase
      .from("enforcement_actions")
      .update({ status: "revoked" })
      .eq("id", action.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    // If suspension/ban, restore agent if no other active high-level action exists
    if (action.level >= 3) {
      const { data: still } = await supabase
        .from("enforcement_actions")
        .select("id")
        .eq("agent_id", action.agent_id)
        .eq("status", "active")
        .gte("level", 3)
        .neq("id", action.id);
      if (!still || still.length === 0) {
        await supabase.from("agents").update({ status: "active" }).eq("id", action.agent_id);
      }
    }
    await logAdminAction(user.id, "enforcement.revoke", "agent", action.agent_id, {
      action_id: action.id,
    });
    toast.success("Action revoked");
    refresh();
  };

  return (
    <AdminLayout title="Admin · Enforcement">
      <div className="mx-auto w-full max-w-6xl space-y-8">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Gavel className="h-6 w-6 text-rose-600" /> Enforcement
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Issue warnings, demotions, suspensions, or permanent bans. All actions are logged.
          </p>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Issue an action</CardTitle>
            <CardDescription>Search for an agent and choose an enforcement level.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              placeholder="Search agents by name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {loading ? (
              <Skeleton className="h-32 rounded-md" />
            ) : (
              <div className="max-h-72 space-y-2 overflow-y-auto rounded-md border border-border bg-card p-2">
                {filteredAgents.slice(0, 50).map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center justify-between gap-2 rounded-md px-3 py-2 hover:bg-secondary/40"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{a.business_name}</div>
                      <div className="text-[11px] text-muted-foreground capitalize">
                        Status: {a.status}
                      </div>
                    </div>
                    <IssueDialog agent={a} onIssue={issueAction} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Enforcement history</CardTitle>
            <CardDescription>Most recent actions across all agents.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-40 rounded-md" />
            ) : actions.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No enforcement actions yet.</p>
            ) : (
              <div className="space-y-3">
                {actions.map((a) => {
                  const meta = ENFORCEMENT_LEVELS.find((l) => l.level === a.level);
                  return (
                    <div
                      key={a.id}
                      className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border bg-card p-3"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge className={(meta?.badgeClass ?? "") + " border text-[11px]"}>
                            L{a.level}
                          </Badge>
                          {a.agent_slug ? (
                            <Link
                              to="/agents/$slug"
                              params={{ slug: a.agent_slug }}
                              className="text-sm font-semibold text-primary hover:underline"
                            >
                              {a.agent_name}
                            </Link>
                          ) : (
                            <span className="text-sm font-semibold">{a.agent_name}</span>
                          )}
                          <Badge variant="outline" className="text-[10px] capitalize">
                            {a.status}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(a.issued_at), "PP")}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">{a.reason}</p>
                      </div>
                      {a.status === "active" ? (
                        <Button variant="outline" size="sm" onClick={() => revokeAction(a)}>
                          Revoke
                        </Button>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}

function IssueDialog({
  agent,
  onIssue,
}: {
  agent: AgentRow;
  onIssue: (i: {
    agentId: string;
    level: 1 | 2 | 3 | 4;
    reason: string;
    expiresAt: string | null;
  }) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [level, setLevel] = useState<"1" | "2" | "3" | "4">("1");
  const [reason, setReason] = useState("");
  // Duration in days as string, or "none" for permanent / no expiry.
  const [duration, setDuration] = useState<"none" | "7" | "14" | "30" | "90">("none");
  const [submitting, setSubmitting] = useState(false);

  const handleLevelChange = (v: typeof level) => {
    setLevel(v);
    // Suspensions default to a 14-day window; bans are permanent.
    if (v === "3") setDuration("14");
    else setDuration("none");
  };


  const submit = async () => {
    if (reason.trim().length < 10) {
      toast.error("Please provide a reason (min 10 characters)");
      return;
    }
    setSubmitting(true);
    const expiresAt =
      duration === "none"
        ? null
        : new Date(Date.now() + Number(duration) * 24 * 60 * 60 * 1000).toISOString();
    const ok = await onIssue({
      agentId: agent.id,
      level: Number(level) as 1 | 2 | 3 | 4,
      reason: reason.trim(),
      expiresAt,
    });
    setSubmitting(false);
    if (ok) {
      setOpen(false);
      setReason("");
      setDuration("none");
      setLevel("1");
    }
  };

  const meta = ENFORCEMENT_LEVELS.find((l) => l.level === Number(level));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <ShieldAlert className="h-4 w-4" /> Issue
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Enforcement action - {agent.business_name}</DialogTitle>
          <DialogDescription>
            All actions are recorded in the admin audit log. L3 and L4 immediately affect agent visibility.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Level</Label>
            <Select value={level} onValueChange={(v) => handleLevelChange(v as typeof level)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ENFORCEMENT_LEVELS.map((l) => (
                  <SelectItem key={l.level} value={String(l.level)}>
                    {l.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {meta ? (
              <p className="text-xs text-muted-foreground">{meta.description}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="enf-reason">Reason</Label>
            <Textarea
              id="enf-reason"
              rows={4}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain the policy violation. The agent will see this for L1 warnings."
            />
          </div>
          <div className="space-y-2">
            <Label>Duration</Label>
            <Select value={duration} onValueChange={(v) => setDuration(v as typeof duration)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No expiry (permanent)</SelectItem>
                <SelectItem value="7">7 days</SelectItem>
                <SelectItem value="14">14 days</SelectItem>
                <SelectItem value="30">30 days</SelectItem>
                <SelectItem value="90">90 days</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {duration === "none"
                ? "This action will not auto-expire."
                : `Expires on ${format(
                    new Date(Date.now() + Number(duration) * 24 * 60 * 60 * 1000),
                    "PP",
                  )}.`}
            </p>
          </div>

        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={submit} disabled={submitting}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Confirm action
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
