import { useCallback, useEffect, useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AlertTriangle, Loader2, Star, Trash2, Upload, Video } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { compressImage } from "@/lib/image-compression";
import { cn } from "@/lib/utils";

export type MediaLabel =
  | "hotel_exterior"
  | "room"
  | "transport"
  | "meals"
  | "haram_proximity"
  | "general";

export interface PackageMediaItem {
  id: string;
  package_id: string;
  url: string;
  thumbnail_url: string | null;
  media_type: "photo" | "video";
  label: MediaLabel | null;
  sort_order: number;
  is_primary: boolean;
  moderation_status: string;
}

const LABEL_OPTIONS: { value: MediaLabel; label: string }[] = [
  { value: "hotel_exterior", label: "Hotel exterior" },
  { value: "room", label: "Room" },
  { value: "transport", label: "Transport" },
  { value: "meals", label: "Meals" },
  { value: "haram_proximity", label: "Haram proximity" },
  { value: "general", label: "General" },
];

const ACCEPTED_IMAGE = ["image/jpeg", "image/png", "image/webp"];
const ACCEPTED_VIDEO = ["video/mp4"];
const MAX_VIDEO_BYTES = 50 * 1024 * 1024; // 50MB

interface UploadState {
  id: string;
  name: string;
  progress: number;
  error?: string;
}

interface PackageMediaManagerProps {
  packageId: string;
  userId: string;
  onChange?: (items: PackageMediaItem[]) => void;
}

