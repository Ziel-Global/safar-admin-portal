import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { format } from "date-fns";
import { Camera, Filter, MessageSquare, Star } from "lucide-react";
import { toast } from "sonner";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { StarRating } from "@/components/reviews/StarRating";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { MAX_HIGHLIGHTS, REVIEW_DIMENSIONS } from "@/lib/reviews";

export const Route = createFileRoute("/agent/reviews")({
  head: () => ({
    meta: [
      { title: "Reviews - Safar Agent" },
      { name: "description", content: "Manage and respond to pilgrim reviews." },
    ],
  }),
  component: AgentReviewsPage,
});

interface ReviewRow {
  id: string;
  overall_rating: number;
  dimensions: Record<string, { rating: number; comment?: string }>;
  review_text: string | null;
  created_at: string;
  agent_response: string | null;
  agent_responded_at: string | null;
  is_highlighted: boolean;
  moderation_status: string;
  pilgrim_id: string;
  media: { id: string; url: string; media_type: string }[];
}

function AgentReviewsPage() {
  return (
    <ProtectedRoute requireRole="agent">
      <Content />
    </ProtectedRoute>
  );
}

function Content() {
  const { agent } = useAuth();
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [minRating, setMinRating] = useState("0");
  const [hasPhotos, setHasPhotos] = useState(false);
  const [needsResponse, setNeedsResponse] = useState(false);
  const [respondTo, setRespondTo] = useState<ReviewRow | null>(null);
  const [responseText, setResponseText] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    if (!agent) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("reviews")
      .select(
        "id, overall_rating, dimensions, review_text, created_at, agent_response, agent_responded_at, is_highlighted, moderation_status, pilgrim_id, review_media(id, url, media_type)",
      )
      .eq("agent_id", agent.id)
      .order("created_at", { ascending: false });
    if (error) toast.error("Could not load reviews");
    else
      setReviews(
        ((data ?? []) as unknown as Array<Omit<ReviewRow, "media"> & { review_media: ReviewRow["media"] }>).map(
          (r) => ({ ...r, media: r.review_media ?? [] }),
        ),
      );
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agent?.id]);

  const filtered = useMemo(() => {
    return reviews.filter((r) => {
      if (Number(minRating) > 0 && r.overall_rating < Number(minRating)) return false;
      if (hasPhotos && r.media.length === 0) return false;
      if (needsResponse && r.agent_response) return false;
      return true;
    });
  }, [reviews, minRating, hasPhotos, needsResponse]);

  const highlightedCount = reviews.filter((r) => r.is_highlighted).length;

  async function toggleHighlight(r: ReviewRow) {
    if (!r.is_highlighted && highlightedCount >= MAX_HIGHLIGHTS) {
      toast.error(`You can highlight up to ${MAX_HIGHLIGHTS} reviews`);
      return;
    }
    // optimistic
    setReviews((prev) =>
      prev.map((x) => (x.id === r.id ? { ...x, is_highlighted: !x.is_highlighted } : x)),
    );
    const { error } = await supabase
      .from("reviews")
      .update({ is_highlighted: !r.is_highlighted })
      .eq("id", r.id);
    if (error) {
      toast.error("Could not update", { description: error.message });
      setReviews((prev) =>
        prev.map((x) => (x.id === r.id ? { ...x, is_highlighted: r.is_highlighted } : x)),
      );
    }
  }

  function openRespond(r: ReviewRow) {
    setRespondTo(r);
    setResponseText(r.agent_response ?? "");
  }

  async function saveResponse() {
    if (!respondTo) return;
    setSaving(true);
    const { error } = await supabase
      .from("reviews")
      .update({ agent_response: responseText.trim() || null })
      .eq("id", respondTo.id);
    setSaving(false);
    if (error) {
      toast.error("Could not save response", { description: error.message });
      return;
    }
    toast.success("Response posted");
    setRespondTo(null);
    load();
  }

  return (
    <DashboardLayout variant="agent" title="Reviews">
      <div className="mx-auto w-full max-w-5xl">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Pilgrim reviews</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Respond to feedback and highlight your best reviews. {highlightedCount}/
              {MAX_HIGHLIGHTS} highlighted.
            </p>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-3">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={minRating} onValueChange={setMinRating}>
            <SelectTrigger className="h-9 w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">Any rating</SelectItem>
              <SelectItem value="3">3+ stars</SelectItem>
              <SelectItem value="4">4+ stars</SelectItem>
              <SelectItem value="5">5 stars only</SelectItem>
            </SelectContent>
          </Select>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={hasPhotos} onCheckedChange={setHasPhotos} /> Has photos
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={needsResponse} onCheckedChange={setNeedsResponse} /> Needs response
          </label>
        </div>

        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Star className="h-7 w-7" />}
            title={reviews.length === 0 ? "No reviews yet" : "No reviews match these filters"}
            description={
              reviews.length === 0
                ? "Once pilgrims complete their trips, their reviews will appear here. Use templates to politely solicit reviews after a successful booking."
                : "Try clearing the rating, photos, or response filters."
            }
          />
        ) : (
          <div className="space-y-3">
            {filtered.map((r) => (
              <Card key={r.id} className="border-border">
                <CardContent className="p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <StarRating value={r.overall_rating} size="sm" readOnly />
                    <span className="text-sm font-semibold">{r.overall_rating.toFixed(1)}</span>
                    <Badge variant="outline" className="text-[10px] capitalize">
                      {r.moderation_status}
                    </Badge>
                    {r.is_highlighted ? (
                      <Badge className="bg-primary/10 text-primary border-primary/30 border text-[10px]">
                        Highlighted
                      </Badge>
                    ) : null}
                    <span className="ml-auto text-xs text-muted-foreground">
                      {format(new Date(r.created_at), "PP")}
                    </span>
                  </div>

                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    {REVIEW_DIMENSIONS.map((d) => {
                      const s = r.dimensions?.[d.key];
                      if (!s) return null;
                      return (
                        <div key={d.key} className="text-xs text-muted-foreground">
                          <span>{d.label}: </span>
                          <span className="font-semibold text-foreground">{s.rating}/5</span>
                        </div>
                      );
                    })}
                  </div>

                  {r.review_text ? (
                    <p className="mt-3 whitespace-pre-line text-sm text-foreground/90">
                      {r.review_text}
                    </p>
                  ) : null}

                  {r.media.length > 0 ? (
                    <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                      <Camera className="h-3.5 w-3.5" /> {r.media.length} attachment
                      {r.media.length > 1 ? "s" : ""}
                    </div>
                  ) : null}

                  {r.agent_response ? (
                    <div className="mt-4 rounded-md border-l-4 border-primary/60 bg-secondary/40 p-3">
                      <p className="text-xs font-semibold text-foreground">Your response</p>
                      <p className="mt-1 whitespace-pre-line text-sm text-foreground/80">
                        {r.agent_response}
                      </p>
                    </div>
                  ) : null}

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => openRespond(r)}>
                      <MessageSquare className="h-4 w-4" />{" "}
                      {r.agent_response ? "Edit response" : "Respond"}
                    </Button>
                    <Button
                      size="sm"
                      variant={r.is_highlighted ? "default" : "outline"}
                      onClick={() => toggleHighlight(r)}
                    >
                      <Star className="h-4 w-4" />{" "}
                      {r.is_highlighted ? "Unhighlight" : "Highlight"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={!!respondTo} onOpenChange={(o) => (!o ? setRespondTo(null) : null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Respond to review</DialogTitle>
          </DialogHeader>
          <Textarea
            value={responseText}
            onChange={(e) => setResponseText(e.target.value)}
            rows={5}
            placeholder="Thank you for travelling with us..."
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRespondTo(null)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={saveResponse} disabled={saving}>
              {saving ? "Saving..." : "Post response"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
