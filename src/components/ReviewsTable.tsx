import { Star, Eye, Sparkles, GraduationCap, MoreHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export interface ReviewRowData {
  id: string;
  reviewer_id: string;
  reviewee_id: string;
  rating_on_time: number | null;
  rating_quality: number | null;
  rating_communication: number | null;
  comment: string | null;
  created_at: string;
  is_exit_review: boolean;
  direction: string;
  is_feedback?: boolean;
  status?: string;
  workflow_status?: string;
  is_spotlighted?: boolean;
  state_code?: string | null;
  county_name?: string | null;
  inspection_category?: string | null;
  // Enriched data
  displayName?: string;
  displayAnonymousId?: string;
}

interface ReviewsTableProps {
  reviews: ReviewRowData[];
  variant: "received" | "given";
  isRepView: boolean; // True for Field Rep pages, false for Vendor pages
  onViewProfile?: (userId: string) => void;
  onAccept?: (review: ReviewRowData) => void;
  onDispute?: (review: ReviewRowData) => void;
  onToggleSpotlight?: (review: ReviewRowData) => void;
}

function formatArea(stateCode: string | null | undefined, countyName: string | null | undefined): string {
  if (countyName && stateCode) {
    return `${countyName}, ${stateCode}`;
  }
  if (stateCode) {
    return stateCode;
  }
  return "Overall";
}

function formatWorkType(inspectionCategory: string | null | undefined): string {
  if (!inspectionCategory) return "Overall";
  
  // Convert snake_case to Title Case
  return inspectionCategory
    .split("_")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function RatingCell({ rating }: { rating: number | null }) {
  if (rating === null || rating === undefined) {
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <div className="flex items-center gap-1">
      <Star className="h-3 w-3 fill-primary text-primary" />
      <span className="text-sm">{rating}</span>
    </div>
  );
}

function WorkflowStatusBadge({ status, isCoaching }: { status: string | undefined; isCoaching?: boolean }) {
  if (isCoaching) {
    return (
      <Badge variant="secondary" className="bg-amber-500/20 text-amber-600 border-amber-500/30">
        <GraduationCap className="h-3 w-3 mr-1" />
        Coaching
      </Badge>
    );
  }

  switch (status) {
    case "accepted":
      return <Badge variant="secondary" className="bg-green-500/20 text-green-600 border-green-500/30">Accepted</Badge>;
    case "disputed":
      return <Badge variant="destructive">Disputed</Badge>;
    case "pending":
    default:
      return <Badge variant="outline">Pending</Badge>;
  }
}

export function ReviewsTable({
  reviews,
  variant,
  isRepView,
  onViewProfile,
  onAccept,
  onDispute,
  onToggleSpotlight,
}: ReviewsTableProps) {
  const isReceived = variant === "received";
  const showActions = isReceived && isRepView; // Only reps can accept/dispute on received tab

  if (reviews.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        {isReceived ? "No reviews received yet." : "No reviews given yet."}
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[100px]">Date</TableHead>
            <TableHead>{isReceived ? "From" : "To"}</TableHead>
            <TableHead>Area</TableHead>
            <TableHead>Work Type</TableHead>
            <TableHead className="text-center w-[80px]">On-Time</TableHead>
            <TableHead className="text-center w-[80px]">Quality</TableHead>
            <TableHead className="text-center w-[80px]">Comm.</TableHead>
            <TableHead>Notes</TableHead>
            <TableHead className="w-[100px]">Status</TableHead>
            {showActions && <TableHead className="w-[100px]">Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {reviews.map((review) => {
            const isCoaching = review.status === "coaching";
            const isPending = review.workflow_status === "pending";
            const isAccepted = review.workflow_status === "accepted";

            return (
              <TableRow 
                key={review.id}
                className={isCoaching ? "bg-amber-500/5" : undefined}
              >
                <TableCell className="text-sm text-muted-foreground">
                  {new Date(review.created_at).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">
                      {review.displayAnonymousId || review.displayName || "Unknown"}
                    </span>
                    {onViewProfile && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => onViewProfile(isReceived ? review.reviewer_id : review.reviewee_id)}
                      >
                        <Eye className="h-3 w-3" />
                      </Button>
                    )}
                    {review.is_exit_review && (
                      <Badge variant="outline" className="text-xs">Exit</Badge>
                    )}
                    {review.is_spotlighted && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <Sparkles className="h-3 w-3 text-primary" />
                          </TooltipTrigger>
                          <TooltipContent>Spotlighted on profile</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-sm">
                  {formatArea(review.state_code, review.county_name)}
                </TableCell>
                <TableCell className="text-sm">
                  {formatWorkType(review.inspection_category)}
                </TableCell>
                <TableCell className="text-center">
                  <RatingCell rating={review.rating_on_time} />
                </TableCell>
                <TableCell className="text-center">
                  <RatingCell rating={review.rating_quality} />
                </TableCell>
                <TableCell className="text-center">
                  <RatingCell rating={review.rating_communication} />
                </TableCell>
                <TableCell className="max-w-[200px]">
                  {review.comment ? (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <p className="text-sm text-muted-foreground truncate cursor-help">
                            {review.comment}
                          </p>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p>{review.comment}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <WorkflowStatusBadge status={review.workflow_status} isCoaching={isCoaching} />
                </TableCell>
                {showActions && (
                  <TableCell>
                    {isPending && !isCoaching && (
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => onAccept?.(review)}
                        >
                          Accept
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-destructive hover:text-destructive"
                          onClick={() => onDispute?.(review)}
                        >
                          Dispute
                        </Button>
                      </div>
                    )}
                    {isAccepted && !isCoaching && onToggleSpotlight && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => onToggleSpotlight(review)}>
                            {review.is_spotlighted ? "Remove Spotlight" : "Spotlight on Profile"}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