export function PackageMediaManager({ packageId, userId, onChange }: PackageMediaManagerProps) {
  const [items, setItems] = useState<PackageMediaItem[]>([]);
  const [uploads, setUploads] = useState<UploadState[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDragOver, setIsDragOver] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Fetch existing media
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("package_media")
        .select("*")
        .eq("package_id", packageId)
        .order("sort_order", { ascending: true });
      if (!cancelled) {
        if (error) toast.error(error.message);
        else setItems((data as PackageMediaItem[]) ?? []);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [packageId]);

  useEffect(() => {
    onChange?.(items);
  }, [items, onChange]);

  const handleFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const files = Array.from(fileList);
      for (const file of files) {
        const isImage = ACCEPTED_IMAGE.includes(file.type);
        const isVideo = ACCEPTED_VIDEO.includes(file.type);
        if (!isImage && !isVideo) {
          toast.error(`${file.name}: unsupported file type`);
          continue;
        }
        if (isVideo && file.size > MAX_VIDEO_BYTES) {
          toast.error(`${file.name}: video exceeds 50MB`);
          continue;
        }

        const uploadId = crypto.randomUUID();
        setUploads((u) => [...u, { id: uploadId, name: file.name, progress: 5 }]);

        try {
          // Compress images client-side
          let processed = file;
          if (isImage) {
            processed = await compressImage(file, { maxWidth: 1920, quality: 0.8 });
            setUploads((u) =>
              u.map((up) => (up.id === uploadId ? { ...up, progress: 30 } : up)),
            );
          }

          const ext = processed.name.split(".").pop() || (isVideo ? "mp4" : "jpg");
          const path = `${userId}/${packageId}/${crypto.randomUUID()}.${ext}`;

          const { error: uploadError } = await supabase.storage
            .from("package-media")
            .upload(path, processed, {
              cacheControl: "3600",
              upsert: false,
              contentType: processed.type,
            });
          if (uploadError) throw uploadError;

          setUploads((u) =>
            u.map((up) => (up.id === uploadId ? { ...up, progress: 75 } : up)),
          );

          const { data: pub } = supabase.storage.from("package-media").getPublicUrl(path);
          const publicUrl = pub.publicUrl;

          // Determine sort_order
          const nextOrder =
            items.length === 0 ? 0 : Math.max(...items.map((i) => i.sort_order)) + 1;
          const isFirst = items.length === 0 && uploads.length === 0;

          const { data: inserted, error: insertError } = await supabase
            .from("package_media")
            .insert({
              package_id: packageId,
              url: publicUrl,
              thumbnail_url: isImage ? publicUrl : null,
              media_type: isVideo ? "video" : "photo",
              sort_order: nextOrder,
              is_primary: isFirst,
              label: "general",
            })
            .select()
            .single();
          if (insertError) throw insertError;

          setItems((prev) => [...prev, inserted as PackageMediaItem]);
          setUploads((u) =>
            u.map((up) => (up.id === uploadId ? { ...up, progress: 100 } : up)),
          );
          // Remove progress entry shortly after completion
          setTimeout(
            () => setUploads((u) => u.filter((up) => up.id !== uploadId)),
            800,
          );
        } catch (err) {
          const message = err instanceof Error ? err.message : "Upload failed";
          toast.error(`${file.name}: ${message}`);
          setUploads((u) =>
            u.map((up) => (up.id === uploadId ? { ...up, progress: 100, error: message } : up)),
          );
          setTimeout(
            () => setUploads((u) => u.filter((up) => up.id !== uploadId)),
            3000,
          );
        }
      }
    },
    [items, packageId, uploads.length, userId],
  );

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      void handleFiles(e.target.files);
      e.target.value = "";
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files?.length) void handleFiles(e.dataTransfer.files);
  };

  const setPrimary = async (id: string) => {
    const prev = items;
    setItems((current) => current.map((i) => ({ ...i, is_primary: i.id === id })));
    const others = prev.filter((i) => i.id !== id && i.is_primary).map((i) => i.id);
    if (others.length > 0) {
      await supabase.from("package_media").update({ is_primary: false }).in("id", others);
    }
    const { error } = await supabase
      .from("package_media")
      .update({ is_primary: true })
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      setItems(prev);
    }
  };

  const updateLabel = async (id: string, label: MediaLabel) => {
    const prev = items;
    setItems((current) => current.map((i) => (i.id === id ? { ...i, label } : i)));
    const { error } = await supabase.from("package_media").update({ label }).eq("id", id);
    if (error) {
      toast.error(error.message);
      setItems(prev);
    }
  };

  const remove = async (id: string) => {
    const prev = items;
    const target = prev.find((i) => i.id === id);
    setItems((current) => current.filter((i) => i.id !== id));
    const { error } = await supabase.from("package_media").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      setItems(prev);
      return;
    }
    // Best-effort storage cleanup
    if (target) {
      const match = target.url.match(/\/package-media\/(.+)$/);
      if (match) await supabase.storage.from("package-media").remove([match[1]]);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((i) => i.id === active.id);
    const newIndex = items.findIndex((i) => i.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(items, oldIndex, newIndex).map((i, idx) => ({
      ...i,
      sort_order: idx,
    }));
    setItems(reordered);
    // Persist
    await Promise.all(
      reordered.map((i) =>
        supabase.from("package_media").update({ sort_order: i.sort_order }).eq("id", i.id),
      ),
    );
  };

  const approvedCount = items.filter((i) => i.moderation_status === "approved").length;
  const showWarning = !loading && approvedCount < 3;

  return (
    <div className="space-y-4">
      {showWarning && (
        <Alert variant="default" className="border-accent/40 bg-accent/10">
          <AlertTriangle className="h-4 w-4 text-accent-foreground" />
          <AlertTitle className="text-sm">Add more photos</AlertTitle>
          <AlertDescription className="text-xs">
            You need at least 3 approved images to publish this package. You currently have{" "}
            {approvedCount}.
          </AlertDescription>
        </Alert>
      )}

      <label
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={onDrop}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-muted/30 p-6 text-center transition hover:bg-muted/60",
          isDragOver && "border-primary bg-primary/5",
        )}
      >
        <Upload className="h-8 w-8 text-muted-foreground" />
        <div className="text-sm font-medium text-foreground">
          Drag & drop, or click to upload
        </div>
        <div className="text-xs text-muted-foreground">
          JPEG, PNG, WebP up to 1920px · MP4 up to 50MB
        </div>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,video/mp4"
          multiple
          className="hidden"
          onChange={onInputChange}
        />
      </label>

      {uploads.length > 0 && (
        <div className="space-y-2">
          {uploads.map((u) => (
            <div key={u.id} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="truncate text-foreground">{u.name}</span>
                <span className={cn("text-muted-foreground", u.error && "text-destructive")}>
                  {u.error ? u.error : `${u.progress}%`}
                </span>
              </div>
              <Progress value={u.progress} className="h-1.5" />
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : items.length > 0 ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={items.map((i) => i.id)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {items.map((item) => (
                <SortableMedia
                  key={item.id}
                  item={item}
                  onPrimary={setPrimary}
                  onLabel={updateLabel}
                  onRemove={remove}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      ) : null}
    </div>
  );
}

function SortableMedia({
  item,
  onPrimary,
  onLabel,
  onRemove,
}: {
  item: PackageMediaItem;
  onPrimary: (id: string) => void;
  onLabel: (id: string, label: MediaLabel) => void;
  onRemove: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative overflow-hidden rounded-md border border-border bg-card",
        item.is_primary && "ring-2 ring-primary",
      )}
    >
      <div
        {...attributes}
        {...listeners}
        className="relative aspect-square cursor-grab active:cursor-grabbing"
      >
        {item.media_type === "video" ? (
          <div className="flex h-full w-full items-center justify-center bg-muted">
            <Video className="h-8 w-8 text-muted-foreground" />
          </div>
        ) : (
          <img
            src={item.thumbnail_url ?? item.url}
            alt={item.label ?? "Package media"}
            className="h-full w-full object-cover"
            draggable={false}
          />
        )}
      </div>

      <button
        type="button"
        onClick={() => onPrimary(item.id)}
        className={cn(
          "absolute left-1.5 top-1.5 rounded-full bg-background/90 p-1.5 backdrop-blur transition hover:bg-background",
          item.is_primary && "bg-primary text-primary-foreground hover:bg-primary",
        )}
        aria-label={item.is_primary ? "Primary image" : "Set as primary"}
      >
        <Star
          className={cn("h-3.5 w-3.5", item.is_primary && "fill-current")}
        />
      </button>

      <button
        type="button"
        onClick={() => onRemove(item.id)}
        className="absolute right-1.5 top-1.5 rounded-full bg-background/90 p-1.5 text-destructive opacity-0 backdrop-blur transition hover:bg-background group-hover:opacity-100"
        aria-label="Remove"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>

      <div className="p-1.5">
        <Select
          value={item.label ?? "general"}
          onValueChange={(v) => onLabel(item.id, v as MediaLabel)}
        >
          <SelectTrigger className="h-7 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LABEL_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value} className="text-xs">
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
