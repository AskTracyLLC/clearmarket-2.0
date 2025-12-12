import { Star, MapPin, Briefcase } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface SpotlightedReview {
  id: string;
  reviewer_anonymous_id?: string;
  rating_on_time: number | null;
  rating_quality: number | null;
  rating_communication: number | null;
  comment: string | null;
  state_code?: string | null;
  county_name?: string | null;
  inspection_category?: string | null;
  created_at: string;
}

interface SpotlightedReviewsProps {
  reviews: SpotlightedReview[];
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
  return inspectionCategory
    .split("_")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function RatingDisplay({ label, rating }: { label: string; rating: number | null }) {
  if (!rating) return null;
  return (
    <div className="flex items-center gap-1 text-sm">
      <span className="text-muted-foreground">{label}:</span>
      <Star className="h-3 w-3 fill-primary text-primary" />
      <span className="font-medium">{rating}</span>
    </div>
  );
}

export function SpotlightedReviews({ reviews }: SpotlightedReviewsProps) {
  if (reviews.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Star className="h-5 w-5 text-primary" />
          Spotlighted Reviews
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {reviews.map((review) => (
          <div
            key={review.id}
            className="p-4 rounded-lg border bg-card"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="secondary" className="text-xs">
                  {review.reviewer_anonymous_id || "Vendor"}
                </Badge>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  {formatArea(review.state_code, review.county_name)}
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Briefcase className="h-3 w-3" />
                  {formatWorkType(review.inspection_category)}
                </div>
              </div>
              <span className="text-xs text-muted-foreground">
                {new Date(review.created_at).toLocaleDateString()}
              </span>
            </div>

            <div className="flex flex-wrap gap-4 mb-3">
              <RatingDisplay label="On-Time" rating={review.rating_on_time} />
              <RatingDisplay label="Quality" rating={review.rating_quality} />
              <RatingDisplay label="Comm." rating={review.rating_communication} />
            </div>

            {review.comment && (
              <p className="text-sm text-muted-foreground italic">
                "{review.comment}"
              </p>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
