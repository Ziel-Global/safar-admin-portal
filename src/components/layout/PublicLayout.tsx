import type { ReactNode } from "react";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { PageTransition } from "@/components/ui/page-transition";

export function PublicLayout({
  children,
  showFooter = true,
  staticHeader = false,
}: {
  children: ReactNode;
  showFooter?: boolean;
  staticHeader?: boolean;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header static={staticHeader} />
      <main className="flex-1">
        <PageTransition>{children}</PageTransition>
      </main>
      {showFooter ? <Footer /> : null}
    </div>
  );
}
