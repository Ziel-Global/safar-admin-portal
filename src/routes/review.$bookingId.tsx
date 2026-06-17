import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { AlertTriangle, ArrowLeft, ArrowRight, Camera, CheckCircle2, Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { StarRating } from "@/components/reviews/StarRating";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { compressImage } from "@/lib/image-compression";
import { supabase } from "@/integrations/supabase/client";
import {
  averageRating,
  MAX_PHOTOS,
  MAX_VIDEOS,
  REVIEW_DIMENSIONS,
  type DimensionScores,
} from "@/lib/reviews";

export const Route = createFileRoute("/review/$bookingId")({
  head: () => ({
    meta: [
      { title: "Share your review - Safar" },
      { name: "description", content: "Tell other pilgrims about your trip." },
    ],
  }),
  component: ReviewPage,
  errorComponent: ReviewErrorComponent,
});

function ReviewErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  return (
    <PublicLayout>
      <Card className="mx-auto mt-12 max-w-md">
        <CardContent className="p-8 text-center">
          <AlertTriangle className="mx-auto h-10 w-10 text-amber-500" />
          <p className="mt-3 text-base font-semibold">We couldn't open this review</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Something went wrong while loading your review. Please try again.
          </p>
          {import.meta.env.DEV && error?.message ? (
            <pre className="mt-3 max-h-32 overflow-auto rounded-md bg-muted p-2 text-left font-mono text-xs text-destructive">
              {error.message}
            </pre>
          ) : null}
          <div className="mt-4 flex items-center justify-center gap-3">
            <Button
              onClick={() => {
                router.invalidate();
                reset();
              }}
            >
              Try again
            </Button>
            <Button asChild variant="outline">
              <Link to="/dashboard">Back to dashboard</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </PublicLayout>
  );
}

interface BookingDetails {
  id: string;
  agent_id: string;
  package_id: string | null;
  pilgrim_id: string;
  trip_end: string | null;
  agent_name: string | null;
}

interface MediaItem {
  file: File;
  preview: string;
  type: "photo" | "video";
}

function ReviewPage() {
  return (
    <ProtectedRoute requireRole="pilgrim">
      <ReviewContent />
    </ProtectedRoute>
  );
}

