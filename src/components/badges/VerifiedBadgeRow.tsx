import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { getBadgeIcon, type BadgeType } from "@/lib/badges";
import { cn } from "@/lib/utils";

export interface VerifiedBadgeItem {
  badge_type: string;
  type: BadgeType | null;
}

interface Props {
  items: VerifiedBadgeItem[];
  size?: "sm" | "md";
  className?: string;
}

export function VerifiedBadgeRow({ items, size = "md", className }: Props) {
  if (items.length === 0) return null;
  const dim = size === "sm" ? "h-6 w-6" : "h-8 w-8";
  const iconDim = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";
  return (
    <TooltipProvider delayDuration={150}>
      <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
        {items.map(({ badge_type, type }) => {
          if (!type) return null;
          const Icon = getBadgeIcon(type.icon_name);
          return (
            <Tooltip key={badge_type}>
              <TooltipTrigger asChild>
                <span
                  className={cn(
                    "grid shrink-0 place-content-center rounded-full border-2 border-card shadow-sm transition-transform hover:scale-110",
                    dim,
                  )}
                  style={{ backgroundColor: type.color_hex }}
                  aria-label={type.name}
                >
                  <Icon className={cn("text-white", iconDim)} />
                </span>
              </TooltipTrigger>
              <TooltipContent className="max-w-[260px]">
                <p className="text-xs font-semibold">{type.name}</p>
                {type.description ? (
                  <p className="mt-1 text-xs text-muted-foreground">{type.description}</p>
                ) : null}
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Verified by {type.authority}
                </p>
                {type.help_url ? (
                  <a
                    href={type.help_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-block text-[11px] font-semibold text-primary hover:underline"
                  >
                    Learn more →
                  </a>
                ) : null}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
