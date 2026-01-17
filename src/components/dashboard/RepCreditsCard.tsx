/**
 * RepCreditsCard
 * 
 * Shows rep credit balance, boost status, and provides access to the full Credits page.
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Coins, Zap, History, Loader2, Clock, Rocket, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useRepCredits } from "@/hooks/useRepCredits";
import { useRepBoostStatus } from "@/hooks/useRepBoostStatus";
import { RepTransactionHistoryDialog } from "@/components/RepTransactionHistoryDialog";
import { RepBoostPurchaseDialog } from "@/components/RepBoostPurchaseDialog";
import { format, formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

interface RepCreditsCardProps {
  className?: string;
}

export function RepCreditsCard({ className }: RepCreditsCardProps) {
  const navigate = useNavigate();
  const { balance, loading: creditsLoading, refresh: refreshCredits } = useRepCredits();
  const { status: boostStatus, loading: boostLoading } = useRepBoostStatus();
  const [showHistory, setShowHistory] = useState(false);
  const [showBoostDialog, setShowBoostDialog] = useState(false);

  const loading = creditsLoading || boostLoading;

  const handleBoostSuccess = () => {
    refreshCredits();
  };

  if (loading) {
    return (
      <Card className={cn("", className)}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Coins className="h-4 w-4 text-secondary" />
            Credits
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className={cn("cursor-pointer hover:border-primary/50 transition-colors", className)} onClick={() => navigate("/rep/credits")}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Coins className="h-4 w-4 text-secondary" />
              Credits
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-muted-foreground"
              onClick={(e) => {
                e.stopPropagation();
                navigate("/rep/credits");
              }}
            >
              <ExternalLink className="h-3.5 w-3.5 mr-1" />
              View All
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Balance Display */}
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-foreground">{balance ?? 0}</span>
            <span className="text-sm text-muted-foreground">credits</span>
          </div>

          {/* Boost Status / Purchase */}
          <div className="pt-2 border-t border-border">
            {boostStatus.isBoosted && boostStatus.activeEndsAt ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="gap-1">
                    <Rocket className="h-3 w-3" />
                    Boosted
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    until {format(new Date(boostStatus.activeEndsAt), "MMM d, h:mm a")}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  You appear higher in vendor search results.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-2"
                  onClick={() => setShowBoostDialog(true)}
                >
                  <Zap className="h-3.5 w-3.5" />
                  Extend Boost (+48h for 2 credits)
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>No active boost</span>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full gap-2"
                  onClick={() => setShowBoostDialog(true)}
                  disabled={(balance ?? 0) < 2}
                >
                  <Zap className="h-3.5 w-3.5" />
                  Boost Visibility (2 credits)
                </Button>
                {(balance ?? 0) < 2 && (
                  <p className="text-xs text-muted-foreground text-center">
                    Complete onboarding to earn more credits
                  </p>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <RepTransactionHistoryDialog
        open={showHistory}
        onOpenChange={setShowHistory}
      />

      <RepBoostPurchaseDialog
        open={showBoostDialog}
        onOpenChange={setShowBoostDialog}
        onSuccess={handleBoostSuccess}
      />
    </>
  );
}
