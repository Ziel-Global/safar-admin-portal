import { useEffect, type ReactNode } from "react";
import { useNavigate, useLocation } from "@tanstack/react-router";
import { useAuth, type UserRole } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: ReactNode;
  /** If set, only users with this role may view; others are redirected to /unauthorised. */
  requireRole?: UserRole;
  /** Where to send unauthenticated users (default /login). */
  redirectTo?: string;
}

/**
 * Guard component for authenticated routes.
 * - While the auth context is loading, shows a centred spinner (no flash of login page).
 * - If unauthenticated, redirects to {redirectTo} preserving the current path as ?redirect=.
 * - If authenticated but the role doesn't match {requireRole}, redirects to /unauthorised.
 */
export function ProtectedRoute({ children, requireRole, redirectTo = "/login" }: ProtectedRouteProps) {
  const { loading, user, profile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Admin can access any role-gated route.
  const isAdmin = profile?.role === "admin";
  const roleMismatch =
    !!requireRole && !!profile && profile.role !== requireRole && !isAdmin;

  // For role-gated routes, the profile (which carries the role) must be loaded
  // before we can safely render. A signed-in user whose profile hasn't loaded
  // yet must NOT see the protected content, otherwise non-admins briefly (or
  // permanently, if the profile load lags behind `loading`) reach admin pages.
  const awaitingProfile = !!requireRole && !!user && !profile;

  useEffect(() => {
    if (loading) return;

    if (!user) {
      navigate({
        to: redirectTo,
        search: { redirect: location.href } as never,
        replace: true,
      });
      return;
    }

    if (roleMismatch) {
      navigate({ to: "/unauthorised" as never, replace: true });
    }
  }, [loading, user, roleMismatch, navigate, location.href, redirectTo]);

  // Only show the full-screen spinner on the very first auth check.
  // Once `user` is loaded, subsequent in-portal navigations render children
  // immediately without flashing a loader.
  if (loading && !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || roleMismatch || awaitingProfile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return <>{children}</>;
}
