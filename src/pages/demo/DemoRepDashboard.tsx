import { useNavigate } from "react-router-dom";
import { DemoAppShell } from "@/demo/DemoAppShell";
import { useDemoContext } from "@/demo/DemoContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  User,
  Building2,
  FileText,
  ArrowRight,
  CheckCircle2,
  Star,
  Users,
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function DemoRepDashboard() {
  const navigate = useNavigate();
  const { demoReps, demoVendors } = useDemoContext();

  const currentRep = demoReps[0];
  const profileCompletion = 85;

  return (
    <DemoAppShell role="rep">
      <div className="container mx-auto py-6 space-y-6">
        {/* Header with theme toggle */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">Field Rep Dashboard</h1>
            <p className="text-muted-foreground">
              Welcome back, {currentRep.real_name}
            </p>
          </div>
          <ThemeToggle />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Profile Completion</CardTitle>
              <User className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{profileCompletion}%</div>
              <Progress value={profileCompletion} className="mt-2" />
              <p className="text-xs text-muted-foreground mt-2">
                Complete your profile to get discovered
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Vendors in Network</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
              <p className="text-xs text-muted-foreground">
                Vendors who've connected with you
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">New Posts</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">3</div>
              <p className="text-xs text-muted-foreground">
                Vendors seeking coverage in your area
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="py-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-lg">Complete Your Profile</h3>
                <p className="text-sm text-muted-foreground">
                  Add coverage areas and systems to get discovered by vendors
                </p>
              </div>
              <Button onClick={() => navigate("/demo/rep/profile")}>
                <User className="h-4 w-4 mr-2" />
                Edit Profile
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Star className="h-5 w-5" />
                Your Reputation
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm">Trust Score</span>
                <div className="flex items-center gap-2">
                  <Star className="h-4 w-4 text-yellow-500" />
                  <span className="font-bold">{currentRep.trust_score.toFixed(1)}</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Community Score</span>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-blue-500" />
                  <span className="font-bold">{currentRep.community_score}</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Reviews</span>
                <Badge variant="secondary">{currentRep.reviews.length} verified</Badge>
              </div>
              <div className="pt-2 border-t">
                <p className="text-xs text-muted-foreground">
                  <CheckCircle2 className="h-3 w-3 inline mr-1" />
                  Reviews are based on verified completed work
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Vendor Directory
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {demoVendors.slice(0, 3).map((vendor) => (
                  <div
                    key={vendor.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div>
                      <p className="font-medium text-sm">{vendor.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {vendor.coverage_states.join(", ")}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {vendor.systems[0]}
                    </Badge>
                  </div>
                ))}
              </div>
              <Button
                variant="ghost"
                className="w-full mt-4"
                onClick={() => navigate("/demo/rep/vendors")}
              >
                Browse All Vendors
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </DemoAppShell>
  );
}
