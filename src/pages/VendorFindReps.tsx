import { useState } from "react";
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
import { Search, MapPin, CheckCircle2, XCircle } from "lucide-react";
import { US_STATES, SYSTEMS_LIST, INSPECTION_TYPES_LIST } from "@/lib/constants";
import { isBackgroundCheckActive } from "@/lib/backgroundCheckUtils";

// MVP placeholder options - same as used in RepProfile
const SYSTEM_OPTIONS = [
  "EZInspections",
  "InspectorADE",
  "PPW",
  "Form.com",
  "Other"
];

const INSPECTION_TYPE_OPTIONS = [
  "Property Inspections",
  "Loss/Insurance Claims",
  "Commercial",
  "Other"
];

interface SeekingCoveragePost {
  id: string;
  title: string;
  state_code: string;
  county_id: string | null;
  covers_entire_state: boolean;
  pay_type: string;
  pay_min: number | null;
  pay_max: number | null;
  requires_background_check: boolean;
  requires_aspen_grove: boolean;
}

interface RepCoverageArea {
  id: string;
  user_id: string;
  state_code: string;
  county_id: string | null;
  covers_entire_state: boolean;
  base_price: number | null;
}

interface RepResult {
  id: string;
  user_id: string;
  anonymous_id: string | null;
  city: string;
  state: string;
  systems_used: string[];
  inspection_types: string[];
  is_accepting_new_vendors: boolean;
  coverageAreas: RepCoverageArea[];
}

