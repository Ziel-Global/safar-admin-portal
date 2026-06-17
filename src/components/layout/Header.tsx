import { Link, useLocation } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { UserMenu } from "@/components/auth/UserMenu";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { useScrollPosition } from "@/hooks/use-scroll-position";
import { cn } from "@/lib/utils";

function Logo({ compact }: { compact: boolean }) {
  return (
    <Link to="/admin" className="flex items-center gap-2.5 font-bold text-primary">
      <span
        className={cn(
          "flex shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground transition-all duration-300",
          compact ? "h-7 w-7" : "h-9 w-9",
        )}
      >
        <ShieldAlert className={cn("transition-all duration-300", compact ? "h-3.5 w-3.5" : "h-5 w-5")} />
      </span>
      <span
        className={cn(
          "tracking-tight transition-all duration-300",
          compact ? "text-base" : "text-xl",
        )}
      >
        Safar Admin
      </span>
    </Link>
  );
}

export function Header({ static: isStatic = false }: { static?: boolean }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  const scrollY = useScrollPosition();
  const isScrolled = !isStatic && scrollY > 50;
  const isAuthPage = ["/login", "/forgot-password", "/reset-password"].includes(location.pathname);

  return (
    <>
      <div aria-hidden className="h-[72px] w-full" />

      <header
        className={cn(
          "fixed inset-x-0 z-50 flex justify-center",
          !isStatic && "transition-all duration-300 ease-in-out",
          isScrolled ? "top-3 px-4" : "top-0 px-0",
        )}
      >
        <div
          className={cn(
            "flex w-full items-center justify-between",
            !isStatic && "transition-all duration-300 ease-in-out",
            isScrolled
              ? "h-14 max-w-[900px] rounded-full border border-white/30 bg-background/90 px-5 shadow-[0_4px_30px_rgba(0,0,0,0.08)] backdrop-blur-xl supports-[backdrop-filter]:bg-background/80"
              : "h-[72px] max-w-7xl border-b border-border bg-background/95 px-4 backdrop-blur-xl supports-[backdrop-filter]:bg-background/85 sm:px-6 lg:px-8",
          )}
        >
          <Logo compact={isScrolled} />

          <div className="flex items-center gap-2">
            {loading || isAuthPage ? null : user ? (
              <>
                <NotificationBell />
                <UserMenu />
              </>
            ) : (
              <Button
                asChild
                variant="ghost"
                size={isScrolled ? "sm" : "default"}
                className="text-foreground transition-all duration-300 hover:text-primary"
              >
                <Link to="/login">Login</Link>
              </Button>
            )}
          </div>
        </div>
      </header>
    </>
  );
}
