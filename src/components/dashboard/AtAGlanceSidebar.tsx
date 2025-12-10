import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Star, 
  Coins,
  Calendar,
  MapPin,
  Plus,
} from "lucide-react";
import { format, parseISO } from "date-fns";

interface AtAGlanceSidebarProps {
  isRep: boolean;
  isVendor: boolean;
  vendorCredits?: number | null;
  upcomingTimeOff?: {
    start_date: string;
    end_date: string;
    auto_reply_enabled: boolean;
  } | null;
  coverageStats?: {
    statesCount: number;
    countiesCount: number;
    activeAgreementsCount: number;
  };
}

export function AtAGlanceSidebar({
  isRep,
  isVendor,
  vendorCredits,
  upcomingTimeOff,
  coverageStats = { statesCount: 0, countiesCount: 0, activeAgreementsCount: 0 },
}: AtAGlanceSidebarProps) {
  const hasCoverage = coverageStats.statesCount > 0 || coverageStats.countiesCount > 0;
  const profileRoute = isRep ? "/rep/profile" : "/vendor/profile";

  // Mobile: Single consolidated card view
  // Desktop: Multiple separate cards
  return (
    <>
      {/* Mobile: Single consolidated card */}
      <div className="lg:hidden">
        <Card className="bg-card border-border">
          <CardContent className="p-4 space-y-5">
            {/* Coverage & Rates Section */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <MapPin className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Coverage & Rates</span>
              </div>
              {hasCoverage ? (
                <p className="text-xs text-muted-foreground mb-2">
                  States: {coverageStats.statesCount} • Counties: {coverageStats.countiesCount} • Agreements: {coverageStats.activeAgreementsCount}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground mb-2">
                  You haven't added any coverage yet.
                </p>
              )}
              <Link to={profileRoute}>
                <Button variant="default" size="sm" className="w-full text-xs">
                  Manage Coverage & Rates
                </Button>
              </Link>
            </div>

            {/* Divider */}
            <div className="border-t border-border" />

            {/* Rep: Reputation + Availability */}
            {isRep && (
              <>
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Star className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">Your Reputation</span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">
                    Build your trust score by completing work and earning reviews.
                  </p>
                  <Link to="/rep/reviews">
                    <Button variant="outline" size="sm" className="w-full text-xs">
                      View Reviews & Trust Score
                    </Button>
                  </Link>
                </div>

                <div className="border-t border-border" />

                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">Availability</span>
                  </div>
                  {upcomingTimeOff ? (
                    <div className="text-sm mb-2">
                      <p className="text-muted-foreground text-xs">Time off:</p>
                      <p className="font-medium text-foreground text-sm">
                        {format(parseISO(upcomingTimeOff.start_date), "MMM d")} – {format(parseISO(upcomingTimeOff.end_date), "MMM d")}
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground mb-2">
                      No upcoming time off
                    </p>
                  )}
                  <Link to="/rep/availability">
                    <Button variant="outline" size="sm" className="w-full text-xs">
                      Manage Availability
                    </Button>
                  </Link>
                </div>
              </>
            )}

            {/* Vendor: Reputation + Availability + Credits */}
            {isVendor && (
              <>
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Star className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">Your Reputation</span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">
                    Build your trust score by earning reviews from Field Reps.
                  </p>
                  <Link to="/vendor/reviews">
                    <Button variant="outline" size="sm" className="w-full text-xs">
                      View Reviews & Trust Score
                    </Button>
                  </Link>
                </div>

                <div className="border-t border-border" />

                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">Availability</span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">
                    Set office hours and pay schedules
                  </p>
                  <Link to="/vendor/availability">
                    <Button variant="outline" size="sm" className="w-full text-xs">
                      Manage Availability
                    </Button>
                  </Link>
                </div>

                {vendorCredits !== undefined && vendorCredits !== null && (
                  <>
                    <div className="border-t border-border" />
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Coins className="h-4 w-4 text-primary" />
                          <span className="text-sm font-medium">Credits</span>
                        </div>
                        <span className="text-lg font-bold text-foreground">{vendorCredits}</span>
                      </div>
                      <Link to="/vendor/credits">
                        <Button variant="outline" size="sm" className="w-full text-xs">
                          Manage Credits
                        </Button>
                      </Link>
                    </div>
                  </>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Desktop: Multiple separate cards */}
      <div className="hidden lg:block space-y-4">
        {/* Coverage & Rates */}
        <Card className="bg-card border-border">
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" />
              Coverage & Rates
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-0">
            {hasCoverage ? (
              <>
                <p className="text-xs text-muted-foreground mb-3">
                  States covered: {coverageStats.statesCount} • Counties: {coverageStats.countiesCount} • Active rate agreements: {coverageStats.activeAgreementsCount}
                </p>
                <p className="text-xs text-muted-foreground mb-3">
                  Review your coverage areas and pricing for each region.
                </p>
              </>
            ) : (
              <p className="text-xs text-muted-foreground mb-3">
                You haven't added any coverage yet. Add your first coverage area to start matching with work.
              </p>
            )}
            
            <div className="space-y-2">
              <Link to={profileRoute} className="block">
                <Button variant="default" size="sm" className="w-full text-xs">
                  Manage Coverage & Rates
                </Button>
              </Link>
              <Link to={profileRoute} className="block">
                <Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground hover:text-foreground">
                  <Plus className="h-3 w-3 mr-1" />
                  Add new coverage area
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Rep Reputation Summary */}
        {isRep && (
          <Card className="bg-card border-border">
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Star className="h-4 w-4 text-primary" />
                Your Reputation
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 pt-0">
              <p className="text-sm text-muted-foreground mb-3">
                Build your trust score by completing work and earning reviews.
              </p>
              <Link to="/rep/reviews" className="block">
                <Button variant="outline" size="sm" className="w-full text-xs">
                  View Reviews & Trust Score
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {/* Rep Availability Summary */}
        {isRep && (
          <Card className="bg-card border-border">
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                Availability
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 pt-0">
              {upcomingTimeOff ? (
                <div className="text-sm">
                  <p className="text-muted-foreground mb-1">Time off scheduled:</p>
                  <p className="font-medium text-foreground">
                    {format(parseISO(upcomingTimeOff.start_date), "MMM d")} – {format(parseISO(upcomingTimeOff.end_date), "MMM d")}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Auto-reply: {upcomingTimeOff.auto_reply_enabled ? "ON" : "OFF"}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No upcoming time off
                </p>
              )}
              <Link to="/rep/availability" className="block mt-3">
                <Button variant="outline" size="sm" className="w-full text-xs">
                  Manage Availability
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {/* Vendor Availability Summary */}
        {isVendor && (
          <Card className="bg-card border-border">
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                Availability
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 pt-0">
              <p className="text-sm text-muted-foreground mb-3">
                Set office hours and pay schedules for your Field Reps.
              </p>
              <Link to="/vendor/availability" className="block">
                <Button variant="outline" size="sm" className="w-full text-xs">
                  Manage Availability
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {/* Vendor Reputation Summary */}
        {isVendor && (
          <Card className="bg-card border-border">
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Star className="h-4 w-4 text-primary" />
                Your Reputation
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 pt-0">
              <p className="text-sm text-muted-foreground mb-3">
                Build your trust score by earning reviews from Field Reps.
              </p>
              <Link to="/vendor/reviews" className="block">
                <Button variant="outline" size="sm" className="w-full text-xs">
                  View Reviews & Trust Score
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {/* Vendor Credits */}
        {isVendor && vendorCredits !== undefined && vendorCredits !== null && (
          <Card className="bg-card border-border">
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Coins className="h-4 w-4 text-primary" />
                Credits
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 pt-0">
              <div className="flex items-center justify-between mb-3">
                <span className="text-2xl font-bold text-foreground">{vendorCredits}</span>
                <span className="text-xs text-muted-foreground">available</span>
              </div>
              <Link to="/vendor/credits">
                <Button variant="outline" size="sm" className="w-full text-xs">
                  Buy More Credits
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
