import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/agents")({
  head: () => ({
    meta: [
      { title: "Agents - Admin" },
      { name: "description", content: "Browse all agents on the platform." },
    ],
  }),
  component: () => (
    <ProtectedRoute requireRole="admin">
      <AdminAgentsPage />
    </ProtectedRoute>
  ),
});

interface AgentRow {
  id: string;
  business_name: string;
  slug: string | null;
  city: string | null;
  country_code: string | null;
  status: string;
  trust_score: number;
  total_reviews: number;
  verification_level: string;
}

function statusBadgeClass(status: string) {
  switch (status) {
    case "active":
      return "bg-emerald-100 text-emerald-900 border-emerald-300";
    case "suspended":
      return "bg-amber-100 text-amber-900 border-amber-300";
    case "banned":
      return "bg-rose-100 text-rose-900 border-rose-300";
    default:
      return "bg-slate-100 text-slate-800 border-slate-300";
  }
}

function AdminAgentsPage() {
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("agents")
        .select("id, business_name, slug, city, country_code, status, trust_score, total_reviews, verification_level")
        .order("business_name");
      setAgents((data ?? []) as AgentRow[]);
      setLoading(false);
    };
    load();
  }, []);

  const filtered = agents.filter((a) =>
    search ? a.business_name.toLowerCase().includes(search.toLowerCase()) : true,
  );

  return (
    <AdminLayout title="Admin · Agents">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">All agents</h2>
          <p className="mt-1 text-sm text-muted-foreground">{agents.length} agents on the platform</p>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by business name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-lg" />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {filtered.map((a) => (
                  <div key={a.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      {a.slug ? (
                        <Link
                          to="/agents/$slug"
                          params={{ slug: a.slug }}
                          className="text-sm font-semibold text-foreground hover:text-primary"
                        >
                          {a.business_name}
                        </Link>
                      ) : (
                        <span className="text-sm font-semibold">{a.business_name}</span>
                      )}
                      <div className="text-xs text-muted-foreground">
                        {[a.city, a.country_code].filter(Boolean).join(" · ") || "-"} ·{" "}
                        {a.total_reviews} review{a.total_reviews === 1 ? "" : "s"}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[11px]">
                        Trust {a.trust_score}
                      </Badge>
                      <Badge variant="outline" className="text-[11px] capitalize">
                        {a.verification_level}
                      </Badge>
                      <Badge className={statusBadgeClass(a.status) + " border text-[11px] capitalize"}>
                        {a.status}
                      </Badge>
                    </div>
                  </div>
                ))}
                {filtered.length === 0 && (
                  <div className="py-12 text-center text-sm text-muted-foreground">No agents match.</div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
}
