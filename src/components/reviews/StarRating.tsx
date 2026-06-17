import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface StarRatingProps {
  value: number;
  onChange?: (v: number) => void;
  size?: "sm" | "md" | "lg" | "xl";
  readOnly?: boolean;
  className?: string;
}

const SIZE: Record<NonNullable<StarRatingProps["size"]>, string> = {
  sm: "h-3.5 w-3.5",
  md: "h-5 w-5",
  lg: "h-7 w-7",
  xl: "h-12 w-12",
};

export function StarRating({
  value,
  onChange,
  size = "md",
  readOnly,
  className,
}: StarRatingProps) {
  const interactive = !readOnly && !!onChange;
  return (
    <div className={cn("inline-flex items-center gap-1", className)}>
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= Math.round(value);
        return interactive ? (
          <button
            key={n}
            type="button"
            aria-label={`${n} star${n > 1 ? "s" : ""}`}
            className="rounded transition hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => onChange?.(n)}
          >
            <Star
              className={cn(
                SIZE[size],
                filled ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40",
              )}
            />
          </button>
        ) : (
          <Star
            key={n}
            className={cn(
              SIZE[size],
              filled ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30",
            )}
          />
        );
      })}
    </div>
  );
}
