/**
 * Supabase Storage image URL transformation utility.
 *
 * Supabase exposes on-the-fly image transformations via the `/render/image/`
 * path. We rewrite `/object/public/...` and `/object/sign/...` URLs to
 * `/render/image/public/...` and `/render/image/sign/...` and append
 * `width`, `height`, `quality`, and `resize` query params.
 *
 * Non-Supabase URLs (e.g. external hotel photos, data URIs) are returned
 * unchanged so they keep working without errors.
 */

export type ImageSize = "card" | "thumbnail" | "hero" | "avatar" | "avatar-sm";

export interface ImageTransformOptions {
  width?: number;
  height?: number;
  quality?: number;
  resize?: "cover" | "contain" | "fill";
}

const SIZE_PRESETS: Record<ImageSize, Required<Omit<ImageTransformOptions, "resize">> & { resize: "cover" | "contain" }> = {
  // Search result cards, agent directory cards, dashboard cards
  card: { width: 400, height: 300, quality: 75, resize: "cover" },
  // Small previews (review media thumbnails, gallery strip)
  thumbnail: { width: 160, height: 160, quality: 70, resize: "cover" },
  // Package detail hero image, gallery main slide
  hero: { width: 1200, height: 700, quality: 80, resize: "cover" },
  // Agent logo on profile card / package detail
  avatar: { width: 80, height: 80, quality: 75, resize: "cover" },
  // Header / very small avatars
  "avatar-sm": { width: 40, height: 40, quality: 60, resize: "cover" },
};

function isSupabaseStorageUrl(url: string): boolean {
  return /\/storage\/v1\/object\/(public|sign)\//.test(url);
}

/**
 * Rewrite a Supabase Storage URL to use the image-transformation endpoint
 * with the given size/quality. Non-Supabase URLs are returned as-is.
 */
export function getOptimizedImageUrl(
  url: string | null | undefined,
  options: ImageTransformOptions | { size: ImageSize },
): string | null {
  if (!url) return null;
  if (!isSupabaseStorageUrl(url)) return url;

  const opts: ImageTransformOptions =
    "size" in options ? SIZE_PRESETS[options.size] : options;

  const transformed = url.replace(
    /\/storage\/v1\/object\/(public|sign)\//,
    "/storage/v1/render/image/$1/",
  );

  const params = new URLSearchParams();
  if (opts.width) params.set("width", String(opts.width));
  if (opts.height) params.set("height", String(opts.height));
  if (opts.quality) params.set("quality", String(opts.quality));
  if (opts.resize) params.set("resize", opts.resize);

  const sep = transformed.includes("?") ? "&" : "?";
  return `${transformed}${sep}${params.toString()}`;
}

/** Convenience helper for size presets. */
export function optimizedFor(url: string | null | undefined, size: ImageSize) {
  return getOptimizedImageUrl(url, { size });
}
