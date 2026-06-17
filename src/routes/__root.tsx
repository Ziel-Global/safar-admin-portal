import {
  Outlet,
  Link,
  redirect,
  createRootRouteWithContext,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/contexts/AuthContext";
import { CurrencyProvider } from "@/contexts/CurrencyContext";

import appCss from "../styles.css?url";

interface RouterContext {
  queryClient: QueryClient;
}

const ADMIN_ALLOWED_PATHS = new Set([
  "/login",
  "/forgot-password",
  "/reset-password",
  "/unauthorised",
]);

function isAllowedPath(pathname: string): boolean {
  if (pathname.startsWith("/admin")) return true;
  if (pathname.startsWith("/agents/")) return true;
  if (pathname.startsWith("/packages/")) return true;
  if (pathname.startsWith("/pages/")) return true;
  if (pathname.startsWith("/api/")) return true;
  return ADMIN_ALLOWED_PATHS.has(pathname);
}

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/admin"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go to admin
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<RouterContext>()({
  beforeLoad: ({ location }) => {
    if (!isAllowedPath(location.pathname)) {
      throw redirect({ to: "/admin", replace: true });
    }
  },
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Ana Safir - Trusted Hajj & Umrah Packages" },
      {
        name: "description",
        content:
          "Safar is the trusted marketplace for Hajj and Umrah pilgrims to discover, compare, and book verified packages from licensed travel agents.",
      },
      { name: "author", content: "Safar" },
      { property: "og:title", content: "Ana Safir - Trusted Hajj & Umrah Packages" },
      {
        property: "og:description",
        content:
          "Find your trusted path to Makkah & Madinah. Compare verified Hajj and Umrah packages from licensed agents.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:site", content: "@Safar" },
      { name: "theme-color", content: "#0f766e" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-title", content: "Safar" },
      { name: "twitter:title", content: "Ana Safir - Trusted Hajj & Umrah Packages" },
      { name: "description", content: "Ana Safir: Your Sacred Journey is a Hajj & Umrah travel marketplace app." },
      { property: "og:description", content: "Ana Safir: Your Sacred Journey is a Hajj & Umrah travel marketplace app." },
      { name: "twitter:description", content: "Ana Safir: Your Sacred Journey is a Hajj & Umrah travel marketplace app." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/2d62e69a-d5c7-41bd-9944-a0111928e30b/id-preview-e38e05d4--b48ec71f-046a-4006-a0c1-ce1ac58a4145.lovable.app-1776694017345.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/2d62e69a-d5c7-41bd-9944-a0111928e30b/id-preview-e38e05d4--b48ec71f-046a-4006-a0c1-ce1ac58a4145.lovable.app-1776694017345.png" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "icon", href: "/favicon.ico" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <CurrencyProvider>
          <Outlet />
          <Toaster richColors position="top-right" />
        </CurrencyProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
