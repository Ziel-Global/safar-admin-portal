/**
 * PageTransition — hides stale content during route transitions to prevent
 * the previous page's data from flashing before the new page loads.
 */
import * as React from "react";
import { useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export function PageTransition({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const isNavigating = useRouterState({
    select: (s) => s.isLoading || s.isTransitioning,
  });

  return (
    <div
      className={cn(
        "transition-opacity duration-150",
        isNavigating ? "opacity-0" : "opacity-100",
        className,
      )}
    >
      {children}
    </div>
  );
}
