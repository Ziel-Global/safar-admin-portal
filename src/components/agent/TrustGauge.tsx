import { FACTOR_LABELS, trustGaugeColor, type TrustFactors } from "@/lib/trust";
import { cn } from "@/lib/utils";

export function TrustGauge({
  score,
  size = 140,
  className,
}: {
  score: number;
  size?: number;
  className?: string;
}) {
  const colour = trustGaugeColor(score);
  const radius = 56;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(Math.max(score, 0), 100) / 100) * circumference;
  return (
    <div className={cn("relative inline-grid place-content-center", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 140 140" className="-rotate-90">
        <circle
          cx="70"
          cy="70"
          r={radius}
          fill="none"
          strokeWidth="12"
          className="stroke-secondary"
        />
        <circle
          cx="70"
          cy="70"
          r={radius}
          fill="none"
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={cn("transition-[stroke-dashoffset] duration-700", colour.stroke)}
        />
      </svg>
      <div className="absolute inset-0 grid place-content-center text-center">
        <div className={cn("text-3xl font-bold", colour.text)}>{score}</div>
        <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {colour.label}
        </div>
      </div>
    </div>
  );
}

export function TrustFactorsBars({ factors }: { factors: TrustFactors }) {
  const entries = (Object.keys(FACTOR_LABELS) as (keyof TrustFactors)[]).map((k) => ({
    key: k,
    label: FACTOR_LABELS[k],
    value: Number(factors[k] ?? 0),
  }));
  return (
    <div className="space-y-3">
      {entries.map((e) => {
        const pct = (e.value / 20) * 100;
        return (
          <div key={e.key} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-foreground/80">{e.label}</span>
              <span className="tabular-nums text-muted-foreground">
                {e.value.toFixed(1)} / 20
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-secondary">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  pct >= 70 ? "bg-emerald-500" : pct >= 40 ? "bg-amber-500" : "bg-rose-500",
                )}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
