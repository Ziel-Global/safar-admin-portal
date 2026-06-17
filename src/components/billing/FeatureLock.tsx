import { Link } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TIER_LABEL, type SubscriptionTier } from "@/lib/subscriptions";
import { cn } from "@/lib/utils";

export function FeatureLock({
  requiredTier,
  featureName,
  className,
  children,
}: {
  requiredTier: SubscriptionTier;
  featureName: string;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={cn("relative overflow-hidden rounded-xl border border-border bg-card", className)}>
      {children ? (
        <div className="pointer-events-none select-none blur-sm" aria-hidden>
          {children}
        </div>
      ) : (
        <div className="h-48" />
      )}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/70 p-6 text-center backdrop-blur-sm">
        <div className="grid h-12 w-12 place-content-center rounded-full bg-primary/10 text-primary">
          <Lock className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">{featureName} is locked</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Upgrade to {TIER_LABEL[requiredTier]} to unlock this feature.
          </p>
        </div>
        <Button asChild size="sm">
          <Link to="/agent/billing">Upgrade to {TIER_LABEL[requiredTier]}</Link>
        </Button>
      </div>
    </div>
  );
}
