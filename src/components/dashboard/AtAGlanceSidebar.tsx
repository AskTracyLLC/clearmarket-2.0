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
  ChevronDown,
  ChevronUp,
  CheckCircle2
} from "lucide-react";
import { useState } from "react";

interface AtAGlanceSidebarProps {
  isRep: boolean;
  isVendor: boolean;
  profileCompletion: number;
  unreadMessages: number;
  unreadNotifications: number;
  vendorCredits?: number | null;
  pendingConnections?: number;
  newOpportunities?: number;
}

export function AtAGlanceSidebar({
  isRep,
  isVendor,
  profileCompletion,
  unreadMessages,
  vendorCredits,
  pendingConnections = 0,
  newOpportunities = 0,
}: AtAGlanceSidebarProps) {
  const [showProfileSection, setShowProfileSection] = useState(profileCompletion < 100);

  return (
    <div className="space-y-4">
      {/* Profile Completion - Collapsible when 100% */}
      <Card className="bg-card border-border">
        <CardHeader className="py-3 px-4">
          <div 
            className="flex items-center justify-between cursor-pointer"
            onClick={() => setShowProfileSection(!showProfileSection)}
          >
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              {profileCompletion === 100 && (
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              )}
              Profile Setup
            </CardTitle>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{profileCompletion}%</span>
              {profileCompletion === 100 ? (
                showProfileSection ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
              ) : null}
            </div>
          </div>
        </CardHeader>
        {(showProfileSection || profileCompletion < 100) && (
          <CardContent className="pt-0 px-4 pb-4">
            <Progress value={profileCompletion} className="h-2 mb-3" />
            {profileCompletion < 100 && (
              <p className="text-xs text-muted-foreground text-center mb-3">
                Complete your profile to be discoverable
              </p>
            )}
            <div className="space-y-2">
              <Link to={isRep ? "/rep/profile" : "/vendor/profile"}>
                <Button variant="default" size="sm" className="w-full text-xs">
                  {isRep ? "View / Edit Profile" : "View / Edit Company Profile"}
                </Button>
              </Link>
              <Link to={isRep ? "/rep/profile" : "/vendor/profile"}>
                <Button variant="outline" size="sm" className="w-full text-xs">
                  {isRep ? "Manage Coverage & Rates" : "Manage Coverage & Pricing"}
                </Button>
              </Link>
            </div>
          </CardContent>
        )}
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
              <Link to="/rep/find-work" className="flex items-center justify-between hover:bg-muted/50 p-2 -mx-2 rounded-md transition-colors">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Briefcase className="h-4 w-4" />
                  New Opportunities
                </div>
                <Badge variant={newOpportunities > 0 ? "default" : "secondary"} className="text-xs">
                  {newOpportunities}
                </Badge>
              </Link>

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
    </div>
  );
}
