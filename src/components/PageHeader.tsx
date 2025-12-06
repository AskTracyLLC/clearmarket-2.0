import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  showBackToDashboard?: boolean;
  children?: React.ReactNode;
}

export function PageHeader({ 
  title, 
  subtitle, 
  showBackToDashboard = false,
  children 
}: PageHeaderProps) {
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
        
        {showBackToDashboard && (
          <Link to="/dashboard" className="shrink-0">
            <Button variant="outline" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Button>
          </Link>
        )}
        
        {children}
      </div>
    </div>
  );
}
