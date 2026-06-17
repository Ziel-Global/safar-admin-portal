import { useState } from "react";
import { ChevronLeft, ChevronRight, ImageIcon, Expand } from "lucide-react";
import { cn } from "@/lib/utils";
import { MediaLightbox, type LightboxMedia } from "./MediaLightbox";
import { OptimizedImage } from "@/components/ui/optimized-image";

export function PackageGallery({ media }: { media: LightboxMedia[] }) {
  const [active, setActive] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const total = media.length;

  if (total === 0) {
    return (
      <div className="flex aspect-[16/7] w-full items-center justify-center rounded-2xl bg-gradient-to-br from-primary/15 to-accent/15 text-muted-foreground">
        <ImageIcon className="h-12 w-12" />
      </div>
    );
  }

  const item = media[active];
  const next = () => setActive((i) => (i + 1) % total);
  const prev = () => setActive((i) => (i - 1 + total) % total);

  return (
    <>
      <div className="relative overflow-hidden rounded-2xl bg-secondary">
        <button
          type="button"
          onClick={() => setLightboxOpen(true)}
          className="group block aspect-[16/9] w-full"
          aria-label="Open gallery"
        >
          {item.media_type === "video" ? (
            <video src={item.url} className="h-full w-full object-cover" muted />
          ) : (
            <OptimizedImage
              src={item.url}
              alt={item.label || "Package image"}
              size="hero"
              eager
              wrapperClassName="absolute inset-0 h-full w-full"
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
            />
          )}
          <span className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-black/55 px-3 py-1.5 text-xs font-medium text-white backdrop-blur">
            <Expand className="h-3.5 w-3.5" /> View gallery
          </span>
        </button>

        {total > 1 ? (
          <>
            <button
              type="button"
              onClick={prev}
              aria-label="Previous image"
              className="absolute left-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-content-center rounded-full bg-background/90 text-foreground shadow-md backdrop-blur transition hover:bg-background"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={next}
              aria-label="Next image"
              className="absolute right-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-content-center rounded-full bg-background/90 text-foreground shadow-md backdrop-blur transition hover:bg-background"
            >
              <ChevronRight className="h-5 w-5" />
            </button>

            <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
              {media.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setActive(i)}
                  aria-label={`Show image ${i + 1}`}
                  className={cn(
                    "h-1.5 rounded-full bg-white/70 transition-all",
                    i === active ? "w-6 bg-white" : "w-1.5 hover:bg-white",
                  )}
                />
              ))}
            </div>
          </>
        ) : null}
      </div>

      {total > 1 ? (
        <div className="mt-3 grid grid-cols-5 gap-2 sm:grid-cols-8">
          {media.slice(0, 8).map((m, i) => (
            <button
              key={m.url}
              type="button"
              onClick={() => setActive(i)}
              className={cn(
                "relative aspect-square overflow-hidden rounded-md border-2 transition",
                i === active ? "border-primary" : "border-transparent opacity-75 hover:opacity-100",
              )}
              aria-label={`Show image ${i + 1}`}
            >
              {m.media_type === "video" ? (
                <video src={m.url} className="h-full w-full object-cover" muted />
              ) : (
                <OptimizedImage
                  src={m.url}
                  alt=""
                  size="thumbnail"
                  wrapperClassName="absolute inset-0 h-full w-full"
                  className="h-full w-full object-cover"
                />
              )}
            </button>
          ))}
        </div>
      ) : null}

      {lightboxOpen ? (
        <MediaLightbox
          items={media}
          index={active}
          onClose={() => setLightboxOpen(false)}
          onPrev={prev}
          onNext={next}
        />
      ) : null}
    </>
  );
}
