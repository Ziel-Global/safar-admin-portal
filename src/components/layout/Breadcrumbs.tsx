import { Fragment } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Crumb {
  label: string;
  to?: string;
}

/**
 * Lightweight breadcrumb trail for nested pages. The last item is rendered
 * as the current page (no link). Pass `to` only on intermediate crumbs.
 */
export function Breadcrumbs({ items, className }: { items: Crumb[]; className?: string }) {
  if (items.length === 0) return null;
  return (
    <nav
      aria-label="Breadcrumb"
      className={cn("mb-4 flex flex-wrap items-center gap-1 text-xs text-muted-foreground", className)}
    >
      {items.map((c, i) => {
        const isLast = i === items.length - 1;
        return (
          <Fragment key={`${c.label}-${i}`}>
            {c.to && !isLast ? (
              <Link
                to={c.to as "/"}
                className="rounded px-1.5 py-0.5 transition-colors hover:bg-secondary hover:text-foreground"
              >
                {c.label}
              </Link>
            ) : (
              <span
                className={cn("px-1.5 py-0.5", isLast && "font-medium text-foreground")}
                aria-current={isLast ? "page" : undefined}
              >
                {c.label}
              </span>
            )}
            {!isLast ? <ChevronRight className="h-3.5 w-3.5 opacity-60" /> : null}
          </Fragment>
        );
      })}
    </nav>
  );
}
