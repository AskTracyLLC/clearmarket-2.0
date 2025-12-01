import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Search, MapPin, Eye, MessageSquare, Building2, Shield } from "lucide-react";
import { US_STATES } from "@/lib/constants";
import { fetchTrustScoresForUsers } from "@/lib/reviews";
import { ReviewsDetailDialog } from "@/components/ReviewsDetailDialog";
import { PublicProfileDialog } from "@/components/PublicProfileDialog";
import { getOrCreateConversation } from "@/lib/conversations";

const INSPECTION_TYPE_OPTIONS = [
  "Property Inspections",
  "Loss/Insurance Claims",
  "Commercial",
  "Other"
];

interface County {
  id: string;
  county_name: string;
  state_code: string;
}

interface VendorResult {
  id: string;
  user_id: string;
  anonymous_id: string | null;
  company_name: string;
  city: string | null;
  state: string | null;
  primary_inspection_types: string[];
  systems_used: string[];
  is_accepting_new_reps: boolean;
  trustScore?: number | null;
  trustScoreCount?: number;
  connectedSince?: string | null;
  conversationId?: string | null;
  // Review dimensions for vendor rating
  helpfulnessRating?: number | null;
  communicationRating?: number | null;
  payReliabilityRating?: number | null;
  // Background check expectations
  requiresActiveBackgroundCheck?: boolean;
  acceptsWillingToObtain?: boolean;
}

