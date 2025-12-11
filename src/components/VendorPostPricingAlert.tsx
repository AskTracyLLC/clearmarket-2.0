import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { analyzeRepRatesForPost, RepRateAnalysis } from "@/lib/vendorRateAnalysis";

interface VendorPostPricingAlertProps {
  stateCode: string | null;
  countyId: string | null;
  coversEntireState: boolean;
  payMin: number | null;
  payMax: number | null;
}

export function VendorPostPricingAlert({
  stateCode,
  countyId,
  coversEntireState,
  payMin,
  payMax,
}: VendorPostPricingAlertProps) {
  const { isEnabled, loading: flagsLoading } = useFeatureFlags();
  const [analysis, setAnalysis] = useState<RepRateAnalysis | null>(null);
  const [loading, setLoading] = useState(true);

  const featureAvailable = isEnabled("vendor_match_assistant");

  useEffect(() => {
    if (featureAvailable && !flagsLoading && stateCode) {
      loadAnalysis();
    } else {
      setLoading(false);
    }
  }, [featureAvailable, flagsLoading, stateCode, countyId, payMin, payMax]);

  const loadAnalysis = async () => {
    try {
      const result = await analyzeRepRatesForPost(
        stateCode,
        countyId,
        coversEntireState,
        payMin,
        payMax
      );
      setAnalysis(result);
    } catch (error) {
      console.error("Error analyzing rep rates:", error);
    } finally {
      setLoading(false);
    }
  };

  // Don't show if feature is disabled or still loading
  if (!featureAvailable || flagsLoading || loading) {
    return null;
  }

  // Only show alert if there are reps but none match the rate
  if (!analysis || analysis.totalReps === 0 || analysis.rateMatches > 0) {
    return null;
  }

  // Show pricing alert
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            variant="outline" 
            className="text-amber-500 border-amber-500/30 bg-amber-500/10 cursor-help"
          >
            <AlertTriangle className="w-3 h-3 mr-1" />
            Pricing Alert
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <p className="text-sm">
            We found {analysis.rateTooHigh} rep{analysis.rateTooHigh === 1 ? '' : 's'} in this area, but their base rates are higher than your max of ${payMax?.toFixed(2) || '?'}.
          </p>
          <Link 
            to="/vendor/match-assistant" 
            className="text-xs text-primary hover:underline mt-1 block"
          >
            Use Vendor Match Assistant to see typical rates →
          </Link>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
