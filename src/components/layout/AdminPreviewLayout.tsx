import type { ReactNode } from "react";
import { PublicLayout } from "./PublicLayout";

/** Minimal chrome for admin preview routes (agents, packages, CMS pages). */
export function AdminPreviewLayout({ children }: { children: ReactNode }) {
  return (
    <PublicLayout showFooter={false} staticHeader>
      {children}
    </PublicLayout>
  );
}
