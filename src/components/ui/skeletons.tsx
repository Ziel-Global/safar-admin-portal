/**
 * Reusable skeleton components matching the layout of their loaded counterparts.
 * All use the diagonal shimmer animation defined in src/styles.css (.skeleton-shimmer).
 *
 * Style note: prefer `Shimmer` over the raw shadcn `Skeleton` in user-facing list views.
 * The shimmer reads as more polished while still being subtle.
 */
import * as React from "react";
import { cn } from "@/lib/utils";

export function Shimmer({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("skeleton-shimmer rounded-md", className)}
      aria-hidden="true"
      {...props}
    />
  );
}

/* ---------- PackageCardSkeleton ---------- */
/* Matches src/components/search/PackageCard.tsx exact layout. */
export function PackageCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <Shimmer className="aspect-[4/3] w-full rounded-none" />
      <div className="space-y-3 p-4">
        <Shimmer className="h-4 w-3/4" />
        <div className="flex flex-wrap gap-2">
          <Shimmer className="h-3 w-20" />
          <Shimmer className="h-4 w-24 rounded-full" />
          <Shimmer className="h-4 w-16 rounded-full" />
        </div>
        <div className="flex gap-2">
          <Shimmer className="h-3 w-24" />
          <Shimmer className="h-4 w-14 rounded-full" />
        </div>
        <div className="flex items-end justify-between border-t border-border pt-3">
          <div className="space-y-1.5">
            <Shimmer className="h-6 w-20" />
            <Shimmer className="h-3 w-12" />
          </div>
          <Shimmer className="h-3 w-16" />
        </div>
      </div>
    </div>
  );
}

export function PackageCardSkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <PackageCardSkeleton key={i} />
      ))}
    </div>
  );
}

/* ---------- AgentCardSkeleton ---------- */
export function AgentCardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <Shimmer className="h-12 w-12 rounded-full" />
        <div className="flex-1 space-y-2">
          <Shimmer className="h-4 w-2/3" />
          <Shimmer className="h-3 w-1/2" />
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Shimmer className="h-4 w-16 rounded-full" />
        <Shimmer className="h-4 w-20 rounded-full" />
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
        <Shimmer className="h-3 w-20" />
        <Shimmer className="h-3 w-16" />
      </div>
    </div>
  );
}

/* ---------- RfqCardSkeleton ---------- */
export function RfqCardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-2">
          <div className="flex gap-2">
            <Shimmer className="h-5 w-20 rounded-full" />
            <Shimmer className="h-5 w-14 rounded-full" />
          </div>
          <Shimmer className="h-4 w-40" />
        </div>
        <Shimmer className="h-3 w-12" />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <Shimmer className="h-3 w-32" />
        <Shimmer className="h-3 w-20" />
        <Shimmer className="h-3 w-24" />
        <Shimmer className="h-3 w-16 justify-self-end" />
      </div>
    </div>
  );
}

/* ---------- LeadCardSkeleton ---------- */
export function LeadCardSkeleton() {
  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-3 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <Shimmer className="h-4 w-28" />
        <Shimmer className="h-4 w-10 rounded-full" />
      </div>
      <Shimmer className="h-3 w-3/4" />
      <div className="flex gap-2">
        <Shimmer className="h-3 w-16" />
        <Shimmer className="h-3 w-14" />
      </div>
    </div>
  );
}

/* ---------- ReviewCardSkeleton ---------- */
export function ReviewCardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <Shimmer className="h-10 w-10 rounded-full" />
        <div className="flex-1 space-y-2">
          <Shimmer className="h-3.5 w-32" />
          <Shimmer className="h-3 w-20" />
        </div>
        <Shimmer className="h-4 w-16" />
      </div>
      <div className="mt-3 space-y-2">
        <Shimmer className="h-3 w-full" />
        <Shimmer className="h-3 w-11/12" />
        <Shimmer className="h-3 w-3/4" />
      </div>
    </div>
  );
}

/* ---------- KpiCardSkeleton ---------- */
export function KpiCardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <Shimmer className="h-3 w-24" />
        <Shimmer className="h-3 w-10" />
      </div>
      <div className="mt-2 flex items-end justify-between gap-2">
        <Shimmer className="h-8 w-20" />
        <Shimmer className="h-10 w-24 rounded-md" />
      </div>
    </div>
  );
}

/* ---------- TableRowSkeleton ---------- */
export function TableRowSkeleton({ columns = 4 }: { columns?: number }) {
  return (
    <tr className="border-b border-border">
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <Shimmer className="h-3 w-full max-w-[160px]" />
        </td>
      ))}
    </tr>
  );
}

export function TableBodySkeleton({
  rows = 5,
  columns = 4,
}: {
  rows?: number;
  columns?: number;
}) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <TableRowSkeleton key={i} columns={columns} />
      ))}
    </>
  );
}

/* ---------- Building blocks ---------- */
export function TextLineSkeleton({ className }: { className?: string }) {
  return <Shimmer className={cn("h-3 w-full", className)} />;
}

export function HeroImageSkeleton({ className }: { className?: string }) {
  return <Shimmer className={cn("aspect-[16/9] w-full rounded-xl", className)} />;
}
