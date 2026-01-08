import { useLocation, Link } from "react-router-dom";
import { ChevronRight, Home } from "lucide-react";
import { cn } from "@/lib/utils";

interface Breadcrumb {
  label: string;
  path?: string;
}

interface TopHeaderProps {
  title: string;
  subtitle?: string;
  breadcrumbs?: Breadcrumb[];
  actions?: React.ReactNode;
}

// Map paths to friendly labels
const pathLabels: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/messages": "Messages",
  "/community": "Community",
  "/safety": "Safety Center",
  "/coverage-map": "Coverage Map",
  "/tools": "Tools",
  "/settings": "Settings",
  "/help": "Help Center",
  "/vendor/seeking-coverage": "Seeking Coverage",
  "/vendor/my-reps": "My Reps",
  "/vendor/interested-reps": "Interested Reps",
  "/vendor/proposals": "Proposals",
  "/vendor/credits": "Credits",
  "/vendor/reviews": "Reviews",
  "/vendor/profile": "Profile",
  "/rep/find-work": "Find Work",
  "/rep/my-vendors": "My Vendors",
  "/rep/reviews": "Reviews",
  "/rep/profile": "Profile",
  "/work-setup": "My Coverage",
  "/admin/moderation": "Moderation",
  "/admin/users": "Users",
  "/admin/broadcasts": "Broadcasts",
  "/admin/support": "Support",
  "/admin/reports": "Reports",
};

function generateBreadcrumbs(pathname: string): Breadcrumb[] {
  const parts = pathname.split("/").filter(Boolean);
  const breadcrumbs: Breadcrumb[] = [{ label: "Home", path: "/dashboard" }];

  let currentPath = "";
  for (const part of parts) {
    currentPath += `/${part}`;
    const label = pathLabels[currentPath] || part.charAt(0).toUpperCase() + part.slice(1).replace(/-/g, " ");
    breadcrumbs.push({ label, path: currentPath });
  }

  return breadcrumbs;
}

export function TopHeader({ title, subtitle, breadcrumbs, actions }: TopHeaderProps) {
  const location = useLocation();
  const autoBreadcrumbs = breadcrumbs || generateBreadcrumbs(location.pathname);

  return (
    <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-40">
      <div className="px-6 py-4">
        {/* Breadcrumbs */}
        {autoBreadcrumbs.length > 1 && (
          <nav className="flex items-center gap-1.5 text-sm text-muted-foreground mb-2">
            {autoBreadcrumbs.map((crumb, index) => (
              <span key={crumb.path || index} className="flex items-center gap-1.5">
                {index > 0 && <ChevronRight className="h-3.5 w-3.5" />}
                {index === 0 && <Home className="h-3.5 w-3.5" />}
                {crumb.path && index < autoBreadcrumbs.length - 1 ? (
                  <Link
                    to={crumb.path}
                    className="hover:text-foreground transition-colors"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span className={cn(index === autoBreadcrumbs.length - 1 && "text-foreground font-medium")}>
                    {crumb.label}
                  </span>
                )}
              </span>
            ))}
          </nav>
        )}

        {/* Title and actions row */}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-foreground truncate">{title}</h1>
            {subtitle && (
              <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
            )}
          </div>
          {actions && (
            <div className="flex items-center gap-2 shrink-0">
              {actions}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
