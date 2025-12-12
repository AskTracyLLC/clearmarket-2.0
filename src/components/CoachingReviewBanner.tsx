import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { GraduationCap } from "lucide-react";

interface CoachingReviewBannerProps {
  isVendorViewing?: boolean;
}

export function CoachingReviewBanner({ isVendorViewing = false }: CoachingReviewBannerProps) {
  return (
    <Alert className="bg-amber-500/10 border-amber-500/30 mb-4">
      <GraduationCap className="h-4 w-4 text-amber-600" />
      <AlertTitle className="text-amber-700 dark:text-amber-500">
        Private Feedback / Coaching
      </AlertTitle>
      <AlertDescription className="text-amber-600 dark:text-amber-400 text-sm">
        {isVendorViewing ? (
          <>
            This review has been moved to Coaching by the Field Rep.
            It no longer affects their public rating, but remains visible to you and ClearMarket Admins.
          </>
        ) : (
          <>
            This review is in your Coaching bucket. It no longer affects your public rating,
            but is still visible to the vendor who left it and ClearMarket Admins.
          </>
        )}
      </AlertDescription>
    </Alert>
  );
}
