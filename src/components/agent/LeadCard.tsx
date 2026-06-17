import { CSS } from "@dnd-kit/utilities";
import { useSortable } from "@dnd-kit/sortable";
import { Calendar, GripVertical, Plane, Users, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { AGE_COLORS, ageBucket, ageLabel, type Lead } from "@/lib/leads";

const TYPE_ICON: Record<string, string> = {
  hajj: "🕋",
  umrah: "🕌",
};

interface LeadCardProps {
  lead: Lead;
  onClick: () => void;
  isOverlay?: boolean;
}

export function LeadCard({ lead, onClick, isOverlay }: LeadCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: lead.id,
    data: { lead },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const bucket = ageBucket(lead.created_at);
  const tripIcon = lead.trip_type ? (TYPE_ICON[lead.trip_type] ?? "✈️") : "✈️";

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={cn(
        "group cursor-pointer border border-border bg-card p-3 shadow-sm transition hover:border-primary/40 hover:shadow-md",
        isOverlay && "rotate-2 shadow-xl",
      )}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">
            {lead.pilgrim_name || "Anonymous"}
          </p>
          <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <span aria-hidden>{tripIcon}</span>
            <span className="capitalize">{lead.trip_type ?? "trip"}</span>
          </div>
        </div>
        <button
          type="button"
          aria-label="Drag lead"
          className="touch-none rounded p-1 text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:bg-secondary"
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="h-4 w-4" />
        </button>
      </div>

      <dl className="mt-3 space-y-1.5 text-xs text-foreground">
        {lead.departure_date ? (
          <div className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
            <span>{new Date(lead.departure_date).toLocaleDateString()}</span>
          </div>
        ) : null}
        {lead.group_size ? (
          <div className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-muted-foreground" />
            <span>
              {lead.group_size} traveller{lead.group_size > 1 ? "s" : ""}
            </span>
          </div>
        ) : null}
        {lead.budget_range ? (
          <div className="flex items-center gap-1.5">
            <Wallet className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="truncate">{lead.budget_range}</span>
          </div>
        ) : null}
      </dl>

      <div className="mt-3 flex items-center justify-between">
        <Badge variant="outline" className={cn("text-[10px]", AGE_COLORS[bucket])}>
          {ageLabel(lead.created_at)}
        </Badge>
        <Plane className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
    </Card>
  );
}
