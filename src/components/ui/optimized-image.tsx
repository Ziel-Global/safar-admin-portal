import { useState, type ImgHTMLAttributes, type CSSProperties } from "react";
import { ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { getOptimizedImageUrl, type ImageSize, type ImageTransformOptions } from "@/lib/imageUrl";

interface OptimizedImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "loading"> {
  /** Source URL. Supabase Storage URLs are auto-rewritten with transformations. */
  src: string | null | undefined;
  /** Required for accessibility. Pass empty string for purely decorative images. */
  alt: string;
  /** Preset that controls transformed width/height/quality. */
  size?: ImageSize;
  /** Manual override of transformation params. Wins over `size`. */
  transform?: ImageTransformOptions;
  /** Eager loading for above-the-fold images (LCP). Defaults to lazy. */
  eager?: boolean;
  /** Show the standard cream/beige shimmer placeholder while loading. */
  showPlaceholder?: boolean;
  /** Custom fallback content if the image fails to load. */
  fallback?: React.ReactNode;
  /** Tailwind classes applied to the wrapper element. */
  wrapperClassName?: string;
  /** Inline styles for wrapper (e.g., aspectRatio). */
  wrapperStyle?: CSSProperties;
}

/**
 * App-wide image component. Handles Supabase URL transformation, lazy loading,
 * crossfade-on-load with a shimmer placeholder, and an icon error fallback.
 *
 * Use this everywhere instead of raw <img> tags.
 */
export function OptimizedImage({
  src,
  alt,
  size,
  transform,
  eager = false,
  showPlaceholder = true,
  fallback,
  className,
  wrapperClassName,
  wrapperStyle,
  ...rest
}: OptimizedImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);

  const finalSrc = transform
    ? getOptimizedImageUrl(src, transform)
    : size
      ? getOptimizedImageUrl(src, { size })
      : src ?? null;

  const showFallback = errored || !finalSrc;

  return (
    <div
      className={cn(
        "relative overflow-hidden",
        showPlaceholder && !loaded && !showFallback && "bg-[#F5F0E8] image-shimmer",
        wrapperClassName,
      )}
      style={wrapperStyle}
    >
      {showFallback ? (
        fallback ?? (
          <div className="flex h-full w-full items-center justify-center bg-secondary text-muted-foreground">
            <ImageIcon className="h-8 w-8" aria-hidden />
          </div>
        )
      ) : (
        <img
          src={finalSrc!}
          alt={alt}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          fetchPriority={eager ? "high" : "auto"}
          onLoad={() => setLoaded(true)}
          onError={() => setErrored(true)}
          className={cn(
            "transition-opacity duration-300",
            loaded ? "opacity-100" : "opacity-0",
            className,
          )}
          {...rest}
        />
      )}
    </div>
  );
}
