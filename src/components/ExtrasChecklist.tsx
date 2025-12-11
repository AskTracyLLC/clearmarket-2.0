import { Card } from "@/components/ui/card";
import { CheckCircle2, Circle, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

interface ExtrasItem {
  id: string;
  label: string;
  description?: string;
  done: boolean;
  link?: string;
}

interface ExtrasChecklistProps {
  items: ExtrasItem[];
}

/**
 * ExtrasChecklist component for showing optional profile extras.
 * These items are optional and don't affect the main profile completion progress.
 */
export const ExtrasChecklist = ({ items }: ExtrasChecklistProps) => {
  if (!items || items.length === 0) return null;

  const completedCount = items.filter((item) => item.done).length;

  return (
    <Card className="p-4 bg-card border border-border">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="h-4 w-4 text-muted-foreground" />
        <h4 className="text-sm font-medium text-muted-foreground">
          Extras (optional)
        </h4>
        {completedCount > 0 && (
          <span className="text-xs text-muted-foreground ml-auto">
            {completedCount} of {items.length} done
          </span>
        )}
      </div>

      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.id} className="flex items-start gap-2">
            {item.done ? (
              <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
            ) : (
              <Circle className="h-4 w-4 text-muted-foreground/50 mt-0.5 flex-shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              {item.link && !item.done ? (
                <Link
                  to={item.link}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  {item.label}
                </Link>
              ) : (
                <p
                  className={`text-xs font-medium ${
                    item.done ? "text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {item.label}
                </p>
              )}
              {item.description && (
                <p className="text-xs text-muted-foreground/70 mt-0.5 line-clamp-1">
                  {item.description}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};
