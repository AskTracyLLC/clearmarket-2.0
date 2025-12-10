import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { 
  MessageSquare, 
  Briefcase, 
  Star, 
  Coins,
  Calendar,
  CheckCircle2,
  Info
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { format, parseISO } from "date-fns";

interface AtAGlanceSidebarProps {
  isRep: boolean;
  isVendor: boolean;
  profileCompletion: number;
  unreadMessages: number;
  unreadNotifications: number;
  vendorCredits?: number | null;
  upcomingTimeOff?: {
    start_date: string;
    end_date: string;
    auto_reply_enabled: boolean;
  } | null;
  pendingConnections?: number;
  newOpportunities?: number;
}

export function AtAGlanceSidebar({
  isRep,
  isVendor,
  profileCompletion,
  unreadMessages,
  vendorCredits,
  upcomingTimeOff,
  pendingConnections = 0,
  newOpportunities = 0,
}: AtAGlanceSidebarProps) {

  // Mobile: Single consolidated card view
  // Desktop: Multiple separate cards
  return (
    <>
      {/* Mobile: Single consolidated card */}
      <div className="lg:hidden">
        <Card className="bg-card border-border">
          <CardContent className="p-4 space-y-5">
            {/* Profile & Coverage Section */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium flex items-center gap-2">
                  {profileCompletion === 100 && (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  )}
                  Profile Setup
                </span>
                <span className="text-xs text-muted-foreground">{profileCompletion}%</span>
              </div>
              <Progress value={profileCompletion} className="h-2" />
            </div>

            {/* Divider */}
            <div className="border-t border-border" />

            {/* Quick Stats */}
            <div>
              <h4 className="text-sm font-medium mb-3">Quick Stats</h4>
              <div className="space-y-2">
                <Link to="/messages" className="flex items-center justify-between hover:bg-muted/50 p-2 -mx-2 rounded-md transition-colors">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MessageSquare className="h-4 w-4" />
                    Unread Messages
                  </div>
                  <Badge variant={unreadMessages > 0 ? "default" : "secondary"} className="text-xs">
                    {unreadMessages}
                  </Badge>
                </Link>

                {isRep && (
                  <div className="flex items-center justify-between hover:bg-muted/50 p-2 -mx-2 rounded-md transition-colors">
                    <Link to="/rep/find-work" className="flex items-center gap-2 text-sm text-muted-foreground flex-1">
                      <Briefcase className="h-4 w-4" />
                      New Opportunities
                    </Link>
                    <div className="flex items-center gap-2">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              className="p-0.5 rounded-full text-muted-foreground hover:text-foreground transition-colors"
                              aria-label="How opportunities work"
                            >
                              <Info className="h-3.5 w-3.5" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="left" className="max-w-xs whitespace-pre-line">
                            {"These are posts from vendors looking for help in your work areas.\nYou'll see opportunities based on the coverage you saved in your profile."}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <Link to="/rep/find-work">
                        <Badge variant={newOpportunities > 0 ? "default" : "secondary"} className="text-xs">
                          {newOpportunities}
                        </Badge>
                      </Link>
                    </div>
                  </div>
                )}

                {isRep && pendingConnections > 0 && (
                  <Link to="/messages" className="flex items-center justify-between hover:bg-muted/50 p-2 -mx-2 rounded-md transition-colors">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Star className="h-4 w-4" />
                      Pending Connections
                    </div>
                    <Badge variant="default" className="text-xs">
                      {pendingConnections}
                    </Badge>
                  </Link>
                )}

                <Link to={isRep ? "/rep/reviews" : "/vendor/reviews"} className="flex items-center justify-between hover:bg-muted/50 p-2 -mx-2 rounded-md transition-colors">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Star className="h-4 w-4" />
                    Reviews & Trust Score
                  </div>
                  <span className="text-xs text-muted-foreground">View →</span>
                </Link>
              </div>
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
        {/* Profile Setup - Clean static summary card */}
        <Card className="bg-card border-border">
          <CardHeader className="py-3 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                {profileCompletion === 100 && (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                )}
                Profile Setup
              </CardTitle>
              <span className="text-xs text-muted-foreground">{profileCompletion}%</span>
            </div>
          </CardHeader>
          <CardContent className="pt-0 px-4 pb-4">
            <Progress value={profileCompletion} className="h-2 mb-3" />
            <p className="text-xs text-muted-foreground mb-3">
              {profileCompletion < 100 
                ? "Complete your profile to show up in more searches."
                : "Your profile is complete and visible to others."
              }
            </p>
            <div className="space-y-2">
              <Link to={isRep ? "/rep/profile" : "/vendor/profile"}>
                <Button variant="default" size="sm" className="w-full text-xs">
                  View / Edit Profile
                </Button>
              </Link>
              <Link to={isRep ? "/rep/profile" : "/vendor/profile"}>
                <Button variant="outline" size="sm" className="w-full text-xs">
                  Manage Coverage & Rates
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <Card className="bg-card border-border">
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm font-medium">Quick Stats</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-0 space-y-3">
            <Link to="/messages" className="flex items-center justify-between hover:bg-muted/50 p-2 -mx-2 rounded-md transition-colors">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MessageSquare className="h-4 w-4" />
                Unread Messages
              </div>
              <Badge variant={unreadMessages > 0 ? "default" : "secondary"} className="text-xs">
                {unreadMessages}
              </Badge>
            </Link>

            {isRep && (
              <>
                <div className="flex items-center justify-between hover:bg-muted/50 p-2 -mx-2 rounded-md transition-colors">
                  <Link to="/rep/find-work" className="flex items-center gap-2 text-sm text-muted-foreground flex-1">
                    <Briefcase className="h-4 w-4" />
                    New Opportunities
                  </Link>
                  <div className="flex items-center gap-2">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            className="p-0.5 rounded-full text-muted-foreground hover:text-foreground transition-colors"
                            aria-label="How opportunities work"
                          >
                            <Info className="h-3.5 w-3.5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="left" className="max-w-xs whitespace-pre-line">
                          {"These are posts from vendors looking for help in your work areas.\nYou'll see opportunities based on the coverage you saved in your profile."}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <Link to="/rep/find-work">
                      <Badge variant={newOpportunities > 0 ? "default" : "secondary"} className="text-xs">
                        {newOpportunities}
                      </Badge>
                    </Link>
                  </div>
                </div>

                {pendingConnections > 0 && (
                  <Link to="/messages" className="flex items-center justify-between hover:bg-muted/50 p-2 -mx-2 rounded-md transition-colors">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Star className="h-4 w-4" />
                      Pending Connections
                    </div>
                    <Badge variant="default" className="text-xs">
                      {pendingConnections}
                    </Badge>
                  </Link>
                )}
              </>
            )}

            <Link to={isRep ? "/rep/reviews" : "/vendor/reviews"} className="flex items-center justify-between hover:bg-muted/50 p-2 -mx-2 rounded-md transition-colors">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Star className="h-4 w-4" />
                Reviews
              </div>
              <span className="text-xs text-muted-foreground">View →</span>
            </Link>
          </CardContent>
        </Card>

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
      </div>
    </>
  );
}
