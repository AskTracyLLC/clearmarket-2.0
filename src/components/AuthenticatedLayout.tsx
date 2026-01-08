import { ReactNode } from "react";
import { AppShell } from "@/components/layout/AppShell";

interface AuthenticatedLayoutProps {
  children: ReactNode;
  className?: string;
}

/**
 * Authenticated layout wrapper - now uses the new AppShell with sidebar navigation.
 * Kept for backwards compatibility with existing pages.
 */
export function AuthenticatedLayout({ children, className = "" }: AuthenticatedLayoutProps) {
  return (
    <AppShell className={className}>
      {children}
    </AppShell>
  );
}
