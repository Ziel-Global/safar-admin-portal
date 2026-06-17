import { useMemo, useState } from "react";
import { format } from "date-fns";
import { Camera, ChevronLeft, ChevronRight, Filter, Star, X } from "lucide-react";
import { StarRating } from "@/components/reviews/StarRating";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { REVIEW_DIMENSIONS, type ReviewDimensionKey } from "@/lib/reviews";

export interface ReviewListItem {
  id: string;
  overall_rating: number;
  dimensions: Record<string, { rating: number; comment?: string }>;
  review_text: string | null;
  created_at: string;
  is_verified: boolean;
  is_highlighted: boolean;
  agent_response: string | null;
  agent_responded_at: string | null;
  pilgrim_name?: string | null;
  media: { id: string; url: string; media_type: string; thumbnail_url: string | null }[];
}

interface ReviewsTabProps {
  reviews: ReviewListItem[];
  avgRating: number;
  totalReviews: number;
  /** Optional pagination — show a "Load more" button when more reviews exist server-side. */
  onLoadMore?: () => void;
  loadingMore?: boolean;
  hasMore?: boolean;
}

export function ReviewsTab({
  reviews,
  avgRating,
  totalReviews,
  onLoadMore,
  loadingMore = false,
  hasMore = false,
}: ReviewsTabProps) {
  const [minRating, setMinRating] = useState<string>("0");
  const [hasPhotos, setHasPhotos] = useState(false);
  const [dimension, setDimension] = useState<ReviewDimensionKey | "all">("all");
  const [lightbox, setLightbox] = useState<{ items: { url: string; type: "photo" | "video" }[]; index: number } | null>(
    null,
  );

  const distribution = useMemo(() => {
    const dist = [0, 0, 0, 0, 0];
    for (const r of reviews) {
      const idx = Math.max(0, Math.min(4, Math.round(r.overall_rating) - 1));
      dist[idx]++;
    }
    return dist;
  }, [reviews]);

  const dimensionAverages = useMemo(() => {
    const sums: Record<string, { sum: number; n: number }> = {};
    for (const r of reviews) {
      for (const d of REVIEW_DIMENSIONS) {
        const s = r.dimensions?.[d.key]?.rating;
        if (typeof s === "number") {
          sums[d.key] = { sum: (sums[d.key]?.sum ?? 0) + s, n: (sums[d.key]?.n ?? 0) + 1 };
        }
      }
    }
    return REVIEW_DIMENSIONS.map((d) => ({
      ...d,
      avg: sums[d.key] ? sums[d.key].sum / sums[d.key].n : 0,
    }));
  }, [reviews]);

  const filtered = useMemo(() => {
    return reviews.filter((r) => {
      if (Number(minRating) > 0 && r.overall_rating < Number(minRating)) return false;
      if (hasPhotos && r.media.length === 0) return false;
      if (dimension !== "all" && !(r.dimensions?.[dimension]?.rating)) return false;
      return true;
    });
  }, [reviews, minRating, hasPhotos, dimension]);

  const highlighted = filtered.filter((r) => r.is_highlighted);
  const others = filtered.filter((r) => !r.is_highlighted);
  const ordered = [...highlighted, ...others];

  if (totalReviews === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/50 px-6 py-16 text-center">
        <Star className="h-6 w-6 text-muted-foreground" />
        <h3 className="mt-3 font-semibold">No reviews yet</h3>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          Be the first to share your experience after travelling with this agent.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary */}
      <Card className="border-border">
        <CardContent className="grid gap-6 p-6 md:grid-cols-2">
          <div className="flex flex-col items-start justify-center gap-2">
            <p className="text-5xl font-bold">{avgRating.toFixed(1)}</p>
            <StarRating value={avgRating} size="lg" readOnly />
            <p className="text-sm text-muted-foreground">
              Based on {totalReviews} verified review{totalReviews > 1 ? "s" : ""}
            </p>
          </div>
          <div className="space-y-1.5">
            {[5, 4, 3, 2, 1].map((star) => {
              const count = distribution[star - 1];
              const pct = totalReviews ? (count / totalReviews) * 100 : 0;
              return (
                <div key={star} className="flex items-center gap-2 text-xs">
                  <span className="w-4 text-right tabular-nums">{star}</span>
                  <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                  <Progress value={pct} className="h-1.5 flex-1" />
                  <span className="w-8 text-right tabular-nums text-muted-foreground">{count}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Dimension averages */}
      <Card className="border-border">
        <CardContent className="p-6">
          <h4 className="text-sm font-semibold text-foreground">By dimension</h4>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {dimensionAverages.map((d) => (
              <div key={d.key}>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-foreground">{d.label}</span>
                  <span className="font-semibold tabular-nums">{d.avg.toFixed(1)}</span>
                </div>
                <Progress value={(d.avg / 5) * 100} className="mt-1 h-1.5" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-3">
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
        <Select value={dimension} onValueChange={(v) => setDimension(v as typeof dimension)}>
          <SelectTrigger className="h-9 w-[180px]">
            <SelectValue placeholder="Any dimension" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any dimension</SelectItem>
            {REVIEW_DIMENSIONS.map((d) => (
              <SelectItem key={d.key} value={d.key}>
                {d.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <label className="ml-auto flex items-center gap-2 text-sm">
          <Switch checked={hasPhotos} onCheckedChange={setHasPhotos} /> Has photos
        </label>
      </div>

      {/* Reviews list */}
      <div className="space-y-3">
        {ordered.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No reviews match these filters.
          </p>
        ) : (
          ordered.map((r) => (
            <Card key={r.id} className={cn("border-border", r.is_highlighted && "border-primary/40")}>
              <CardContent className="p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <StarRating value={r.overall_rating} size="sm" readOnly />
                  <span className="text-sm font-semibold">{r.overall_rating.toFixed(1)}</span>
                  {r.is_verified ? (
                    <Badge variant="outline" className="text-[10px]">
                      Verified trip
                    </Badge>
                  ) : null}
                  {r.is_highlighted ? (
                    <Badge className="bg-primary/10 text-primary border-primary/30 border text-[10px]">
                      Highlighted
                    </Badge>
                  ) : null}
                  <span className="ml-auto text-xs text-muted-foreground">
                    {format(new Date(r.created_at), "PP")}
                  </span>
                </div>

                {r.review_text ? (
                  <p className="mt-3 whitespace-pre-line text-sm text-foreground/90">
                    {r.review_text}
                  </p>
                ) : null}

                {r.media.length > 0 ? (
                  <div className="mt-3 flex gap-2 overflow-x-auto">
                    {r.media.map((m, idx) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() =>
                          setLightbox({
                            items: r.media.map((mm) => ({
                              url: mm.url,
                              type: mm.media_type === "video" ? "video" : "photo",
                            })),
                            index: idx,
                          })
                        }
                        className="relative h-20 w-20 shrink-0 overflow-hidden rounded-md border border-border"
                      >
                        {m.media_type === "video" ? (
                          <video src={m.url} className="h-full w-full object-cover" />
                        ) : (
                          <img src={m.url} alt="" className="h-full w-full object-cover" />
                        )}
                        {m.media_type === "video" ? (
                          <span className="absolute inset-0 grid place-content-center bg-black/30 text-white">
                            ▶
                          </span>
                        ) : null}
                      </button>
                    ))}
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Camera className="h-3 w-3" /> {r.media.length}
                    </div>
                  </div>
                ) : null}

                {r.agent_response ? (
                  <div className="mt-4 rounded-md border-l-4 border-primary/60 bg-secondary/40 p-3">
                    <p className="text-xs font-semibold text-foreground">Agent response</p>
                    <p className="mt-1 whitespace-pre-line text-sm text-foreground/80">
                      {r.agent_response}
                    </p>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ))
        )}
        {onLoadMore && hasMore ? (
          <div className="flex justify-center pt-2">
            <button
              type="button"
              onClick={onLoadMore}
              disabled={loadingMore}
              className="rounded-full border border-border bg-card px-5 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-secondary disabled:opacity-60"
            >
              {loadingMore ? "Loading…" : `Load more reviews (${reviews.length} of ${totalReviews})`}
            </button>
          </div>
        ) : null}
      </div>

      {lightbox ? (
        <SimpleLightbox
          items={lightbox.items}
          startIndex={lightbox.index}
          onClose={() => setLightbox(null)}
        />
      ) : null}
    </div>
  );
}

function SimpleLightbox({
  items,
  startIndex,
  onClose,
}: {
  items: { url: string; type: "photo" | "video" }[];
  startIndex: number;
  onClose: () => void;
}) {
  const [idx, setIdx] = useState(startIndex);
  const item = items[idx];
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
      onClick={onClose}
    >
      <button
        type="button"
        aria-label="Close"
        className="absolute right-4 top-4 rounded-full bg-background/20 p-2 text-white"
        onClick={onClose}
      >
        <X className="h-5 w-5" />
      </button>
      {items.length > 1 ? (
        <>
          <button
            type="button"
            aria-label="Previous"
            className="absolute left-4 rounded-full bg-background/20 p-2 text-white"
            onClick={(e) => {
              e.stopPropagation();
              setIdx((i) => (i - 1 + items.length) % items.length);
            }}
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            type="button"
            aria-label="Next"
            className="absolute right-4 top-1/2 rounded-full bg-background/20 p-2 text-white"
            onClick={(e) => {
              e.stopPropagation();
              setIdx((i) => (i + 1) % items.length);
            }}
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        </>
      ) : null}
      {item.type === "video" ? (
        <video src={item.url} controls className="max-h-full max-w-full" />
      ) : (
        <img src={item.url} alt="" className="max-h-full max-w-full" />
      )}
    </div>
  );
}