function ReviewContent() {
  const { bookingId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [booking, setBooking] = useState<BookingDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [existingReviewId, setExistingReviewId] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [scores, setScores] = useState<DimensionScores>({});
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [reviewText, setReviewText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // 0 intro, 1-5 dimensions, 6 media, 7 summary
  const TOTAL_STEPS = 8;

  useEffect(() => {
    if (!user) return;
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const [bookingRes, reviewRes] = await Promise.all([
          supabase
            .from("bookings")
            .select("id, agent_id, package_id, pilgrim_id, trip_end, agents:agent_id(business_name)")
            .eq("id", bookingId)
            .eq("pilgrim_id", user.id)
            .maybeSingle(),
          supabase
            .from("reviews")
            .select("id")
            .eq("booking_id", bookingId)
            .eq("pilgrim_id", user.id)
            .maybeSingle(),
        ]);
        if (!active) return;
        if (bookingRes.error) console.error("Failed to load booking", bookingRes.error);
        if (reviewRes.error) console.error("Failed to load existing review", reviewRes.error);
        const row = bookingRes.data as
          | (Omit<BookingDetails, "agent_name"> & { agents: { business_name: string } | null })
          | null;
        if (row) {
          setBooking({
            id: row.id,
            agent_id: row.agent_id,
            package_id: row.package_id,
            pilgrim_id: row.pilgrim_id,
            trip_end: row.trip_end,
            agent_name: row.agents?.business_name ?? null,
          });
        } else {
          setBooking(null);
        }
        setExistingReviewId(reviewRes.data?.id ?? null);
      } catch (err) {
        if (active) console.error("Unexpected error loading review page", err);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [bookingId, user]);

  const setDimension = (key: (typeof REVIEW_DIMENSIONS)[number]["key"], rating: number) => {
    setScores((s) => ({ ...s, [key]: { ...s[key], rating } }));
  };
  const setComment = (key: (typeof REVIEW_DIMENSIONS)[number]["key"], comment: string) => {
    setScores((s) => ({
      ...s,
      [key]: { rating: s[key]?.rating ?? 0, comment },
    }));
  };

  async function handleFiles(files: FileList | null) {
    if (!files) return;
    const photos = media.filter((m) => m.type === "photo").length;
    const videos = media.filter((m) => m.type === "video").length;
    const next: MediaItem[] = [];
    for (const file of Array.from(files)) {
      const isVideo = file.type.startsWith("video/");
      if (isVideo && videos + next.filter((m) => m.type === "video").length >= MAX_VIDEOS) {
        toast.error(`Max ${MAX_VIDEOS} videos`);
        continue;
      }
      if (!isVideo && photos + next.filter((m) => m.type === "photo").length >= MAX_PHOTOS) {
        toast.error(`Max ${MAX_PHOTOS} photos`);
        continue;
      }
      const processed = isVideo ? file : await compressImage(file).catch(() => file);
      next.push({
        file: processed,
        preview: URL.createObjectURL(processed),
        type: isVideo ? "video" : "photo",
      });
    }
    setMedia((m) => [...m, ...next]);
  }

  function removeMedia(idx: number) {
    setMedia((m) => {
      const copy = [...m];
      URL.revokeObjectURL(copy[idx].preview);
      copy.splice(idx, 1);
      return copy;
    });
  }

  async function submit() {
    if (!booking || !user) return;
    const overall = averageRating(scores);
    if (overall === 0) {
      toast.error("Please rate at least one dimension");
      return;
    }
    setSubmitting(true);
    try {
      const dimensionsJson: Record<string, { rating: number; comment?: string }> = {};
      for (const d of REVIEW_DIMENSIONS) {
        const s = scores[d.key];
        if (s?.rating) dimensionsJson[d.key] = s;
      }

      const { data: review, error } = await supabase
        .from("reviews")
        .insert({
          pilgrim_id: user.id,
          agent_id: booking.agent_id,
          package_id: booking.package_id,
          booking_id: booking.id,
          overall_rating: overall,
          dimensions: dimensionsJson,
          review_text: reviewText.trim() || null,
        })
        .select("id")
        .single();
      if (error) throw error;

      // Upload media
      for (const m of media) {
        const ext = m.file.name.split(".").pop() || (m.type === "video" ? "mp4" : "jpg");
        const path = `${user.id}/${review.id}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("review-media")
          .upload(path, m.file, { contentType: m.file.type, upsert: false });
        if (upErr) {
          console.error(upErr);
          continue;
        }
        const { data: pub } = supabase.storage.from("review-media").getPublicUrl(path);
        await supabase.from("review_media").insert({
          review_id: review.id,
          media_type: m.type,
          url: pub.publicUrl,
        });
      }

      toast.success("Thanks for your review!");
      navigate({ to: "/dashboard" });
    } catch (err) {
      console.error(err);
      toast.error("Could not submit review", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <PublicLayout>
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </PublicLayout>
    );
  }

  if (!booking || booking.pilgrim_id !== user?.id) {
    return (
      <PublicLayout>
        <Card className="mx-auto mt-12 max-w-md">
          <CardContent className="p-8 text-center">
            <p className="text-base font-semibold">Booking not found</p>
            <p className="mt-1 text-sm text-muted-foreground">
              This booking does not exist or is not yours to review.
            </p>
            <Button asChild className="mt-4">
              <Link to="/dashboard">Back to dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      </PublicLayout>
    );
  }

  if (existingReviewId) {
    return (
      <PublicLayout>
        <Card className="mx-auto mt-12 max-w-md">
          <CardContent className="p-8 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
            <p className="mt-3 text-base font-semibold">You've already reviewed this trip</p>
            <p className="mt-1 text-sm text-muted-foreground">Thanks for sharing your story!</p>
            <Button asChild className="mt-4">
              <Link to="/dashboard">Back to dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      </PublicLayout>
    );
  }

  if (booking.trip_end && new Date(booking.trip_end) >= new Date()) {
    return (
      <PublicLayout>
        <Card className="mx-auto mt-12 max-w-md">
          <CardContent className="p-8 text-center">
            <p className="text-base font-semibold">Trip not finished yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              You can write a review once your trip is complete.
            </p>
            <Button asChild className="mt-4">
              <Link to="/dashboard">Back to dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      </PublicLayout>
    );
  }

  const dimensionStep = step >= 1 && step <= 5;
  const currentDimension = dimensionStep ? REVIEW_DIMENSIONS[step - 1] : null;

  return (
    <PublicLayout>
      <div className="mx-auto w-full max-w-xl px-4 py-8 pb-32">
        <Progress value={((step + 1) / TOTAL_STEPS) * 100} className="mb-6 h-1" />

        {step === 0 ? (
          <Card>
            <CardContent className="p-6 text-center sm:p-10">
              <span className="text-5xl">🕋</span>
              <h1 className="mt-4 text-2xl font-bold">Welcome back!</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                How was your journey with {booking.agent_name ?? "your agent"}? Your honest review
                helps other pilgrims choose well.
              </p>
              <p className="mt-4 text-xs text-muted-foreground">Takes about 2 minutes.</p>
            </CardContent>
          </Card>
        ) : null}

        {currentDimension ? (
          <Card>
            <CardContent className="p-6 sm:p-10">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                Step {step} of 5
              </p>
              <h2 className="mt-1 text-xl font-bold">{currentDimension.label}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{currentDimension.prompt}</p>

              <div className="mt-6 flex justify-center">
                <StarRating
                  size="xl"
                  value={scores[currentDimension.key]?.rating ?? 0}
                  onChange={(v) => setDimension(currentDimension.key, v)}
                />
              </div>

              <div className="mt-6">
                <label className="text-xs uppercase text-muted-foreground">
                  Want to add a note?
                </label>
                <Input
                  value={scores[currentDimension.key]?.comment ?? ""}
                  onChange={(e) => setComment(currentDimension.key, e.target.value)}
                  placeholder="Optional one-liner"
                  className="mt-1"
                />
              </div>
            </CardContent>
          </Card>
        ) : null}

        {step === 6 ? (
          <Card>
            <CardContent className="p-6 sm:p-10">
              <h2 className="text-xl font-bold">Add photos or videos</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Up to {MAX_PHOTOS} photos and {MAX_VIDEOS} videos. Share your hotel room, meals,
                transport - anything that brings the trip to life.
              </p>

              <label className="mt-6 flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-secondary/30 p-8 text-center transition hover:border-primary hover:bg-primary/5">
                <Upload className="h-8 w-8 text-muted-foreground" />
                <span className="mt-2 text-sm font-medium">Tap to upload</span>
                <span className="text-xs text-muted-foreground">or drag and drop</span>
                <input
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  className="hidden"
                  onChange={(e) => handleFiles(e.target.files)}
                />
              </label>

              {media.length > 0 ? (
                <div className="mt-4 grid grid-cols-3 gap-2">
                  {media.map((m, i) => (
                    <div
                      key={m.preview}
                      className="group relative aspect-square overflow-hidden rounded-md border border-border"
                    >
                      {m.type === "photo" ? (
                        <img src={m.preview} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <video src={m.preview} className="h-full w-full object-cover" />
                      )}
                      <button
                        type="button"
                        onClick={() => removeMedia(i)}
                        className="absolute right-1 top-1 rounded-full bg-background/90 p-1 text-foreground opacity-0 transition group-hover:opacity-100"
                        aria-label="Remove"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                  <Camera className="h-3.5 w-3.5" /> No media added yet (optional)
                </div>
              )}
            </CardContent>
          </Card>
        ) : null}

        {step === 7 ? (
          <Card>
            <CardContent className="p-6 sm:p-10">
              <h2 className="text-xl font-bold">Final touches</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Anything else you'd like other pilgrims to know?
              </p>

              <Textarea
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
                rows={5}
                placeholder="Share your overall experience..."
                className="mt-4"
              />

              <div className="mt-6 rounded-lg border border-border bg-secondary/30 p-4 text-center">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">
                  Your overall rating
                </p>
                <p className="mt-1 text-4xl font-bold">{averageRating(scores).toFixed(1)}</p>
                <div className="mt-2 flex justify-center">
                  <StarRating value={averageRating(scores)} size="md" readOnly />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Auto-calculated from your dimension ratings
                </p>
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>

      {/* Sticky nav */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-xl items-center justify-between gap-2">
          <Button
            variant="outline"
            disabled={step === 0 || submitting}
            onClick={() => setStep((s) => Math.max(0, s - 1))}
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          {step < TOTAL_STEPS - 1 ? (
            <Button
              onClick={() => setStep((s) => s + 1)}
              disabled={dimensionStep && !scores[REVIEW_DIMENSIONS[step - 1].key]?.rating}
            >
              Next <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={submit} disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit review"}
            </Button>
          )}
        </div>
      </div>
    </PublicLayout>
  );
}
