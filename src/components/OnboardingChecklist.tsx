import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Circle } from "lucide-react";
import { Link } from "react-router-dom";

interface ChecklistItem {
  id: string;
  label: string;
  description?: string;
  done: boolean;
  link?: string;
}

interface OnboardingChecklistProps {
  title: string;
  items: ChecklistItem[];
  completedCount: number;
  totalCount: number;
}

/**
 * OnboardingChecklist component for showing user onboarding progress.
 * Displays completed steps with clickable links to complete remaining items.
 */
export const OnboardingChecklist = ({ 
  title, 
  items, 
  completedCount, 
  totalCount 
}: OnboardingChecklistProps) => {
  const percent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <Card className="p-6 bg-card border border-border">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        <span className="text-sm text-muted-foreground">
          {completedCount} of {totalCount} steps
        </span>
      </div>
      
      <div className="mb-4">
        <Progress value={percent} className="h-2" />
        <p className="text-xs text-muted-foreground mt-1">{percent}% complete</p>
      </div>

      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.id} className="flex items-start gap-3">
            {item.done ? (
              <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
            ) : (
              <Circle className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              {item.link && !item.done ? (
                <Link 
                  to={item.link} 
                  className="text-sm font-medium text-primary hover:underline"
                >
                  {item.label}
                </Link>
              ) : (
                <p className={`text-sm font-medium ${item.done ? 'text-foreground' : 'text-muted-foreground'}`}>
                  {item.label}
                </p>
              )}
              {item.description && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {item.description}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground mt-4 pt-3 border-t border-border">
        Updated in real-time as you complete each step
      </p>
    </Card>
  );
};
