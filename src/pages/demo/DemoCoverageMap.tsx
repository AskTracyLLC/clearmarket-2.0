import { useState, useEffect } from "react";
import { DemoAppShell } from "@/demo/DemoAppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { USChoroplethMap } from "@/components/USChoroplethMap";
import { Construction } from "lucide-react";
import { MapLoadPlaceholder } from "@/components/MapLoadPlaceholder";
import { DataFreshnessNotice } from "@/components/DataFreshnessNotice";
import { ThemeToggle } from "@/components/ThemeToggle";

type ViewMode = "reps" | "vendors" | "total";

interface StateNetworkCount {
  state_code: string;
  state_name: string;
  rep_count: number;
  rep_count_display: string;
  vendor_count: number;
  vendor_count_display: string;
  total_count: number;
  total_count_display: string;
  last_updated_at: string;
}

interface DemoCoverageMapProps {
  role: "vendor" | "rep";
}

export default function DemoCoverageMap({ role }: DemoCoverageMapProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("reps");
  const [data, setData] = useState<StateNetworkCount[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  const fetchMapData = async () => {
    setLoading(true);
    const { data: counts, error } = await supabase
      .from("public_state_network_counts")
      .select("*");

    if (!error && counts) {
      setData(counts as StateNetworkCount[]);
      if (counts.length > 0) {
        setLastUpdated(counts[0].last_updated_at);
      }
    }
    setLoading(false);
    setMapLoaded(true);
  };

  const handleLoadMap = () => {
    fetchMapData();
  };

  const getCountForState = (stateCode: string): number => {
    const stateData = data.find((d) => d.state_code === stateCode);
    if (!stateData) return 0;
    switch (viewMode) {
      case "reps":
        return stateData.rep_count;
      case "vendors":
        return stateData.vendor_count;
      case "total":
        return stateData.total_count;
    }
  };

  const getDisplayForState = (stateCode: string): string => {
    const stateData = data.find((d) => d.state_code === stateCode);
    if (!stateData) return "0";
    switch (viewMode) {
      case "reps":
        return stateData.rep_count_display;
      case "vendors":
        return stateData.vendor_count_display;
      case "total":
        return stateData.total_count_display;
    }
  };

  const getStateNameByCode = (stateCode: string): string => {
    const stateData = data.find((d) => d.state_code === stateCode);
    return stateData?.state_name || stateCode;
  };

  return (
    <DemoAppShell role={role}>
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header with theme toggle */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Coverage Map</h1>
            <p className="text-muted-foreground">
              Coverage is expanding — watch us grow as ClearMarket connects more Field Reps and Vendors nationwide.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Aggregated state-level counts only. No member locations are shown.
            </p>
          </div>
          <ThemeToggle />
        </div>

        {/* Vendor-only Coming Soon Card */}
        {role === "vendor" && (
          <Card className="mb-6 border-dashed border-2 border-muted-foreground/30 bg-muted/20">
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
          <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <CardTitle className="text-lg">Network Density by State</CardTitle>
            {mapLoaded && (
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
                  <TabsList>
                    <TabsTrigger value="reps">Field Reps</TabsTrigger>
                    <TabsTrigger value="vendors">Vendors</TabsTrigger>
                    <TabsTrigger value="total">Total</TabsTrigger>
                  </TabsList>
                </Tabs>
                <DataFreshnessNotice 
                  mode="daily" 
                  lastUpdated={lastUpdated} 
                  size="sm"
                />
              </div>
            )}
          </CardHeader>
          <CardContent>
            {!mapLoaded ? (
              <MapLoadPlaceholder
                onLoadMap={handleLoadMap}
                isLoading={loading}
                title="Coverage Map"
                description="Click to load the interactive network density map"
              />
            ) : loading ? (
              <div className="h-[400px] flex items-center justify-center">
                <span className="text-muted-foreground">Loading map data…</span>
              </div>
            ) : (
              <USChoroplethMap
                getCountForState={getCountForState}
                getDisplayForState={getDisplayForState}
                getStateNameByCode={getStateNameByCode}
              />
            )}
          </CardContent>
        </Card>

        {/* Legend */}
        <div className="mt-4 flex flex-wrap gap-3 justify-center text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: "#d1d5db" }} />
            <span>0</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: "#bfdbfe" }} />
            <span>&lt;3</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: "#93c5fd" }} />
            <span>3–9</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: "#60a5fa" }} />
            <span>10–24</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: "#3b82f6" }} />
            <span>25–49</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: "#2563eb" }} />
            <span>50–99</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: "#1d4ed8" }} />
            <span>100+</span>
          </div>
        </div>
      </div>
    </DemoAppShell>
  );
}
