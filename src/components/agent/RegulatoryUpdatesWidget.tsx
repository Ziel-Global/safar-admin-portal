import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Info, Megaphone } from "lucide-react";
import { listPublishedForCountry, severityClasses, type RegulatoryUpdate } from "@/lib/regulatory";
import { cn } from "@/lib/utils";

export function RegulatoryUpdatesWidget({ countryCode }: { countryCode: string | null }) {
  const [updates, setUpdates] = useState<RegulatoryUpdate[] | null>(null);

  useEffect(() => {
    listPublishedForCountry(countryCode).then(setUpdates).catch(() => setUpdates([]));
  }, [countryCode]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Megaphone className="h-5 w-5 text-primary" /> Regulatory updates
        </CardTitle>
        <CardDescription>
          Recent advisories{countryCode ? ` for ${countryCode}` : ""}.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {updates === null ? (
          <div className="h-20 animate-pulse rounded-md bg-secondary" />
        ) : updates.length === 0 ? (
          <p className="text-sm text-muted-foreground">No active updates.</p>
        ) : (
          <ul className="space-y-2">
            {updates.slice(0, 5).map((u) => (
              <li
                key={u.id}
                className={cn(
                  "rounded-md border px-3 py-2 text-sm",
                  severityClasses(u.severity),
                )}
              >
                <div className="flex items-start gap-2">
                  {u.severity === "critical" || u.severity === "warning" ? (
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  ) : (
                    <Info className="mt-0.5 h-4 w-4 shrink-0" />
                  )}
                  <div className="flex-1">
                    <p className="font-semibold">{u.title}</p>
                    {u.body ? (
                      <p className="mt-1 line-clamp-2 text-xs opacity-90">{u.body}</p>
                    ) : null}
                    {u.published_at ? (
                      <p className="mt-1 text-xs opacity-60">
                        {new Date(u.published_at).toLocaleDateString()}
                      </p>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
