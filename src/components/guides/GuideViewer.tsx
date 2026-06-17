import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import type { Ritual, GuideType } from "@/lib/guides";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { RitualCard } from "./RitualCard";

export function GuideViewer({ guideType, rituals }: { guideType: GuideType; rituals: Ritual[] }) {
  const [index, setIndex] = useState(0);
  const total = rituals.length;
  const current = rituals[index];

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") setIndex((i) => Math.min(total - 1, i + 1));
      if (e.key === "ArrowLeft") setIndex((i) => Math.max(0, i - 1));
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [total]);

  // Touch swipe
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const onTouchStart = (e: React.TouchEvent) => setTouchStart(e.touches[0].clientX);
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStart === null) return;
    const diff = touchStart - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 60) {
      if (diff > 0) setIndex((i) => Math.min(total - 1, i + 1));
      else setIndex((i) => Math.max(0, i - 1));
    }
    setTouchStart(null);
  };

  if (!current) {
    return (
      <div className="rounded-lg border border-border bg-card p-10 text-center text-sm text-muted-foreground">
        Guide content is being prepared. Please check back shortly.
      </div>
    );
  }

  const title = guideType === "hajj" ? "Hajj Step-by-Step Guide" : "Umrah Step-by-Step Guide";
  const intro =
    guideType === "hajj"
      ? "A complete walkthrough of every Hajj ritual - from Ihram to Tawaf al-Wada."
      : "Everything you need to perform Umrah with confidence - Ihram, Tawaf, Sa'i and Halq.";

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">{intro}</p>
      </div>

      {/* Progress / chapter pills */}
      <nav aria-label="Ritual progress" className="mb-4">
        <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${((index + 1) / total) * 100}%` }}
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {rituals.map((r, i) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setIndex(i)}
              aria-current={i === index}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                i === index
                  ? "bg-primary text-primary-foreground"
                  : i < index
                    ? "bg-primary/15 text-primary hover:bg-primary/25"
                    : "bg-secondary text-muted-foreground hover:bg-secondary/80",
              )}
            >
              {i + 1}. {r.name}
            </button>
          ))}
        </div>
      </nav>

      {/* Card */}
      <div onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <RitualCard ritual={current} index={index} total={total} />
      </div>

      {/* Nav controls */}
      <div className="mt-6 flex items-center justify-between gap-3">
        <Button
          variant="outline"
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          disabled={index === 0}
        >
          <ChevronLeft className="mr-1 h-4 w-4" /> Previous
        </Button>
        <Link
          to="/guides/$guideType/$slug"
          params={{ guideType, slug: current.slug }}
          className="text-xs font-medium text-muted-foreground underline-offset-4 hover:text-primary hover:underline"
        >
          Open {current.name} page
        </Link>
        <Button
          onClick={() => setIndex((i) => Math.min(total - 1, i + 1))}
          disabled={index === total - 1}
        >
          Next <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </div>

      {/* CTA */}
      <div className="mt-10 rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10 p-6 text-center sm:p-8">
        <h3 className="text-xl font-bold text-foreground sm:text-2xl">
          Ready to plan your {guideType === "hajj" ? "Hajj" : "Umrah"}?
        </h3>
        <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
          Compare verified agents, transparent pricing and trusted reviews - all in one place.
        </p>
        <Button asChild size="lg" className="mt-5">
          <Link to="/search" search={{ type: guideType }}>
            <Search className="mr-2 h-4 w-4" /> Browse {guideType === "hajj" ? "Hajj" : "Umrah"} packages
          </Link>
        </Button>
      </div>
    </div>
  );
}
