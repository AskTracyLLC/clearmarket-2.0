import { Card } from "@/components/ui/card";
import { CheckCircle2, Circle } from "lucide-react";

interface ChecklistItem {
  id: string;
  label: string;
  completed: boolean;
  comingSoon?: boolean;
}

interface OnboardingChecklistProps {
  title: string;
  items: ChecklistItem[];
}

/**
 * OnboardingChecklist component for showing user onboarding progress.
 * Displays completed steps and upcoming "Coming Soon" features.
 */
export const OnboardingChecklist = ({ title, items }: OnboardingChecklistProps) => {
  return (
    <Card className="p-6 bg-card-elevated border border-border">
      <h3 className="text-lg font-semibold mb-4 text-foreground">{title}</h3>
      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.id} className="flex items-start gap-3">
            {item.completed ? (
              <CheckCircle2 className="h-5 w-5 text-secondary mt-0.5 flex-shrink-0" />
            ) : (
              <Circle className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
            )}
            <div className="flex-1">
              <p className={`text-sm ${item.completed ? 'text-foreground' : 'text-muted-foreground'}`}>
                {item.label}
              </p>
              {item.comingSoon && (
                <p className="text-xs text-secondary font-medium mt-1">Coming Soon</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};