export default function VendorFindReps() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [profiles, setProfiles] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Vendor's seeking coverage posts
  const [vendorPosts, setVendorPosts] = useState<SeekingCoveragePost[]>([]);
  const [selectedPost, setSelectedPost] = useState<string | null>(null);

  // Filter state
  const [selectedState, setSelectedState] = useState<string>("all");
  const [selectedSystems, setSelectedSystems] = useState<string[]>([]);
  const [selectedInspectionTypes, setSelectedInspectionTypes] = useState<string[]>([]);
  const [onlyAccepting, setOnlyAccepting] = useState(false);
  
  // "Other" text search inputs
  const [otherSystemText, setOtherSystemText] = useState<string>("");
  const [otherInspectionTypeText, setOtherInspectionTypeText] = useState<string>("");

  // Results state
  const [results, setResults] = useState<RepResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [searching, setSearching] = useState(false);

  // Check auth and vendor role
  useState(() => {
    const checkAuth = async () => {
      if (!authLoading && user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("is_vendor_admin, is_vendor_staff")
          .eq("id", user.id)
          .single();

        setProfiles(profile);

        if (!profile?.is_vendor_admin && !profile?.is_vendor_staff) {
          toast.error("Access denied: Vendor role required");
          navigate("/dashboard");
          return;
        }

        // Load vendor's seeking coverage posts for pricing context
        const { data: posts } = await supabase
          .from("seeking_coverage_posts")
          .select("id, title, state_code, county_id, covers_entire_state, pay_type, pay_min, pay_max, requires_background_check, requires_aspen_grove")
          .eq("vendor_id", user.id)
          .eq("status", "active")
          .is("deleted_at", null)
          .order("created_at", { ascending: false });

        setVendorPosts(posts || []);
      }
      setLoading(false);
    };

    checkAuth();
  });

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!user || (!profiles?.is_vendor_admin && !profiles?.is_vendor_staff)) {
    return null;
  }

  const handleSearch = async () => {
    setSearching(true);
    setHasSearched(true);

    try {
      // Get the selected post if pricing filter is enabled
      const post = selectedPost ? vendorPosts.find(p => p.id === selectedPost) : null;

      let query = supabase
        .from("rep_profile")
        .select("id, user_id, anonymous_id, city, state, systems_used, inspection_types, is_accepting_new_vendors, background_check_is_active, background_check_provider, background_check_expires_on");

      // Apply state filter
      if (selectedState !== "all") {
        query = query.eq("state", selectedState);
      }

      // Apply accepting filter
      if (onlyAccepting) {
        query = query.eq("is_accepting_new_vendors", true);
      }

      const { data, error } = await query;

      if (error) throw error;

      // For each rep, load their coverage areas with pricing and background check info
      const repsWithCoverage = await Promise.all(
        (data || []).map(async (rep) => {
          const { data: coverageData } = await supabase
            .from("rep_coverage_areas")
            .select("id, user_id, state_code, county_id, covers_entire_state, base_price")
            .eq("user_id", rep.user_id);

          return {
            ...rep,
            coverageAreas: coverageData || [],
          };
        })
      );

      // Client-side filtering for systems and inspection types
      let filtered = repsWithCoverage;

      if (selectedSystems.length > 0 || otherSystemText.trim()) {
        filtered = filtered.filter((rep) => {
          const matchesStandardSystems = selectedSystems.length === 0 || selectedSystems.some((sys) =>
            rep.systems_used?.some((repSys: string) => repSys.includes(sys))
          );
          
          const matchesOtherSystem = !otherSystemText.trim() || rep.systems_used?.some((repSys: string) => {
            if (repSys.startsWith("Other: ")) {
              const otherValue = repSys.substring(7);
              return otherValue.toLowerCase().includes(otherSystemText.toLowerCase());
            }
            return false;
          });
          
          return matchesStandardSystems || matchesOtherSystem;
        });
      }

      if (selectedInspectionTypes.length > 0 || otherInspectionTypeText.trim()) {
        filtered = filtered.filter((rep) => {
          const matchesStandardTypes = selectedInspectionTypes.length === 0 || selectedInspectionTypes.some((type) =>
            rep.inspection_types?.some((repType: string) => repType.includes(type))
          );
          
          const matchesOtherType = !otherInspectionTypeText.trim() || rep.inspection_types?.some((repType: string) => {
            if (repType.startsWith("Other: ")) {
              const otherValue = repType.substring(7);
              return otherValue.toLowerCase().includes(otherInspectionTypeText.toLowerCase());
            }
            return false;
          });
          
          return matchesStandardTypes || matchesOtherType;
        });
      }

      // Apply pricing filter if a post is selected
      if (post) {
        // Use COALESCE logic: pay_max if available, otherwise pay_min
        const vendorEffectiveRate = post.pay_max !== null && post.pay_max !== undefined 
          ? post.pay_max 
          : post.pay_min;

        filtered = filtered.filter((rep) => {
          // Background check requirement check
          if (post.requires_background_check) {
            if (!isBackgroundCheckActive({
              background_check_is_active: rep.background_check_is_active,
              background_check_expires_on: rep.background_check_expires_on,
            })) {
              return false; // Rep doesn't have an active background check
            }

            // AspenGrove-specific requirement
            if (post.requires_aspen_grove && rep.background_check_provider !== "aspen_grove") {
              return false; // Rep doesn't have AspenGrove background check
            }
          }

          // Rep must have at least one coverage area matching the post's location with valid base_price
          return rep.coverageAreas.some((coverage: RepCoverageArea) => {
            // Check if coverage area matches post location
            const locationMatches = 
              (post.covers_entire_state && coverage.state_code === post.state_code) ||
              (post.county_id && coverage.county_id === post.county_id) ||
              (coverage.covers_entire_state && coverage.state_code === post.state_code);

            if (!locationMatches) return false;

            // Check pricing: base_price must be set and vendor pay must meet it
            if (coverage.base_price === null || coverage.base_price === undefined) {
              return false; // Exclude coverage with no base_price set
            }

            if (vendorEffectiveRate === null || vendorEffectiveRate === undefined) {
              return false; // Exclude if vendor has no pricing
            }

            return vendorEffectiveRate >= coverage.base_price;
          });
        });
      }

      setResults(filtered as RepResult[]);
      toast.success(`Found ${filtered.length} matching reps`);
    } catch (error: any) {
      console.error("Search error:", error);
      toast.error("Failed to search reps");
    } finally {
      setSearching(false);
    }
  };

  const toggleSystem = (system: string) => {
    setSelectedSystems((prev) =>
      prev.includes(system)
        ? prev.filter((s) => s !== system)
        : [...prev, system]
    );
  };

  const toggleInspectionType = (type: string) => {
    setSelectedInspectionTypes((prev) =>
      prev.includes(type)
        ? prev.filter((t) => t !== type)
        : [...prev, type]
    );
  };

  const handleUnlockClick = () => {
    toast.info("Unlocking contacts will be available soon in ClearMarket 2.0.");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Find Reps</h1>
              <p className="text-muted-foreground mt-1">
                MVP Preview - Browse field reps (unlock coming soon)
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
            {/* Post Selection for Pricing Filter */}
            {vendorPosts.length > 0 && (
              <div>
                <Label htmlFor="post-filter">Filter by Post (for pricing match)</Label>
                <Select value={selectedPost || "none"} onValueChange={(val) => setSelectedPost(val === "none" ? null : val)}>
                  <SelectTrigger id="post-filter" className="mt-2">
                    <SelectValue placeholder="No post selected (all reps)" />
                  </SelectTrigger>
                  <SelectContent className="bg-background border border-border z-50">
                    <SelectItem value="none">No post selected (all reps)</SelectItem>
                    {vendorPosts.map((post) => (
                      <SelectItem key={post.id} value={post.id}>
                        {post.title} - ${post.pay_min}{post.pay_type === "range" && post.pay_max ? `–$${post.pay_max}` : ""} / order
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  Select a post to only see reps whose pricing aligns with your offer
                </p>
              </div>
            )}

            {/* State Filter */}
            <div>
              <Label htmlFor="state-filter">State</Label>
              <Select value={selectedState} onValueChange={setSelectedState}>
                <SelectTrigger id="state-filter" className="mt-2">
                  <SelectValue placeholder="All states" />
                </SelectTrigger>
                <SelectContent className="bg-background border border-border z-50">
                  <SelectItem value="all">All states</SelectItem>
                  {US_STATES.map((state) => (
                    <SelectItem key={state.value} value={state.value}>
                      {state.value} - {state.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Systems Used Filter */}
            <div>
              <Label>Systems Used</Label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-2">
                {SYSTEM_OPTIONS.map((system) => (
                  <div key={system} className="flex items-center gap-2">
                    <Checkbox
                      id={`system-${system}`}
                      checked={selectedSystems.includes(system)}
                      onCheckedChange={() => toggleSystem(system)}
                    />
                    <Label
                      htmlFor={`system-${system}`}
                      className="font-normal cursor-pointer"
                    >
                      {system}
                    </Label>
                  </div>
                ))}
              </div>
              
              {/* "Other" system text search */}
              {selectedSystems.includes("Other") && (
                <div className="mt-3">
                  <Label htmlFor="other-system-text" className="text-sm">
                    Other system (search text)
                  </Label>
                  <Input
                    id="other-system-text"
                    value={otherSystemText}
                    onChange={(e) => setOtherSystemText(e.target.value)}
                    placeholder="e.g., Safeguard, Safeview"
                    className="mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Search for reps using custom systems
                  </p>
                </div>
              )}
            </div>

            {/* Inspection Types Filter */}
            <div>
              <Label>Inspection Types</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                {INSPECTION_TYPE_OPTIONS.map((type) => (
                  <div key={type} className="flex items-center gap-2">
                    <Checkbox
                      id={`type-${type}`}
                      checked={selectedInspectionTypes.includes(type)}
                      onCheckedChange={() => toggleInspectionType(type)}
                    />
                    <Label
                      htmlFor={`type-${type}`}
                      className="font-normal cursor-pointer"
                    >
                      {type}
                    </Label>
                  </div>
                ))}
              </div>
              
              {/* "Other" inspection type text search */}
              {selectedInspectionTypes.includes("Other") && (
                <div className="mt-3">
                  <Label htmlFor="other-inspection-text" className="text-sm">
                    Other inspection type (search text)
                  </Label>
                  <Input
                    id="other-inspection-text"
                    value={otherInspectionTypeText}
                    onChange={(e) => setOtherInspectionTypeText(e.target.value)}
                    placeholder="e.g., Mystery Shopper, Disaster"
                    className="mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Search for reps performing custom inspection types
                  </p>
                </div>
              )}
            </div>

            {/* Accepting New Vendors Filter */}
            <div className="flex items-center gap-2">
              <Checkbox
                id="accepting-filter"
                checked={onlyAccepting}
                onCheckedChange={(checked) => setOnlyAccepting(checked as boolean)}
              />
              <Label htmlFor="accepting-filter" className="font-normal cursor-pointer">
                Only reps accepting new vendors
              </Label>
            </div>

            {/* Search Button */}
            <Button
              onClick={handleSearch}
              disabled={searching}
              className="w-full md:w-auto"
            >
              {searching ? "Searching..." : "Search Reps"}
            </Button>
          </CardContent>
        </Card>

        {/* Results Section */}
        {hasSearched && (
          <div>
            <h2 className="text-2xl font-semibold text-foreground mb-4">
              {results.length} {results.length === 1 ? "Rep" : "Reps"} Found
            </h2>

            {results.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">
                    No reps match these filters yet. Try adjusting your criteria or check
                    back later as more reps join ClearMarket.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {results.map((rep) => (
                  <Card key={rep.id}>
                    <CardHeader>
                      <CardTitle className="text-lg">
                        {rep.anonymous_id || `FieldRep#${rep.id.slice(0, 8)}`}
                      </CardTitle>
                      <div className="flex items-center gap-2 text-muted-foreground text-sm">
                        <MapPin className="h-4 w-4" />
                        {rep.city}, {US_STATES.find(s => s.value === rep.state)?.label || rep.state}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Systems Used */}
                      <div>
                        <p className="text-sm font-medium text-foreground mb-2">
                          Systems Used
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {rep.systems_used?.map((system, idx) => (
                            <Badge key={idx} variant="secondary" className="text-xs">
                              {system.replace("Other: ", "")}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      {/* Inspection Types */}
                      <div>
                        <p className="text-sm font-medium text-foreground mb-2">
                          Inspection Types
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {rep.inspection_types?.map((type, idx) => (
                            <Badge key={idx} variant="secondary" className="text-xs">
                              {type.replace("Other: ", "")}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      {/* Accepting Status */}
                      <div className="flex items-center gap-2 text-sm">
                        {rep.is_accepting_new_vendors ? (
                          <>
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                            <span className="text-green-500">Accepting new vendors</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="h-4 w-4 text-muted-foreground" />
                            <span className="text-muted-foreground">Not accepting</span>
                          </>
                        )}
                      </div>

                      {/* Pricing Alignment Indicator (if post selected) */}
                      {selectedPost && (() => {
                        const post = vendorPosts.find(p => p.id === selectedPost);
                        if (!post) return null;
                        
                        const vendorEffectiveRate = post.pay_max !== null && post.pay_max !== undefined 
                          ? post.pay_max 
                          : post.pay_min;
                        
                        // Find the matching coverage for this post
                        const matchingCoverage = rep.coverageAreas.find((coverage: RepCoverageArea) => {
                          const locationMatches = 
                            (post.covers_entire_state && coverage.state_code === post.state_code) ||
                            (post.county_id && coverage.county_id === post.county_id) ||
                            (coverage.covers_entire_state && coverage.state_code === post.state_code);
                          return locationMatches && coverage.base_price !== null;
                        });
                        
                        if (!matchingCoverage || !matchingCoverage.base_price) return null;
                        
                        const priceDiff = vendorEffectiveRate ? vendorEffectiveRate - matchingCoverage.base_price : 0;
                        
                        return (
                          <div className="pt-2 border-t border-border">
                            <p className="text-xs text-green-600 font-medium">
                              ✓ Pricing aligned with this rep's minimum
                              {priceDiff <= 5 && priceDiff >= 0 && (
                                <span className="text-muted-foreground ml-1">(close match)</span>
                              )}
                            </p>
                          </div>
                        );
                      })()}

                      {/* Unlock Button (Disabled) */}
                      <Button
                        onClick={handleUnlockClick}
                        disabled
                        className="w-full"
                      >
                        Unlock & Connect (Coming Soon)
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