export default function RepFindVendors() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  
  // Filter state
  const [selectedState, setSelectedState] = useState<string>("");
  const [availableCounties, setAvailableCounties] = useState<County[]>([]);
  const [selectedCounty, setSelectedCounty] = useState<string>("");
  const [selectedInspectionTypes, setSelectedInspectionTypes] = useState<string[]>([]);
  const [bgCheckMode, setBgCheckMode] = useState<"any" | "requires-active" | "accepts-willing">("any");

  // Results state
  const [results, setResults] = useState<VendorResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [searching, setSearching] = useState(false);

  // Dialog state
  const [showReviewsDialog, setShowReviewsDialog] = useState(false);
  const [reviewsDialogUserId, setReviewsDialogUserId] = useState<string | null>(null);
  const [showProfileDialog, setShowProfileDialog] = useState(false);
  const [profileDialogUserId, setProfileDialogUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && user) {
      checkAccess();
    }
  }, [user, authLoading]);

  useEffect(() => {
    if (selectedState) {
      loadCountiesForState(selectedState);
    } else {
      setAvailableCounties([]);
      setSelectedCounty("");
    }
  }, [selectedState]);

  const checkAccess = async () => {
    if (!user) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("is_fieldrep")
      .eq("id", user.id)
      .single();

    if (!profile?.is_fieldrep) {
      toast.error("Access denied: Field rep role required");
      navigate("/dashboard");
      return;
    }

    setLoading(false);
  };

  const loadCountiesForState = async (stateCode: string) => {
    const { data, error } = await supabase
      .from("us_counties")
      .select("id, county_name, state_code")
      .eq("state_code", stateCode)
      .order("county_name");

    if (error) {
      console.error("Error loading counties:", error);
      return;
    }

    setAvailableCounties(data || []);
  };

  const handleSearch = async () => {
    if (!selectedState) {
      toast.error("Please select a state");
      return;
    }

    setSearching(true);
    setHasSearched(true);

    try {
      // Query vendor_coverage_areas filtered by state (and optionally county)
      let coverageQuery = supabase
        .from("vendor_coverage_areas")
        .select(`
          user_id,
          state_code,
          county_id,
          covers_entire_state,
          coverage_mode,
          included_county_ids,
          excluded_county_ids,
          inspection_types
        `)
        .eq("state_code", selectedState);

      const { data: coverageData, error: coverageError } = await coverageQuery;

      if (coverageError) throw coverageError;

      // Filter by county if selected
      let filteredCoverage = coverageData || [];
      if (selectedCounty) {
        filteredCoverage = filteredCoverage.filter(cov => {
          if (cov.coverage_mode === "entire_state") return true;
          if (cov.coverage_mode === "entire_state_except") {
            return !(cov.excluded_county_ids || []).includes(selectedCounty);
          }
          if (cov.coverage_mode === "selected_counties") {
            return (cov.included_county_ids || []).includes(selectedCounty);
          }
          return false;
        });
      }

      // Get unique vendor user IDs
      const vendorUserIds = [...new Set(filteredCoverage.map(c => c.user_id))];

      if (vendorUserIds.length === 0) {
        setResults([]);
        toast.info("No vendors found for this area");
        setSearching(false);
        return;
      }

      // Fetch vendor profiles
      const { data: vendorProfiles, error: profileError } = await supabase
        .from("vendor_profile")
        .select("user_id, anonymous_id, company_name, city, state, primary_inspection_types, systems_used, is_accepting_new_reps")
        .in("user_id", vendorUserIds);

      if (profileError) throw profileError;

      // Fetch profiles for is_vendor_admin check
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, is_vendor_admin")
        .in("id", vendorUserIds);

      if (profilesError) throw profilesError;

      // Filter to active vendors only
      const activeVendorIds = new Set(
        (profiles || []).filter(p => p.is_vendor_admin).map(p => p.id)
      );

      let filtered = (vendorProfiles || []).filter(v => activeVendorIds.has(v.user_id));

      // Filter by inspection types
      if (selectedInspectionTypes.length > 0) {
        filtered = filtered.filter(vendor => {
          return selectedInspectionTypes.some(type =>
            vendor.primary_inspection_types?.some((vType: string) => vType.includes(type))
          );
        });
      }

      // Fetch trust scores
      const trustScores = await fetchTrustScoresForUsers(filtered.map(v => v.user_id));

      // Fetch connection status (vendor_connections)
      let connectionMap = new Map<string, { conversationId?: string; connectedAt?: string }>();
      if (user && filtered.length > 0) {
        const vendorIds = filtered.map(v => v.user_id);
        const { data: connections } = await supabase
          .from("vendor_connections")
          .select("vendor_id, conversation_id, requested_at")
          .eq("field_rep_id", user.id)
          .eq("status", "connected")
          .in("vendor_id", vendorIds);

        (connections || []).forEach(conn => {
          connectionMap.set(conn.vendor_id, {
            conversationId: conn.conversation_id || undefined,
            connectedAt: conn.requested_at,
          });
        });
      }

      // Fetch review dimensions for vendors (vendor ratings by reps)
      const { data: reviewData } = await supabase
        .from("reviews")
        .select("reviewee_id, rating_on_time, rating_quality, rating_communication")
        .in("reviewee_id", filtered.map(v => v.user_id))
        .eq("direction", "rep_to_vendor");

      // Calculate average ratings per vendor
      const vendorRatings = new Map<string, { helpfulness: number; communication: number; payReliability: number; count: number }>();
      (reviewData || []).forEach(review => {
        if (!vendorRatings.has(review.reviewee_id)) {
          vendorRatings.set(review.reviewee_id, { helpfulness: 0, communication: 0, payReliability: 0, count: 0 });
        }
        const stats = vendorRatings.get(review.reviewee_id)!;
        // Map rep-to-vendor ratings: on_time -> Helpfulness, quality -> Communication, communication -> Pay Reliability
        if (review.rating_on_time) stats.helpfulness += review.rating_on_time;
        if (review.rating_quality) stats.communication += review.rating_quality;
        if (review.rating_communication) stats.payReliability += review.rating_communication;
        stats.count += 1;
      });

      // Enhance results
      const enhancedResults: VendorResult[] = filtered.map(vendor => {
        const connection = connectionMap.get(vendor.user_id);
        const trust = trustScores[vendor.user_id];
        const ratings = vendorRatings.get(vendor.user_id);

        return {
          id: vendor.user_id,
          user_id: vendor.user_id,
          anonymous_id: vendor.anonymous_id,
          company_name: vendor.company_name,
          city: vendor.city,
          state: vendor.state,
          primary_inspection_types: vendor.primary_inspection_types || [],
          systems_used: vendor.systems_used || [],
          is_accepting_new_reps: vendor.is_accepting_new_reps ?? true,
          trustScore: trust?.average ?? null,
          trustScoreCount: trust?.count ?? 0,
          connectedSince: connection?.connectedAt ?? null,
          conversationId: connection?.conversationId ?? null,
          helpfulnessRating: ratings ? ratings.helpfulness / ratings.count : null,
          communicationRating: ratings ? ratings.communication / ratings.count : null,
          payReliabilityRating: ratings ? ratings.payReliability / ratings.count : null,
          // Background check placeholders (would need to query seeking_coverage_posts)
          requiresActiveBackgroundCheck: false,
          acceptsWillingToObtain: true,
        };
      });

      setResults(enhancedResults);
      toast.success(`Found ${enhancedResults.length} matching vendors`);
    } catch (error: any) {
      console.error("Search error:", error);
      toast.error("Failed to search vendors");
    } finally {
      setSearching(false);
    }
  };

  const toggleInspectionType = (type: string) => {
    setSelectedInspectionTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  const handleViewProfile = (vendorUserId: string) => {
    setProfileDialogUserId(vendorUserId);
    setShowProfileDialog(true);
  };

  const handleViewReviews = (vendorUserId: string) => {
    setReviewsDialogUserId(vendorUserId);
    setShowReviewsDialog(true);
  };

  const handleMessage = async (vendorUserId: string, conversationId?: string) => {
    if (conversationId) {
      navigate(`/messages/${conversationId}`);
      return;
    }

    // Create direct conversation (no post origin)
    const result = await getOrCreateConversation(user!.id, vendorUserId, null);
    if (result.error) {
      toast.error(result.error);
      return;
    }

    navigate(`/messages/${result.id}`);
  };

  const renderTrustScoreBadge = (vendor: VendorResult) => {
    const score = vendor.trustScore ?? 3.0;
    const isNew = vendor.trustScoreCount === 0;

    return (
      <div
        className="cursor-pointer"
        onClick={(e) => {
          e.stopPropagation();
          handleViewReviews(vendor.user_id);
        }}
      >
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">
            Trust Score: {score.toFixed(1)} / 5
          </Badge>
          {isNew && (
            <Badge variant="outline" className="text-xs">
              New – not yet rated
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Based on {vendor.trustScoreCount} review{vendor.trustScoreCount !== 1 ? "s" : ""}
        </p>
      </div>
    );
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Find Vendors</h1>
              <p className="text-muted-foreground mt-1">
                Discover and connect with vendors in your coverage areas
              </p>
            </div>
            <Button variant="outline" onClick={() => navigate("/dashboard")}>
              Back to Dashboard
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Search Filters */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Search Filters
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* State Filter (Required) */}
            <div>
              <Label htmlFor="state-filter">State *</Label>
              <Select value={selectedState} onValueChange={setSelectedState}>
                <SelectTrigger id="state-filter" className="mt-2">
                  <SelectValue placeholder="Select a state" />
                </SelectTrigger>
                <SelectContent className="bg-background border border-border z-50">
                  {US_STATES.map(state => (
                    <SelectItem key={state.value} value={state.value}>
                      {state.value} - {state.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* County Filter (Optional) */}
            {selectedState && availableCounties.length > 0 && (
              <div>
                <Label htmlFor="county-filter">County (Optional)</Label>
                <Select value={selectedCounty} onValueChange={setSelectedCounty}>
                  <SelectTrigger id="county-filter" className="mt-2">
                    <SelectValue placeholder="All counties" />
                  </SelectTrigger>
                  <SelectContent className="bg-background border border-border z-50">
                    <SelectItem value="">All counties</SelectItem>
                    {availableCounties.map(county => (
                      <SelectItem key={county.id} value={county.id}>
                        {county.county_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Inspection Types Filter */}
            <div>
              <Label>Inspection Types (Optional)</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                {INSPECTION_TYPE_OPTIONS.map(type => (
                  <div key={type} className="flex items-center gap-2">
                    <Checkbox
                      id={`type-${type}`}
                      checked={selectedInspectionTypes.includes(type)}
                      onCheckedChange={() => toggleInspectionType(type)}
                    />
                    <Label htmlFor={`type-${type}`} className="font-normal cursor-pointer">
                      {type}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            {/* Search Button */}
            <Button
              onClick={handleSearch}
              disabled={searching || !selectedState}
              className="w-full"
            >
              {searching ? "Searching..." : "Search Vendors"}
            </Button>
          </CardContent>
        </Card>

        {/* Results */}
        {hasSearched && (
          <div className="space-y-4">
            {results.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">
                    No vendors found for this area yet. Try broadening your filters or checking again later.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Showing {results.length} vendor{results.length !== 1 ? "s" : ""}
                </p>
                {results.map(vendor => (
                  <Card key={vendor.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <CardTitle className="text-lg">
                              {vendor.anonymous_id || `Vendor#${vendor.user_id.substring(0, 6)}`}
                            </CardTitle>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewProfile(vendor.user_id)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </div>
                          <p className="text-sm font-medium text-foreground">{vendor.company_name}</p>
                          {(vendor.city || vendor.state) && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                              <MapPin className="h-3 w-3" />
                              {vendor.city && vendor.state
                                ? `${vendor.city}, ${vendor.state}`
                                : vendor.state || vendor.city}
                            </p>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Trust Score */}
                      <div>
                        <Label className="text-xs text-muted-foreground">Trust Score</Label>
                        {renderTrustScoreBadge(vendor)}
                      </div>

                      {/* Pay & Reliability Hints */}
                      {vendor.trustScoreCount > 0 && (vendor.helpfulnessRating || vendor.communicationRating || vendor.payReliabilityRating) && (
                        <div className="text-xs text-muted-foreground space-y-1">
                          {vendor.payReliabilityRating && (
                            <p>Consistent pay: {vendor.payReliabilityRating.toFixed(1)} / 5</p>
                          )}
                          {vendor.communicationRating && (
                            <p>Communication: {vendor.communicationRating.toFixed(1)} / 5</p>
                          )}
                        </div>
                      )}

                      {/* Background Check */}
                      {vendor.requiresActiveBackgroundCheck && (
                        <Badge variant="outline" className="text-xs">
                          <Shield className="h-3 w-3 mr-1" />
                          Requires active background check
                        </Badge>
                      )}

                      {/* Inspection Types */}
                      {vendor.primary_inspection_types.length > 0 && (
                        <div>
                          <Label className="text-xs text-muted-foreground">Inspection Types</Label>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {vendor.primary_inspection_types.slice(0, 3).map((type, idx) => (
                              <Badge key={idx} variant="secondary" className="text-xs">
                                {type}
                              </Badge>
                            ))}
                            {vendor.primary_inspection_types.length > 3 && (
                              <Badge variant="secondary" className="text-xs">
                                +{vendor.primary_inspection_types.length - 3} more
                              </Badge>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Connection State */}
                      {vendor.connectedSince && (
                        <p className="text-xs text-muted-foreground">
                          Connected since {new Date(vendor.connectedSince).toLocaleDateString()}
                        </p>
                      )}

                      {/* Actions */}
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewProfile(vendor.user_id)}
                        >
                          View Profile
                        </Button>
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => handleMessage(vendor.user_id, vendor.conversationId)}
                        >
                          <MessageSquare className="h-4 w-4 mr-1" />
                          Message Vendor
                        </Button>
                      </div>

                      {!vendor.connectedSince && (
                        <p className="text-xs text-muted-foreground italic">
                          You're not connected yet
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </>
            )}
          </div>
        )}
      </div>

      {/* Dialogs */}
      {showReviewsDialog && reviewsDialogUserId && (
        <ReviewsDetailDialog
          open={showReviewsDialog}
          onOpenChange={setShowReviewsDialog}
          targetUserId={reviewsDialogUserId}
        />
      )}

      {showProfileDialog && profileDialogUserId && (
        <PublicProfileDialog
          open={showProfileDialog}
          onOpenChange={setShowProfileDialog}
          targetUserId={profileDialogUserId}
        />
      )}
    </div>
  );
}
