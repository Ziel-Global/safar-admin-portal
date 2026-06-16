/**
 * Client-side image compression using Canvas.
 * Resizes to a max width and re-encodes as JPEG/WebP at the given quality.
 */
export async function compressImage(
  file: File,
  options: { maxWidth?: number; quality?: number; mimeType?: string } = {},
): Promise<File> {
  const { maxWidth = 1920, quality = 0.8, mimeType = "image/jpeg" } = options;

  // Skip compression for non-image inputs
  if (!file.type.startsWith("image/")) return file;

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to load image"));
    image.src = dataUrl;
  });

  const scale = Math.min(1, maxWidth / img.width);
  const targetWidth = Math.round(img.width * scale);
  const targetHeight = Math.round(img.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, mimeType, quality),
  );
  if (!blob) return file;

  const newName = file.name.replace(/\.[^.]+$/, "") + (mimeType === "image/webp" ? ".webp" : ".jpg");
  return new File([blob], newName, { type: mimeType, lastModified: Date.now() });
}
