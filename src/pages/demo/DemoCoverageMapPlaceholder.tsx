import { DemoAppShell } from "@/demo/DemoAppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Map, Construction } from "lucide-react";

interface DemoCoverageMapPlaceholderProps {
  role: "vendor" | "rep";
  isPersonal?: boolean;
}

export default function DemoCoverageMapPlaceholder({
  role,
  isPersonal = false,
}: DemoCoverageMapPlaceholderProps) {
  return (
    <DemoAppShell role={role}>
      <div className="container mx-auto py-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Coverage Map</h1>
          <p className="text-muted-foreground">
            See where ClearMarket is expanding across the nation
          </p>
        </div>

        {/* Vendor-only Coming Soon Card */}
        {role === "vendor" && (
          <Card className="border-dashed border-2 border-muted-foreground/30 bg-muted/20">
            <CardContent className="py-6">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-full bg-yellow-500/10">
                  <Construction className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">My Coverage Map — Coming Soon</h3>
                  <p className="text-muted-foreground text-sm mt-1">
                    Vendor-specific coverage visualization is coming soon. You'll be able to see your network's geographic distribution and identify coverage gaps.
                  </p>
                  <p className="text-muted-foreground text-xs mt-2">
                    For now, view the live ClearMarket network growth map below.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="py-16 text-center">
            <div className="flex items-center justify-center gap-3 mb-4">
              <Map className="h-12 w-12 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Network Map Preview</h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              In the live app, this shows the ClearMarket network activity across all states. 
              Demo mode displays a placeholder.
            </p>
          </CardContent>
        </Card>
      </div>
    </DemoAppShell>
  );
}
