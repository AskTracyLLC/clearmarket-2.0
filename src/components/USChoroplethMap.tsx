import { useState } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  Annotation,
} from "react-simple-maps";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const GEO_URL = "https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json";

// FIPS code to state abbreviation mapping
const FIPS_TO_STATE: Record<string, string> = {
  "01": "AL", "02": "AK", "04": "AZ", "05": "AR", "06": "CA",
  "08": "CO", "09": "CT", "10": "DE", "11": "DC", "12": "FL",
  "13": "GA", "15": "HI", "16": "ID", "17": "IL", "18": "IN",
  "19": "IA", "20": "KS", "21": "KY", "22": "LA", "23": "ME",
  "24": "MD", "25": "MA", "26": "MI", "27": "MN", "28": "MS",
  "29": "MO", "30": "MT", "31": "NE", "32": "NV", "33": "NH",
  "34": "NJ", "35": "NM", "36": "NY", "37": "NC", "38": "ND",
  "39": "OH", "40": "OK", "41": "OR", "42": "PA", "44": "RI",
  "45": "SC", "46": "SD", "47": "TN", "48": "TX", "49": "UT",
  "50": "VT", "51": "VA", "53": "WA", "54": "WV", "55": "WI",
  "56": "WY", "72": "PR",
};

// Annotation offsets for small northeastern states
const ANNOTATIONS: Record<string, { dx: number; dy: number }> = {
  VT: { dx: 30, dy: -20 },
  NH: { dx: 40, dy: 0 },
  MA: { dx: 50, dy: 5 },
  RI: { dx: 50, dy: 10 },
  CT: { dx: 45, dy: 20 },
  NJ: { dx: 40, dy: 10 },
  DE: { dx: 45, dy: 5 },
  MD: { dx: 55, dy: 20 },
  DC: { dx: 50, dy: 35 },
};

// Approximate centroid coordinates for label placement
const STATE_CENTROIDS: Record<string, [number, number]> = {
  AL: [-86.9, 32.8], AK: [-153.5, 64.2], AZ: [-111.4, 34.2], AR: [-92.3, 34.9],
  CA: [-119.4, 37.2], CO: [-105.5, 39.0], CT: [-72.7, 41.6], DE: [-75.5, 39.0],
  DC: [-77.0, 38.9], FL: [-81.5, 28.1], GA: [-83.5, 32.7], HI: [-155.5, 19.9],
  ID: [-114.5, 44.2], IL: [-89.0, 40.0], IN: [-86.1, 39.9], IA: [-93.5, 42.0],
  KS: [-98.5, 38.5], KY: [-85.3, 37.8], LA: [-91.9, 31.2], ME: [-69.0, 45.3],
  MD: [-76.6, 39.0], MA: [-71.5, 42.2], MI: [-85.6, 44.3], MN: [-94.6, 46.3],
  MS: [-89.7, 32.7], MO: [-92.5, 38.4], MT: [-110.3, 47.0], NE: [-99.9, 41.5],
  NV: [-116.6, 38.8], NH: [-71.5, 43.2], NJ: [-74.4, 40.0], NM: [-106.2, 34.5],
  NY: [-75.5, 43.0], NC: [-79.0, 35.5], ND: [-100.5, 47.5], OH: [-82.8, 40.4],
  OK: [-97.5, 35.6], OR: [-120.5, 43.9], PA: [-77.2, 41.2], RI: [-71.5, 41.7],
  SC: [-81.0, 33.8], SD: [-100.0, 44.5], TN: [-86.3, 35.8], TX: [-99.9, 31.5],
  UT: [-111.5, 39.3], VT: [-72.6, 44.0], VA: [-79.5, 37.5], WA: [-120.5, 47.4],
  WV: [-80.5, 38.9], WI: [-89.6, 44.6], WY: [-107.5, 43.0],
};

interface USChoroplethMapProps {
  getCountForState: (stateCode: string) => number;
  getDisplayForState: (stateCode: string) => string;
  getStateNameByCode: (stateCode: string) => string;
}

