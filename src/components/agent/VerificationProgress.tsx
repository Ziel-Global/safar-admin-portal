import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ShieldCheck, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { levelFromCount, LEVEL_STYLES, type VerificationLevel } from "@/lib/badges";
import { cn } from "@/lib/utils";

const TOTAL_BADGES = 4;

export function VerificationProgress({ agentId }: { agentId: string }) {
  const [verified, setVerified] = useState<number | null>(null);
  const [pending, setPending] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("agent_badges")
        .select("status")
        .eq("agent_id", agentId);
      if (cancelled) return;
      const rows = data ?? [];
      setVerified(rows.filter((r) => r.status === "verified").length);
      setPending(rows.filter((r) => r.status === "pending").length);
    })();
    return () => {
      cancelled = true;
    };
  }, [agentId]);

  if (verified == null) {
    return <Skeleton className="h-32 rounded-xl" />;
  }

  const level: VerificationLevel = levelFromCount(verified);
  const pct = Math.min(100, Math.round((verified / TOTAL_BADGES) * 100));
  const remaining = TOTAL_BADGES - verified;

  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Verification progress</CardTitle>
          </div>
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize",
              LEVEL_STYLES[level],
            )}
          >
            {level === "none" ? "Not verified" : `${level} tier`}
          </span>
        </div>
        <CardDescription>
          {remaining > 0
            ? `Verify ${remaining} more credential${remaining > 1 ? "s" : ""} to reach ${
                level === "none"
                  ? "bronze"
                  : level === "bronze"
                    ? "silver"
                    : level === "silver"
                      ? "gold"
                      : "platinum"
              } tier.`
            : "You've reached the highest verification tier. Pilgrims trust you most."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {verified} of {TOTAL_BADGES} verified
            </span>
            {pending > 0 ? <span>{pending} under review</span> : null}
          </div>
          <Progress value={pct} className="h-2" />
        </div>
        <Button asChild size="sm" variant={remaining > 0 ? "default" : "outline"}>
          <Link to="/agent/onboarding/credentials">
            {remaining > 0 ? "Add credentials" : "Manage credentials"}
            <ChevronRight className="h-4 w-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
