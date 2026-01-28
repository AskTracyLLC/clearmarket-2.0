import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Star, MapPin, Briefcase, AlertCircle } from "lucide-react";
import {
  aggregateReviewsByArea,
  aggregateReviewsByInspectionType,
  LOCAL_FIT_MIN_REVIEWS,
  type AreaReviewAggregate,
  type InspectionTypeReviewAggregate,
} from "@/lib/reviewContext";

interface ReviewBreakdownTabsProps {
  userId: string;
  overallStats: {
    avgOnTime: number;
    avgQuality: number;
    avgCommunication: number;
    reviewCount: number;
  };
}

export function ReviewBreakdownTabs({ userId, overallStats }: ReviewBreakdownTabsProps) {
  const [activeTab, setActiveTab] = useState("overall");
  const [areaAggregates, setAreaAggregates] = useState<AreaReviewAggregate[]>([]);
  const [typeAggregates, setTypeAggregates] = useState<InspectionTypeReviewAggregate[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadAggregates() {
      if (activeTab === "by-area" && areaAggregates.length === 0) {
        setLoading(true);
        const data = await aggregateReviewsByArea(userId);
        setAreaAggregates(data);
        setLoading(false);
      } else if (activeTab === "by-type" && typeAggregates.length === 0) {
        setLoading(true);
        const data = await aggregateReviewsByInspectionType(userId);
        setTypeAggregates(data);
        setLoading(false);
      }
    }
    loadAggregates();
  }, [activeTab, userId]);

  const renderRatingCell = (value: number, meetsMinimum: boolean = true) => (
    <div className="flex items-center gap-1">
      <Star className={`h-3 w-3 ${meetsMinimum ? "fill-primary text-primary" : "fill-muted text-muted-foreground"}`} />
      <span className={`text-sm font-medium ${!meetsMinimum ? "text-muted-foreground" : ""}`}>
        {value.toFixed(1)}
      </span>
    </div>
  );

  const renderMinimumNotice = () => (
    <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 px-3 py-2 rounded-md mb-3">
      <AlertCircle className="h-3 w-3" />
      <span>Local Fit Scores require {LOCAL_FIT_MIN_REVIEWS}+ reviews to display. Areas with fewer reviews show data but are not included in Local Fit scoring.</span>
    </div>
  );

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <TabsList className="grid w-full grid-cols-3 mb-4">
        <TabsTrigger value="overall">Overall</TabsTrigger>
        <TabsTrigger value="by-area">By Area</TabsTrigger>
        <TabsTrigger value="by-type">By Inspection Type</TabsTrigger>
      </TabsList>

      <TabsContent value="overall">
        <Card>
          <CardContent className="pt-4">
            {overallStats.reviewCount === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No reviews yet. Your ratings will appear here as vendors review your work.
              </p>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <span className="text-sm text-muted-foreground">Total Accepted Reviews</span>
                  <Badge variant="secondary">{overallStats.reviewCount}</Badge>
                </div>
                
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground mb-1">On-Time</p>
                    {renderRatingCell(overallStats.avgOnTime)}
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground mb-1">Quality</p>
                    {renderRatingCell(overallStats.avgQuality)}
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground mb-1">Communication</p>
                    {renderRatingCell(overallStats.avgCommunication)}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="by-area">
        <Card>
          <CardContent className="pt-4">
            {loading ? (
              <p className="text-sm text-muted-foreground text-center py-4">Loading...</p>
            ) : areaAggregates.length === 0 ? (
              <div className="text-center py-4">
                <MapPin className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  No location data available. Future reviews with area context will appear here.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {renderMinimumNotice()}
                <div className="text-xs text-muted-foreground mb-2">
                  Performance by location ({areaAggregates.length} areas)
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 font-medium text-muted-foreground">Location</th>
                        <th className="text-center py-2 font-medium text-muted-foreground">Reviews</th>
                        <th className="text-center py-2 font-medium text-muted-foreground">Local Score</th>
                        <th className="text-center py-2 font-medium text-muted-foreground">On-Time</th>
                        <th className="text-center py-2 font-medium text-muted-foreground">Quality</th>
                        <th className="text-center py-2 font-medium text-muted-foreground">Comm.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {areaAggregates.map((area, idx) => (
                        <tr key={idx} className={`border-b border-border/50 ${!area.meetsMinimum ? "opacity-60" : ""}`}>
                          <td className="py-2">
                            <div className="flex items-center gap-1">
                              <MapPin className="h-3 w-3 text-muted-foreground" />
                              <span>{area.locationLabel}</span>
                            </div>
                          </td>
                          <td className="text-center py-2">
                            <Badge 
                              variant={area.meetsMinimum ? "secondary" : "outline"} 
                              className="text-xs"
                            >
                              {area.reviewCount}
                            </Badge>
                          </td>
                          <td className="text-center py-2">
                            {area.meetsMinimum ? (
                              <div className="flex items-center justify-center gap-1">
                                <Star className="h-3 w-3 fill-primary text-primary" />
                                <span className="font-semibold">{area.avgOverall.toFixed(1)}</span>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">Need {LOCAL_FIT_MIN_REVIEWS - area.reviewCount} more</span>
                            )}
                          </td>
                          <td className="text-center py-2">{renderRatingCell(area.avgOnTime, area.meetsMinimum)}</td>
                          <td className="text-center py-2">{renderRatingCell(area.avgQuality, area.meetsMinimum)}</td>
                          <td className="text-center py-2">{renderRatingCell(area.avgCommunication, area.meetsMinimum)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="by-type">
        <Card>
          <CardContent className="pt-4">
            {loading ? (
              <p className="text-sm text-muted-foreground text-center py-4">Loading...</p>
            ) : typeAggregates.length === 0 ? (
              <div className="text-center py-4">
                <Briefcase className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  No inspection type data available. Future reviews with work type context will appear here.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {renderMinimumNotice()}
                <div className="text-xs text-muted-foreground mb-2">
                  Performance by inspection type ({typeAggregates.length} types)
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 font-medium text-muted-foreground">Inspection Type</th>
                        <th className="text-center py-2 font-medium text-muted-foreground">Reviews</th>
                        <th className="text-center py-2 font-medium text-muted-foreground">Local Score</th>
                        <th className="text-center py-2 font-medium text-muted-foreground">On-Time</th>
                        <th className="text-center py-2 font-medium text-muted-foreground">Quality</th>
                        <th className="text-center py-2 font-medium text-muted-foreground">Comm.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {typeAggregates.map((type, idx) => (
                        <tr key={idx} className={`border-b border-border/50 ${!type.meetsMinimum ? "opacity-60" : ""}`}>
                          <td className="py-2">
                            <div className="flex flex-col">
                              <span className="text-xs text-muted-foreground">{type.categoryLabel}</span>
                              {type.typeLabel && (
                                <span className="font-medium">{type.typeLabel}</span>
                              )}
                            </div>
                          </td>
                          <td className="text-center py-2">
                            <Badge 
                              variant={type.meetsMinimum ? "secondary" : "outline"} 
                              className="text-xs"
                            >
                              {type.reviewCount}
                            </Badge>
                          </td>
                          <td className="text-center py-2">
                            {type.meetsMinimum ? (
                              <div className="flex items-center justify-center gap-1">
                                <Star className="h-3 w-3 fill-primary text-primary" />
                                <span className="font-semibold">{type.avgOverall.toFixed(1)}</span>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">Need {LOCAL_FIT_MIN_REVIEWS - type.reviewCount} more</span>
                            )}
                          </td>
                          <td className="text-center py-2">{renderRatingCell(type.avgOnTime, type.meetsMinimum)}</td>
                          <td className="text-center py-2">{renderRatingCell(type.avgQuality, type.meetsMinimum)}</td>
                          <td className="text-center py-2">{renderRatingCell(type.avgCommunication, type.meetsMinimum)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
