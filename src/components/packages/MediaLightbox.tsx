import { useEffect } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

export interface LightboxMedia {
  url: string;
  media_type: string;
  label?: string | null;
}

export function MediaLightbox({
  items,
  index,
  onClose,
  onPrev,
  onNext,
}: {
  items: LightboxMedia[];
  index: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") onPrev();
      if (e.key === "ArrowRight") onNext();
    };
    window.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [onClose, onPrev, onNext]);

  const item = items[index];
  if (!item) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4">
      <button
        type="button"
        onClick={onClose}
        aria-label="Close gallery"
        className="absolute right-4 top-4 grid h-10 w-10 place-content-center rounded-full bg-white/10 text-white backdrop-blur transition hover:bg-white/20"
      >
        <X className="h-5 w-5" />
      </button>

      {items.length > 1 ? (
        <>
          <button
            type="button"
            onClick={onPrev}
            aria-label="Previous"
            className="absolute left-4 top-1/2 grid h-12 w-12 -translate-y-1/2 place-content-center rounded-full bg-white/10 text-white backdrop-blur transition hover:bg-white/20"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            type="button"
            onClick={onNext}
            aria-label="Next"
            className="absolute right-4 top-1/2 grid h-12 w-12 -translate-y-1/2 place-content-center rounded-full bg-white/10 text-white backdrop-blur transition hover:bg-white/20"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        </>
      ) : null}

      <div className="flex max-h-full max-w-6xl items-center justify-center">
        {item.media_type === "video" ? (
          <video
            key={item.url}
            src={item.url}
            controls
            autoPlay
            className="max-h-[85vh] max-w-full rounded-lg"
          />
        ) : (
          <img
            key={item.url}
            src={item.url}
            alt={item.label || "Package image"}
            className="max-h-[85vh] max-w-full rounded-lg object-contain"
          />
        )}
      </div>

      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-white/10 px-4 py-1.5 text-xs font-medium text-white backdrop-blur">
        {index + 1} / {items.length}
      </div>
    </div>
  );
}
