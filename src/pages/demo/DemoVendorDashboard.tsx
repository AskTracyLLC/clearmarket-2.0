import { useNavigate } from "react-router-dom";
import { DemoAppShell } from "@/demo/DemoAppShell";
import { useDemoContext } from "@/demo/DemoContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, MapPin, Link2, Search, ArrowRight, Star } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function DemoVendorDashboard() {
  const navigate = useNavigate();
  const { demoReps, unlockedReps } = useDemoContext();

  const connectedCount = unlockedReps.length;
  const lookingForWorkCount = demoReps.filter((r) => r.looking_for_work).length;

  return (
    <DemoAppShell role="vendor">
      <div className="container mx-auto py-6 space-y-6">
        {/* Header with theme toggle */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">Vendor Dashboard</h1>
            <p className="text-muted-foreground">
              Welcome to NorthStar Field Services (Demo)
            </p>
          </div>
          <ThemeToggle />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Reps in Network</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{connectedCount}</div>
              <p className="text-xs text-muted-foreground">
                Field reps you've connected with
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Looking for Work</CardTitle>
              <Search className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{lookingForWorkCount}</div>
              <p className="text-xs text-muted-foreground">
                Available reps in your areas
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Coverage Areas</CardTitle>
              <MapPin className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">4</div>
              <p className="text-xs text-muted-foreground">
                IL, WI counties covered
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="py-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-lg">Find Field Reps</h3>
                <p className="text-sm text-muted-foreground">
                  Search for qualified field reps in your coverage areas
                </p>
              </div>
              <Button onClick={() => navigate("/demo/vendor/search")}>
                <Search className="h-4 w-4 mr-2" />
                Find Reps
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Link2 className="h-5 w-5" />
                Recent Connections
              </CardTitle>
            </CardHeader>
            <CardContent>
              {connectedCount > 0 ? (
                <div className="space-y-3">
                  {demoReps
                    .filter((r) => unlockedReps.includes(r.id))
                    .map((rep) => (
                      <div
                        key={rep.id}
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div>
                          <p className="font-medium">{rep.real_name}</p>
                          <p className="text-sm text-muted-foreground">
                            {rep.city}, {rep.coverage_states[0]}
                          </p>
                        </div>
                        <Badge variant="secondary">Connected</Badge>
                      </div>
                    ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No connections yet</p>
                  <p className="text-xs">Unlock a rep's contact to connect</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Star className="h-5 w-5" />
                Top Available Reps
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {demoReps
                  .filter((r) => r.looking_for_work)
                  .slice(0, 3)
                  .map((rep) => (
                    <div
                      key={rep.id}
                      className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/demo/vendor/rep/${rep.id}`)}
                    >
                      <div>
                        <p className="font-medium">{rep.anonymous_id}</p>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span>Trust: {rep.trust_score.toFixed(1)}</span>
                          <span>•</span>
                          <span>{rep.coverage_counties[0]} County</span>
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  ))}
              </div>
              <Button
                variant="ghost"
                className="w-full mt-4"
                onClick={() => navigate("/demo/vendor/search")}
              >
                View All Reps
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </DemoAppShell>
  );
}
