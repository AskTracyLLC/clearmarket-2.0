import { ReactNode } from "react";
import { SiteFooter } from "@/components/SiteFooter";

interface AppLayoutProps {
  children: ReactNode;
  className?: string;
}

/**
 * Shared layout wrapper that ensures footer stays at bottom
 * Use this for all authenticated pages to maintain consistent layout
 */
export function AppLayout({ children, className = "" }: AppLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col">
      <main className={`flex-1 ${className}`}>
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