function getColorForCount(count: number): string {
  if (count === 0) return "#d1d5db"; // gray-300
  if (count < 3) return "#bfdbfe";   // blue-200
  if (count < 10) return "#93c5fd";  // blue-300
  if (count < 25) return "#60a5fa";  // blue-400
  if (count < 50) return "#3b82f6";  // blue-500
  if (count < 100) return "#2563eb"; // blue-600
  return "#1d4ed8";                  // blue-700
}

export function USChoroplethMap({
  getCountForState,
  getDisplayForState,
  getStateNameByCode,
}: USChoroplethMapProps) {
  const [hoveredState, setHoveredState] = useState<string | null>(null);
  const [tooltipContent, setTooltipContent] = useState<string>("");

  const handleMouseEnter = (stateCode: string) => {
    const stateName = getStateNameByCode(stateCode);
    const display = getDisplayForState(stateCode);
    setHoveredState(stateCode);
    setTooltipContent(`${stateName} — ${display}`);
  };

  const handleMouseLeave = () => {
    setHoveredState(null);
    setTooltipContent("");
  };

  return (
    <TooltipProvider>
      <div className="relative w-full bg-white rounded-lg">
        <Tooltip open={!!hoveredState}>
          <TooltipTrigger asChild>
            <div className="w-full">
              <ComposableMap
                projection="geoAlbersUsa"
                projectionConfig={{
                  scale: 1000,
                }}
                style={{ width: "100%", height: "auto" }}
              >
                <Geographies geography={GEO_URL}>
                  {({ geographies }) => (
                    <>
                      {geographies.map((geo) => {
                        const fips = geo.id;
                        const stateCode = FIPS_TO_STATE[fips] || "";
                        if (!stateCode || stateCode === "PR") return null;

                        const count = getCountForState(stateCode);
                        const fillColor = getColorForCount(count);
                        const isHovered = hoveredState === stateCode;

                        return (
                          <Geography
                            key={geo.rsmKey}
                            geography={geo}
                            fill={fillColor}
                            stroke="#374151"
                            strokeWidth={isHovered ? 2 : 0.75}
                            style={{
                              default: { outline: "none" },
                              hover: { outline: "none", fill: fillColor, strokeWidth: 2 },
                              pressed: { outline: "none" },
                            }}
                            onMouseEnter={() => handleMouseEnter(stateCode)}
                            onMouseLeave={handleMouseLeave}
                          />
                        );
                      })}
                      {/* State labels */}
                      {geographies.map((geo) => {
                        const fips = geo.id;
                        const stateCode = FIPS_TO_STATE[fips] || "";
                        if (!stateCode || stateCode === "PR") return null;

                        const centroid = STATE_CENTROIDS[stateCode];
                        if (!centroid) return null;

                        // Use annotation for small states
                        const annotation = ANNOTATIONS[stateCode];
                        if (annotation) {
                          return (
                            <Annotation
                              key={`label-${stateCode}`}
                              subject={centroid}
                              dx={annotation.dx}
                              dy={annotation.dy}
                              connectorProps={{
                                stroke: "#374151",
                                strokeWidth: 1,
                              }}
                            >
                              <text
                                x={4}
                                textAnchor="start"
                                alignmentBaseline="middle"
                                fill="#111827"
                                fontSize={10}
                                fontWeight={500}
                                style={{ pointerEvents: "none" }}
                              >
                                {stateCode}
                              </text>
                            </Annotation>
                          );
                        }

                        return (
                          <Annotation
                            key={`label-${stateCode}`}
                            subject={centroid}
                            dx={0}
                            dy={0}
                            connectorProps={{}}
                          >
                            <text
                              textAnchor="middle"
                              alignmentBaseline="middle"
                              fill="#111827"
                              fontSize={10}
                              fontWeight={500}
                              style={{ pointerEvents: "none" }}
                            >
                              {stateCode}
                            </text>
                          </Annotation>
                        );
                      })}
                    </>
                  )}
                </Geographies>
              </ComposableMap>
            </div>
          </TooltipTrigger>
          {tooltipContent && (
            <TooltipContent side="top" className="bg-gray-900 text-white px-3 py-1.5 text-sm">
              {tooltipContent}
            </TooltipContent>
          )}
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
