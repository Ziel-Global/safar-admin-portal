import { Link } from "@tanstack/react-router";
import { MoonStar } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

function buildColumns(isAgentOrAdmin: boolean) {
  return [
  {
    title: "Product",
    links: [
      { label: "Search Packages", to: "/search" },
      { label: "How It Works", to: "/about" },
      // Agent-only links are hidden for pilgrims and visitors.
      ...(isAgentOrAdmin
        ? [
            { label: "For Agents", to: "/agent/dashboard" },
            { label: "Pricing", to: "/pricing" },
          ]
        : []),
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Hajj Guide", to: "/guides/hajj" },
      { label: "Umrah Guide", to: "/guides/umrah" },
      { label: "Document Checklist", to: "/tools/checklist" },
      { label: "Emergency Contacts", to: "/tools/emergency" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About Us", to: "/about" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy Policy", to: "/privacy" },
      { label: "Terms of Service", to: "/terms" },
      { label: "Cookie Policy", to: "/cookies" },
    ],
  },
] as const;
}

export function Footer() {
  const { profile } = useAuth();
  const isAgentOrAdmin = profile?.role === "agent" || profile?.role === "admin";
  const columns = buildColumns(isAgentOrAdmin);
  return (
    <footer className="border-t border-border bg-secondary/40">
      <div className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-6">
          <div className="lg:col-span-2">
            <Link to="/" className="flex items-center gap-2 font-bold text-primary">
              <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <MoonStar className="h-5 w-5" />
              </span>
              <span className="text-xl tracking-tight">Safar</span>
            </Link>
            <p className="mt-4 max-w-sm text-sm text-muted-foreground">
              The trusted marketplace connecting pilgrims with verified Hajj and Umrah travel
              agents. Built with care for a journey of a lifetime.
            </p>
          </div>

          {columns.map((col) => (
            <div key={col.title}>
              <h3 className="text-sm font-semibold text-foreground">{col.title}</h3>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((link) => {
                  const highlight = link.label === "For Agents";
                  return (
                    <li key={link.label}>
                      <Link
                        to={link.to as "/"}
                        className={
                          highlight
                            ? "inline-flex min-h-[32px] items-center rounded-md bg-primary/10 px-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/15"
                            : "inline-flex min-h-[32px] items-center text-sm text-muted-foreground transition-colors hover:text-primary"
                        }
                      >
                        {link.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-start justify-between gap-3 border-t border-border pt-6 sm:flex-row sm:items-center">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Safar. All rights reserved.
          </p>
          <p className="text-xs text-muted-foreground">
            Made with care for pilgrims of Makkah & Madinah.
          </p>
        </div>
      </div>
    </footer>
  );
}
