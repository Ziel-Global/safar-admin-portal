import type { ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { DashboardSidebar } from "./DashboardSidebar";
import { Button } from "@/components/ui/button";
import { PageTransition } from "@/components/ui/page-transition";
import { NotificationBell } from "@/components/notifications/NotificationBell";

type Variant = "pilgrim" | "agent";

export function DashboardLayout({
  children,
  variant,
  title,
  headerExtras,
}: {
  children: ReactNode;
  variant: Variant;
  title: string;
  headerExtras?: ReactNode;
}) {
  const isNavigating = useRouterState({
    select: (s) => s.isLoading || s.isTransitioning,
  });
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <DashboardSidebar variant={variant} />
        <div className="flex flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur">
            {/* Top-of-page indeterminate progress bar — appears the instant a nav starts */}
            <div
              aria-hidden
              className={`pointer-events-none absolute inset-x-0 top-0 h-0.5 overflow-hidden transition-opacity ${
                isNavigating ? "opacity-100" : "opacity-0"
              }`}
            >
              <div className="h-full w-1/3 animate-[route-progress_1s_ease-in-out_infinite] bg-primary" />
            </div>
            <SidebarTrigger />
            <h1 className="text-sm font-semibold text-foreground">{title}</h1>
            <div className="ml-auto flex items-center gap-2">
              {headerExtras}
              <NotificationBell />
              <Button asChild variant="outline" size="sm">
                <Link to="/">Back to site</Link>
              </Button>
            </div>
          </header>
          <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
            <PageTransition>{children}</PageTransition>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
