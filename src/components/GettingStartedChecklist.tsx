import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { CheckCircle2, Circle, ChevronDown, ChevronUp, Zap, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { ChecklistProgress, CHECKLIST_ITEM_CTAS } from "@/lib/checklists";
import { cn } from "@/lib/utils";

interface GettingStartedChecklistProps {
  checklist: ChecklistProgress;
  onMarkComplete?: (userItemId: string) => Promise<boolean>;
  onActionClick?: (actionId: string) => void;
  defaultExpanded?: boolean;
  className?: string;
}

export function GettingStartedChecklist({
  checklist,
  onMarkComplete,
  onActionClick,
  defaultExpanded = true,
  className,
}: GettingStartedChecklistProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [completing, setCompleting] = useState<string | null>(null);

  const handleComplete = async (userItemId: string) => {
    if (!onMarkComplete) return;
    setCompleting(userItemId);
    await onMarkComplete(userItemId);
    setCompleting(null);
  };

  const { items, percent, completedRequiredCount, requiredCount, template } = checklist;
  const isComplete = percent === 100;

  return (
    <Card className={cn("border-border/50", className)}>
      <Collapsible open={expanded} onOpenChange={setExpanded}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors pb-3">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  {template.name}
                  {isComplete && (
                    <Badge variant="secondary" className="bg-green-500/10 text-green-500 text-xs">
                      Complete
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription className="text-sm mt-1">
                  {completedRequiredCount} of {requiredCount} required items completed
                </CardDescription>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <span className="text-2xl font-bold text-foreground">{percent}%</span>
                </div>
                {expanded ? (
                  <ChevronUp className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
            </div>
            <Progress value={percent} className="h-2 mt-3" />
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0">
            <div className="space-y-3">
              {items.map(({ definition, userItem }) => {
                const isCompleted = userItem.status === "completed";
                const isAutoTracked = !!definition.auto_track_key;
                const cta = definition.auto_track_key
                  ? CHECKLIST_ITEM_CTAS[definition.auto_track_key]
                  : null;
                const isLoading = completing === userItem.id;

                return (
                  <div
                    key={definition.id}
                    className={cn(
                      "flex items-start gap-3 p-3 rounded-lg border transition-colors",
                      isCompleted
                        ? "bg-muted/30 border-border/30"
                        : "bg-background border-border hover:border-primary/30"
                    )}
                  >
                    {/* Status Icon */}
                    <div className="flex-shrink-0 mt-0.5">
                      {isCompleted ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                      ) : (
                        <Circle className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "font-medium text-sm",
                            isCompleted ? "text-muted-foreground line-through" : "text-foreground"
                          )}
                        >
                          {definition.title}
                        </span>
                        {isAutoTracked && !isCompleted && (
                          <Badge variant="outline" className="text-xs px-1.5 py-0 h-5">
                            <Zap className="h-3 w-3 mr-1" />
                            Auto
                          </Badge>
                        )}
                        {definition.is_required && !isCompleted && (
                          <Badge variant="secondary" className="text-xs px-1.5 py-0 h-5">
                            Required
                          </Badge>
                        )}
                      </div>
                      {definition.description && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {definition.description}
                        </p>
                      )}
                      {isCompleted && userItem.completed_at && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Completed {new Date(userItem.completed_at).toLocaleDateString()}
                          {userItem.completed_by === "system" && " (auto-tracked)"}
                        </p>
                      )}
                    </div>

                    {/* Action Button */}
                    {!isCompleted && (
                      <div className="flex-shrink-0">
                        {cta ? (
                          <Button
                            variant="outline"
                            size="sm"
                            asChild
                            className="text-xs h-7"
                          >
                            <Link to={cta.link}>
                              {cta.label}
                              <ExternalLink className="h-3 w-3 ml-1" />
                            </Link>
                          </Button>
                        ) : !isAutoTracked && onMarkComplete ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleComplete(userItem.id)}
                            disabled={isLoading || !userItem.id}
                            className="text-xs h-7"
                          >
                            {isLoading ? "..." : "Mark Done"}
                          </Button>
                        ) : null}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
