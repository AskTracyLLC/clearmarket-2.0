import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CheckCircle2, Circle, ChevronDown, ChevronUp, Zap, ExternalLink, MessageSquareWarning, Gift, Coins } from "lucide-react";
import { Link } from "react-router-dom";
import { ChecklistProgress, CHECKLIST_ITEM_CTAS } from "@/lib/checklists";
import { cn } from "@/lib/utils";
import { ChecklistFeedbackDialog } from "./ChecklistFeedbackDialog";
import { useAuth } from "@/hooks/useAuth";
import { useOnboardingReward } from "@/hooks/useOnboardingReward";
import { useActiveRole } from "@/hooks/useActiveRole";
import { gettingStartedChecklistCopy } from "@/copy/gettingStartedChecklistCopy";
interface GettingStartedChecklistProps {
  checklist: ChecklistProgress;
  onMarkComplete?: (userItemId: string) => Promise<boolean>;
  onActionClick?: (actionId: string) => void;
  defaultExpanded?: boolean;
  className?: string;
  /** Show the onboarding reward card (only for primary system checklists) */
  showReward?: boolean;
}

export function GettingStartedChecklist({
  checklist,
  onMarkComplete,
  onActionClick,
  defaultExpanded = true,
  className,
  showReward = false,
}: GettingStartedChecklistProps) {
  const { user } = useAuth();
  const { effectiveRole } = useActiveRole();
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [completing, setCompleting] = useState<string | null>(null);
  const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false);
  const [feedbackItem, setFeedbackItem] = useState<{
    userItemId: string;
    itemId: string;
    title: string;
    description?: string;
  } | null>(null);

  // Only fetch reward status if showReward is true
  const rewardHook = useOnboardingReward();
  const reward = showReward ? rewardHook : null;
  const isVendor = effectiveRole === "vendor";

  const copy = gettingStartedChecklistCopy;
  const handleComplete = async (userItemId: string) => {
    if (!onMarkComplete) return;
    setCompleting(userItemId);
    await onMarkComplete(userItemId);
    setCompleting(null);
  };

  const openFeedbackDialog = (
    userItemId: string,
    itemId: string,
    title: string,
    description?: string
  ) => {
    setFeedbackItem({ userItemId, itemId, title, description });
    setFeedbackDialogOpen(true);
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
                      {copy.widget.completeBadge}
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription className="text-sm mt-1">
                  {completedRequiredCount} of {requiredCount} {copy.widget.progressLabel}
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
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge variant="outline" className="text-xs px-1.5 py-0 h-5 cursor-help">
                                  <Zap className="h-3 w-3 mr-1" />
                                  {copy.itemRow.autoBadge}
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{copy.itemRow.autoTooltip}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                        {definition.is_required && !isCompleted && (
                          <Badge variant="secondary" className="text-xs px-1.5 py-0 h-5">
                            {copy.itemRow.requiredBadge}
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
                          {copy.itemRow.completed} {new Date(userItem.completed_at).toLocaleDateString()}
                          {userItem.completed_by === "system" && ` ${copy.itemRow.autoTrackedSuffix}`}
                        </p>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex-shrink-0 flex items-center gap-1">
                      {/* Feedback Icon */}
                      {user && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                                onClick={() =>
                                  openFeedbackDialog(
                                    userItem.id,
                                    definition.id,
                                    definition.title,
                                    definition.description || undefined
                                  )
                                }
                              >
                                <MessageSquareWarning className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{copy.itemRow.feedbackTooltip}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}

                      {/* CTA or Mark Done Button */}
                      {!isCompleted && (
                        <>
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
                              {isLoading ? copy.itemRow.markDoneLoading : copy.itemRow.markDoneButton}
                            </Button>
                          ) : null}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Onboarding Reward Banner */}
            {showReward && reward && !reward.loading && (
              <>
                {isVendor ? (
                  // Vendor tiered reward display
                  <div className="mt-4 space-y-2">
                    {/* Milestone tier (2 credits) */}
                    <div className={cn(
                      "p-3 rounded-lg border flex items-center gap-3",
                      reward.milestoneEarned 
                        ? "bg-green-500/10 border-green-500/30" 
                        : reward.milestoneComplete 
                          ? "bg-primary/10 border-primary/30" 
                          : "bg-muted/30 border-border/50"
                    )}>
                      <div className={cn(
                        "flex-shrink-0 p-2 rounded-full",
                        reward.milestoneEarned 
                          ? "bg-green-500/20" 
                          : reward.milestoneComplete 
                            ? "bg-primary/20" 
                            : "bg-muted"
                      )}>
                        {reward.milestoneEarned ? (
                          <CheckCircle2 className="h-5 w-5 text-green-500" />
                        ) : (
                          <Gift className="h-5 w-5 text-primary" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm text-foreground">
                            {copy.vendorReward.milestoneTitle}
                          </span>
                          {reward.milestoneEarned && (
                            <Badge variant="secondary" className="bg-green-500/10 text-green-500 text-xs">
                              {copy.reward.earnedBadge}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {reward.milestoneEarned 
                            ? copy.vendorReward.milestoneEarned 
                            : copy.vendorReward.milestonePending}
                        </p>
                      </div>
                      {reward.milestoneComplete && !reward.milestoneEarned && (
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => reward.claimMilestoneReward()}
                          disabled={reward.claiming}
                          className="flex-shrink-0"
                        >
                          <Coins className="h-4 w-4 mr-1" />
                          {reward.claiming ? copy.reward.claimingButton : copy.vendorReward.milestoneClaimButton}
                        </Button>
                      )}
                    </div>

                    {/* Full onboarding tier (3 more credits) */}
                    <div className={cn(
                      "p-3 rounded-lg border flex items-center gap-3",
                      reward.onboardingEarned 
                        ? "bg-green-500/10 border-green-500/30" 
                        : reward.onboardingComplete && (reward.remaining ?? 0) > 0
                          ? "bg-primary/10 border-primary/30" 
                          : "bg-muted/30 border-border/50"
                    )}>
                      <div className={cn(
                        "flex-shrink-0 p-2 rounded-full",
                        reward.onboardingEarned 
                          ? "bg-green-500/20" 
                          : reward.onboardingComplete && (reward.remaining ?? 0) > 0
                            ? "bg-primary/20" 
                            : "bg-muted"
                      )}>
                        {reward.onboardingEarned ? (
                          <CheckCircle2 className="h-5 w-5 text-green-500" />
                        ) : (
                          <Gift className="h-5 w-5 text-primary" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm text-foreground">
                            {copy.vendorReward.fullTitle}
                          </span>
                          {reward.onboardingEarned && (
                            <Badge variant="secondary" className="bg-green-500/10 text-green-500 text-xs">
                              {copy.reward.earnedBadge}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {reward.onboardingEarned 
                            ? copy.vendorReward.fullEarned 
                            : copy.vendorReward.fullPending}
                        </p>
                      </div>
                      {reward.onboardingComplete && (reward.remaining ?? 0) > 0 && !reward.onboardingEarned && (
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => reward.claimReward()}
                          disabled={reward.claiming}
                          className="flex-shrink-0"
                        >
                          <Coins className="h-4 w-4 mr-1" />
                          {reward.claiming ? copy.reward.claimingButton : copy.vendorReward.fullClaimButton}
                        </Button>
                      )}
                    </div>

                    {/* Total earned summary */}
                    {(reward.totalEarned ?? 0) > 0 && (
                      <div className="text-center">
                        <Badge variant="outline" className="text-xs">
                          {(reward.totalEarned ?? 0) >= 5 
                            ? copy.vendorReward.maxEarned 
                            : copy.vendorReward.totalEarned.replace("{count}", String(reward.totalEarned ?? 0))}
                        </Badge>
                      </div>
                    )}
                  </div>
                ) : (
                  // Rep single-tier reward display
                  <div className={cn(
                    "mt-4 p-3 rounded-lg border flex items-center gap-3",
                    reward.alreadyAwarded 
                      ? "bg-green-500/10 border-green-500/30" 
                      : reward.isComplete 
                        ? "bg-primary/10 border-primary/30" 
                        : "bg-muted/30 border-border/50"
                  )}>
                    <div className={cn(
                      "flex-shrink-0 p-2 rounded-full",
                      reward.alreadyAwarded 
                        ? "bg-green-500/20" 
                        : reward.isComplete 
                          ? "bg-primary/20" 
                          : "bg-muted"
                    )}>
                      {reward.alreadyAwarded ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                      ) : (
                        <Gift className="h-5 w-5 text-primary" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm text-foreground">
                          {copy.reward.title}
                        </span>
                        {reward.alreadyAwarded && (
                          <Badge variant="secondary" className="bg-green-500/10 text-green-500 text-xs">
                            {copy.reward.earnedBadge}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {reward.alreadyAwarded 
                          ? copy.reward.earnedDescription 
                          : copy.reward.pendingDescription}
                      </p>
                    </div>
                    {reward.isComplete && !reward.alreadyAwarded && (
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => reward.claimReward()}
                        disabled={reward.claiming}
                        className="flex-shrink-0"
                      >
                        <Coins className="h-4 w-4 mr-1" />
                        {reward.claiming ? copy.reward.claimingButton : copy.reward.claimButton}
                      </Button>
                    )}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>

      {/* Feedback Dialog */}
      {user && feedbackItem && (
        <ChecklistFeedbackDialog
          open={feedbackDialogOpen}
          onClose={() => {
            setFeedbackDialogOpen(false);
            setFeedbackItem(null);
          }}
          userId={user.id}
          userChecklistItemId={feedbackItem.userItemId}
          templateId={template.id}
          itemId={feedbackItem.itemId}
          itemTitle={feedbackItem.title}
          itemDescription={feedbackItem.description}
        />
      )}
    </Card>
  );
}