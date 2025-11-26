import { Card } from "@/components/ui/card";
import { Lock } from "lucide-react";

interface ComingSoonCardProps {
  title: string;
  description: string;
  icon?: React.ReactNode;
}

/**
 * ComingSoonCard component for MVP features that are not yet implemented.
 * Shows a locked state with clear messaging about future availability.
 */
export const ComingSoonCard = ({ title, description, icon }: ComingSoonCardProps) => {
  return (
    <Card className="p-6 bg-card-elevated border border-border opacity-60 cursor-not-allowed">
      <div className="flex items-start gap-4">
        {icon && <div className="text-muted-foreground">{icon}</div>}
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-lg font-semibold text-foreground">{title}</h3>
            <Lock className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground mb-2">{description}</p>
          <p className="text-xs text-secondary font-medium">Coming Soon</p>
        </div>
      </div>
    </Card>
  );
};
