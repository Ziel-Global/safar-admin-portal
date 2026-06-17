import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck, AlertTriangle } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  bucketClasses,
  bucketFor,
  bucketLabel,
  fetchAgentBadgesWithExpiry,
  type BadgeRow,
} from "@/lib/compliance";
import { cn } from "@/lib/utils";

export function ComplianceWidget({ agentId }: { agentId: string }) {
  const [badges, setBadges] = useState<BadgeRow[] | null>(null);

  useEffect(() => {
    fetchAgentBadgesWithExpiry(agentId).then(setBadges).catch(() => setBadges([]));
  }, [agentId]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" /> Compliance
            </CardTitle>
            <CardDescription>Track licence and credential expiry dates.</CardDescription>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link to="/agent/onboarding/credentials">Manage</Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {badges === null ? (
          <div className="h-24 animate-pulse rounded-md bg-secondary" />
        ) : badges.length === 0 ? (
          <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No credentials uploaded yet. Add one to start building trust.
          </div>
        ) : (
          <ul className="space-y-2">
            {badges.map((b) => {
              const bucket = b.status === "expired" ? "expired" : bucketFor(b.expires_at);
              const date = b.expires_at ? new Date(b.expires_at).toLocaleDateString() : "No expiry";
              return (
                <li
                  key={b.id}
                  className={cn(
                    "flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm",
                    bucketClasses(bucket),
                  )}
                >
                  <div className="flex items-center gap-2">
                    {(bucket === "critical" || bucket === "expired") && (
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                    )}
                    <span className="font-medium">{b.badge_name}</span>
                    <span className="text-xs opacity-70">· {b.status}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span>{date}</span>
                    <span className="rounded-full border border-current/30 px-2 py-0.5 font-semibold">
                      {bucketLabel(bucket)}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
