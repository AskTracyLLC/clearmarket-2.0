import { DemoLayout } from "@/demo/DemoLayout";
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
  const title = isPersonal ? "My Coverage Map" : "ClearMarket Coverage Map";
  const description = isPersonal
    ? "Visualize your coverage areas and find gaps"
    : "See where ClearMarket is expanding across the nation";

  return (
    <DemoLayout role={role}>
      <div className="container mx-auto py-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">{title}</h1>
          <p className="text-muted-foreground">{description}</p>
        </div>

        <Card>
          <CardContent className="py-16 text-center">
            <div className="flex items-center justify-center gap-3 mb-4">
              <Map className="h-12 w-12 text-muted-foreground" />
              <Construction className="h-8 w-8 text-yellow-500" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Coming Soon</h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              {isPersonal
                ? "Your personalized coverage map is under development. Soon you'll be able to visualize your service areas and identify opportunities."
                : "The ClearMarket Coverage Map is under development. Soon you'll be able to see network activity across all states."}
            </p>
          </CardContent>
        </Card>
      </div>
    </DemoLayout>
  );
}
