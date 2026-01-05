import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  /** 
   * Path to navigate back to. If provided, shows a back button.
   * Common patterns:
   * - "/dashboard" for main pages
   * - "/admin" for admin list pages
   * - "/admin/broadcasts" for admin detail pages
   * - "/vendor/seeking-coverage" for vendor detail pages
   */
  backTo?: string;
  /** 
   * Label for the back button. Defaults to "Back" or inferred from path.
   */
  backLabel?: string;
  /** @deprecated Use backTo="/dashboard" instead */
  showBackToDashboard?: boolean;
  children?: React.ReactNode;
}

/** 
 * Map common paths to friendly labels for back button 
 */
function getBackLabel(path: string): string {
  const labelMap: Record<string, string> = {
    "/dashboard": "Dashboard",
    "/admin": "Admin",
    "/admin/moderation": "Moderation",
    "/admin/broadcasts": "Broadcasts",
    "/admin/checklists": "Checklists",
    "/admin/help-articles": "Help Articles",
    "/admin/legal": "Legal & Help",
    "/vendor/seeking-coverage": "Seeking Coverage",
    "/vendor/my-reps": "My Reps",
    "/rep/my-vendors": "My Vendors",
    "/messages": "Messages",
    "/community": "Community",
  };
  return labelMap[path] || "Back";
}

export function PageHeader({ 
  title, 
  subtitle, 
  backTo,
  backLabel,
  showBackToDashboard = false,
  children 
}: PageHeaderProps) {
  // Support legacy showBackToDashboard prop
  const effectiveBackTo = backTo || (showBackToDashboard ? "/dashboard" : undefined);
  const effectiveLabel = backLabel || (effectiveBackTo ? getBackLabel(effectiveBackTo) : "Back");

  return (
    <div className="mb-6">
      {/* Desktop: title + button on same row */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{title}</h1>
          {subtitle && (
            <p className="text-muted-foreground mt-1">{subtitle}</p>
          )}
        </div>
        
        <div className="flex items-center gap-2 shrink-0">
          {effectiveBackTo && (
            <Link to={effectiveBackTo}>
              <Button variant="outline" size="sm" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                {effectiveLabel}
              </Button>
            </Link>
          )}
          {children}
        </div>
      </div>
    </div>
  );
}
