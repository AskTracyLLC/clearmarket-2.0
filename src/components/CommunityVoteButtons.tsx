import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import { castVote } from "@/lib/community";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface CommunityVoteButtonsProps {
  targetType: "post" | "comment";
  targetId: string;
  userId: string;
  helpfulCount: number;
  notHelpfulCount: number;
  currentVote?: string;
  onVoteChange?: () => void;
  size?: "sm" | "default";
}

export function CommunityVoteButtons({
  targetType,
  targetId,
  userId,
  helpfulCount,
  notHelpfulCount,
  currentVote,
  onVoteChange,
  size = "default",
}: CommunityVoteButtonsProps) {
  const { toast } = useToast();
  const [voting, setVoting] = useState(false);
  const [localVote, setLocalVote] = useState(currentVote);
  const [localHelpful, setLocalHelpful] = useState(helpfulCount);
  const [localNotHelpful, setLocalNotHelpful] = useState(notHelpfulCount);

  const handleVote = async (voteType: "helpful" | "not_helpful") => {
    if (voting) return;
    setVoting(true);

    // Optimistic update
    const wasVoted = localVote === voteType;
    const wasOtherVote = localVote && localVote !== voteType;

    if (wasVoted) {
      // Toggle off
      setLocalVote(undefined);
      if (voteType === "helpful") {
        setLocalHelpful((prev) => Math.max(0, prev - 1));
      } else {
        setLocalNotHelpful((prev) => Math.max(0, prev - 1));
      }
    } else if (wasOtherVote) {
      // Switch vote
      setLocalVote(voteType);
      if (voteType === "helpful") {
        setLocalHelpful((prev) => prev + 1);
        setLocalNotHelpful((prev) => Math.max(0, prev - 1));
      } else {
        setLocalNotHelpful((prev) => prev + 1);
        setLocalHelpful((prev) => Math.max(0, prev - 1));
      }
    } else {
      // New vote
      setLocalVote(voteType);
      if (voteType === "helpful") {
        setLocalHelpful((prev) => prev + 1);
      } else {
        setLocalNotHelpful((prev) => prev + 1);
      }
    }

    const result = await castVote(userId, targetType, targetId, voteType);

    if (!result.success) {
      // Revert optimistic update
      setLocalVote(currentVote);
      setLocalHelpful(helpfulCount);
      setLocalNotHelpful(notHelpfulCount);
      toast({
        title: "Error",
        description: result.error || "Failed to record vote",
        variant: "destructive",
      });
    } else {
      onVoteChange?.();
    }

    setVoting(false);
  };

  const buttonSize = size === "sm" ? "h-7 px-2 text-xs" : "h-8 px-3 text-sm";

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => handleVote("helpful")}
        disabled={voting}
        className={cn(
          buttonSize,
          localVote === "helpful" && "bg-green-500/20 text-green-400 hover:bg-green-500/30"
        )}
      >
        <ThumbsUp className="w-4 h-4 mr-1" />
        {localHelpful}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => handleVote("not_helpful")}
        disabled={voting}
        className={cn(
          buttonSize,
          localVote === "not_helpful" && "bg-red-500/20 text-red-400 hover:bg-red-500/30"
        )}
      >
        <ThumbsDown className="w-4 h-4 mr-1" />
        {localNotHelpful}
      </Button>
    </div>
  );
}
