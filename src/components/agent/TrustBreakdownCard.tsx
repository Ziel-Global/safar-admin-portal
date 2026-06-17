import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TrustFactorsBars, TrustGauge } from "./TrustGauge";
import { Lightbulb } from "lucide-react";
import type { TrustFactors, TrustScoreRow } from "@/lib/trust";

export function TrustBreakdownCard({ agentId }: { agentId: string }) {
  const [data, setData] = useState<TrustScoreRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: row } = await supabase
        .from("trust_scores")
        .select("agent_id, total_score, factors, tips, computed_at")
        .eq("agent_id", agentId)
        .maybeSingle();
      if (cancelled) return;
      setData(row as unknown as TrustScoreRow | null);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [agentId]);

  if (loading) {
    return (
      <Card className="border-border">
        <CardHeader>
          <CardTitle>Trust score</CardTitle>
          <CardDescription>Loading your trust breakdown…</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-32 animate-pulse rounded-md bg-secondary" />
        </CardContent>
      </Card>
    );
  }

  const score = data?.total_score ?? 0;
  const factors: TrustFactors = (data?.factors as TrustFactors) ?? {
    reviews: 0,
    response: 0,
    years: 0,
    verification: 0,
    complaints: 0,
  };
  const tips = data?.tips ?? [];

  return (
    <Card className="border-border">
      <CardHeader>
        <CardTitle>Trust score</CardTitle>
        <CardDescription>
          A 0–100 score that pilgrims see on your profile and search results.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 sm:grid-cols-[auto,1fr] sm:items-center">
          <TrustGauge score={score} />
          <div className="flex-1">
            <TrustFactorsBars factors={factors} />
          </div>
        </div>
        {tips.length > 0 ? (
          <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-start gap-2">
              <Lightbulb className="mt-0.5 h-4 w-4 text-amber-600" />
              <div>
                <p className="text-sm font-semibold text-amber-900">Boost your score</p>
                <ul className="mt-1 list-disc space-y-1 pl-4 text-sm text-amber-800">
                  {tips.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
