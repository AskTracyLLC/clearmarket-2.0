import { useEffect, useState } from "react";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { Search, MapPin, Calendar, AlertCircle, ExternalLink, Building2, Bell, X, Clock } from "lucide-react";
import { US_STATES } from "@/lib/constants";
import { isBackgroundCheckActive } from "@/lib/backgroundCheckUtils";
import RepMatchSettingsDialog from "@/components/RepMatchSettingsDialog";
import { getRepMatchSettings } from "@/lib/matchAlerts";
import AdminViewBanner from "@/components/AdminViewBanner";
import { MatchAssistantCard } from "@/components/dashboard/MatchAssistantCard";

import { ExpressInterestDialog } from "@/components/ExpressInterestDialog";
import { NotInterestedDialog } from "@/components/NotInterestedDialog";
import { seekingCoverageCopy } from "@/copy/seekingCoverageCopy";
import { usePagination } from "@/hooks/usePagination";
import { PaginationControls } from "@/components/PaginationControls";
import { DataFreshnessNotice } from "@/components/DataFreshnessNotice";

// MVP options for inspection types and systems
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

// Mapping of inspection type keywords to their category
// This helps match rep-specific types (e.g., "Full Interior/Exterior") to vendor categories (e.g., "Property Inspections")
const INSPECTION_TYPE_CATEGORY_KEYWORDS: Record<string, string[]> = {
  "property inspections": ["exterior", "interior", "occupancy", "condition", "preservation", "bpo", "disaster", "property"],
  "loss / insurance claims (appointment-based)": ["loss", "insurance", "claim", "draft", "draw"],
  "loss/insurance claims": ["loss", "insurance", "claim", "draft", "draw"],
  "commercial": ["commercial", "multi-family", "industrial", "mystery"],
  "notary services": ["notary"],
  "other": []
};

// Helper to check if a rep's inspection type matches a vendor's requested category/type
const inspectionTypeMatches = (postType: string, repType: string): boolean => {
  const postLower = postType.toLowerCase().trim();
  const repLower = repType.toLowerCase().trim();
  
  // Direct substring match (original logic)
  if (postLower.includes(repLower) || repLower.includes(postLower)) {
    return true;
  }
  
  // Check if the vendor's type is a category and the rep's type has keywords for that category
  for (const [category, keywords] of Object.entries(INSPECTION_TYPE_CATEGORY_KEYWORDS)) {
    // If the vendor's post type matches this category
    if (postLower.includes(category) || category.includes(postLower)) {
      // Check if the rep's type contains any keywords for this category
      if (keywords.some(kw => repLower.includes(kw))) {
        return true;
      }
    }
    // Also check if rep's type matches a category and vendor requested something in that category
    if (repLower.includes(category) || category.includes(repLower)) {
      if (keywords.some(kw => postLower.includes(kw))) {
        return true;
      }
    }
  }
  
  return false;
};

interface SeekingCoveragePost {
  id: string;
  vendor_id: string;
  title: string;
  description: string | null;
  state_code: string | null;
  county_id: string | null;
  inspection_types: string[];
  systems_required_array: string[];
  status: string;
  created_at: string;
  expires_at: string | null;
  is_accepting_responses: boolean;
  pay_type: string;
  pay_min: number | null;
  pay_max: number | null;
  pay_notes: string | null;
  requires_background_check: boolean;
  requires_aspen_grove: boolean;
  allow_willing_to_obtain_background_check?: boolean | null;
}

interface VendorInfo {
  anonymous_id: string | null;
  company_name: string;
  is_accepting_new_reps: boolean;
}

interface CountyInfo {
  county_name: string;
  state_code: string;
}

interface CoverageArea {
  id: string;
  state_code: string;
  county_id: string | null;
  county_name: string | null;
  covers_entire_state: boolean;
  covers_entire_county: boolean;
  base_price: number | null;
  rush_price: number | null;
}

interface MatchedPost extends SeekingCoveragePost {
  vendor: VendorInfo;
  county: CountyInfo | null;
}

export default function RepFindWork() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [repProfile, setRepProfile] = useState<any>(null);
  const [coverageAreas, setCoverageAreas] = useState<CoverageArea[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter state
  const [selectedState, setSelectedState] = useState<string>("all");
  const [selectedCounty, setSelectedCounty] = useState<string>("all");
  const [availableCounties, setAvailableCounties] = useState<CountyInfo[]>([]);
  const [selectedSystems, setSelectedSystems] = useState<string[]>([]);
  const [selectedInspectionTypes, setSelectedInspectionTypes] = useState<string[]>([]);
  const [onlyAcceptingReps, setOnlyAcceptingReps] = useState(true);

  // Results state
  const [allPosts, setAllPosts] = useState<MatchedPost[]>([]);
  const [filteredPosts, setFilteredPosts] = useState<MatchedPost[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [searching, setSearching] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Pagination
  const pagination = usePagination({ pageSize: 20 });

  // Rep interest tracking - now includes status for declined detection
  const [repInterest, setRepInterest] = useState<Map<string, string>>(new Map());

  // Detail dialog
  const [viewingPost, setViewingPost] = useState<MatchedPost | null>(null);
  
  // Match settings
  const [matchSettingsOpen, setMatchSettingsOpen] = useState(false);
  const [hasMatchSettings, setHasMatchSettings] = useState(false);

  // Express interest dialog
  const [interestDialogPost, setInterestDialogPost] = useState<MatchedPost | null>(null);

  // Not interested dialog
  const [notInterestedPost, setNotInterestedPost] = useState<MatchedPost | null>(null);

  // Show hidden (not interested) posts toggle
  const [showNotInterested, setShowNotInterested] = useState(false);

  // Check auth and rep role
  useEffect(() => {
    const checkAuth = async () => {
      if (!authLoading && !user) {
        navigate("/signin");
        return;
      }

      if (user) {
        // Load profile
        const { data: profileData } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();

        setProfile(profileData);

        if (!profileData?.is_fieldrep && !profileData?.is_admin) {
          toast.error("Find Work is only available to Field Reps.");
          navigate("/dashboard");
          return;
        }

        // Load rep profile
        const { data: repData } = await supabase
          .from("rep_profile")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle();

        setRepProfile(repData);

        // Load coverage areas with pricing
        const { data: coverageData } = await supabase
          .from("rep_coverage_areas")
          .select("id, state_code, county_id, county_name, covers_entire_state, covers_entire_county, base_price, rush_price")
          .eq("user_id", user.id);

        setCoverageAreas(coverageData || []);

        // Check if match settings exist
        const matchSettings = await getRepMatchSettings(user.id);
        setHasMatchSettings(!!matchSettings);

        // Load rep_interest records to track which posts this rep has already expressed interest in
        if (repData) {
          const { data: interestData } = await supabase
            .from("rep_interest")
            .select("post_id, status")
            .eq("rep_id", repData.id);

          if (interestData) {
            setRepInterest(new Map(interestData.map((i: any) => [i.post_id, i.status])));
          }
        }
      }

      setLoading(false);
    };

    checkAuth();
  }, [authLoading, user, navigate]);

  // Load counties when state filter changes
  useEffect(() => {
    const loadCounties = async () => {
      if (selectedState === "all") {
        setAvailableCounties([]);
        setSelectedCounty("all");
        return;
      }

      const { data } = await supabase
        .from("us_counties")
        .select("county_name, state_code")
        .eq("state_code", selectedState)
        .order("county_name");

      setAvailableCounties(data || []);
      setSelectedCounty("all");
    };

    loadCounties();
  }, [selectedState]);

  // Check if rep profile is incomplete (required for matching)
  const isProfileIncomplete = () => {
    if (!repProfile) return true;
    return !repProfile.city || 
           !repProfile.state || 
           !repProfile.systems_used?.length ||
           !repProfile.inspection_types?.length ||
           coverageAreas.length === 0;
  };

  const handleSearch = async () => {
    if (!user || !repProfile) return;

    setSearching(true);
    setHasSearched(true);

    try {
      // Get state codes from rep's coverage areas
      const repStateCodes = [...new Set(coverageAreas.map(c => c.state_code))];

      if (repStateCodes.length === 0) {
        toast.error("Please add coverage areas to your profile first");
        setAllPosts([]);
        setFilteredPosts([]);
        setSearching(false);
        return;
      }

      // Query seeking_coverage_posts matching rep's coverage areas
      // Only show "open" posts that are accepting responses, not deleted, and not expired
      let query = supabase
        .from("seeking_coverage_posts")
        .select(`
          *,
          us_counties!county_id(county_name, state_code)
        `)
        .eq("status", "active")
        .eq("is_accepting_responses", true)
        .is("deleted_at", null)
        .in("state_code", repStateCodes);

      // Apply expires_at filter (null or >= now)
      query = query.or(`expires_at.is.null,expires_at.gte.${new Date().toISOString()}`);

      const { data: posts, error } = await query;

      if (error) throw error;

      // Load vendor profiles for these posts so we can get anonymous IDs and availability
      const vendorIds = Array.from(
        new Set((posts || []).map((p: any) => p.vendor_id).filter(Boolean)),
      );

      let vendorMap: Record<string, VendorInfo> = {};

      if (vendorIds.length > 0) {
        const { data: vendors, error: vendorError } = await supabase
          .from("vendor_profile")
          .select("user_id, anonymous_id, company_name, is_accepting_new_reps")
          .in("user_id", vendorIds);

        if (vendorError) throw vendorError;

        vendorMap = Object.fromEntries(
          (vendors || []).map((v: any) => [
            v.user_id,
            {
              anonymous_id: v.anonymous_id,
              company_name: v.company_name,
              is_accepting_new_reps: v.is_accepting_new_reps ?? true,
            } as VendorInfo,
          ]),
        );
      }

      // Transform and filter posts based on matching rules
      const matched = (posts || [])
        .map((post: any) => ({
          ...post,
          vendor: vendorMap[post.vendor_id] || {
            anonymous_id: null,
            company_name: "Unknown Vendor",
            is_accepting_new_reps: true,
          },
          county: post.us_counties,
        }))
        .filter((post: MatchedPost) => {
          // 0. Background check requirement check
          if (post.requires_background_check) {
            const hasValidCheck = isBackgroundCheckActive({
              background_check_is_active: repProfile.background_check_is_active,
              background_check_expires_on: repProfile.background_check_expires_on,
            });

            const isWillingToObtain = repProfile.willing_to_obtain_background_check ?? false;
            const allowWilling = post.allow_willing_to_obtain_background_check ?? true;

            // Rep must have valid check OR be willing to obtain (if vendor allows)
            if (!hasValidCheck && !(allowWilling && isWillingToObtain)) {
              return false;
            }

            // AspenGrove-specific requirement (only check if rep has a valid check)
            if (hasValidCheck && post.requires_aspen_grove && repProfile.background_check_provider !== "aspen_grove") {
              return false;
            }
          }

          // 1. Coverage match with pricing check
          const matchingCoverage = coverageAreas.find((coverage) => {
            if (coverage.state_code !== post.state_code) return false;
            
            // If rep covers entire state, match
            if (coverage.covers_entire_state) return true;
            
            // If post has no specific county, match (state-level post)
            if (!post.county_id) return true;
            
            // If rep covers entire county or specific county matches
            if (coverage.county_id === post.county_id) return true;
            
            return false;
          });

          if (!matchingCoverage) return false;

          // 2. Pricing validation
          // Skip posts with incomplete coverage pricing
          if (matchingCoverage.base_price === null || matchingCoverage.base_price === undefined) {
            return false;
          }

          // Matching logic:
          // - For range posts (pay_min and pay_max set): rep must be within range: pay_min <= base_price <= pay_max
          // - For fixed posts (only pay_max set): rep's base_price must be <= pay_max
          const vendorPayMin = post.pay_min ?? 0;
          const vendorPayMax = post.pay_max;
          
          if (vendorPayMax === null || vendorPayMax === undefined) {
            return false; // Exclude posts with no pricing set
          }

          // Rep's base rate must be <= vendor's max rate
          if (matchingCoverage.base_price > vendorPayMax) {
            return false;
          }
          
          // For range posts, rep's base rate must also be >= vendor's min rate
          if (post.pay_type === 'range' && matchingCoverage.base_price < vendorPayMin) {
            return false;
          }

          // 3. Inspection type match (at least one must match)
          // Uses helper function that handles category-to-specific-type matching
          const inspectionMatch = post.inspection_types.some((postType: string) => {
            const postBase = postType.startsWith("Other:") 
              ? postType.substring(6).trim() 
              : postType;
            
            return repProfile.inspection_types?.some((repType: string) => {
              const repBase = repType.startsWith("Other:") 
                ? repType.substring(6).trim() 
                : repType;
              
              return inspectionTypeMatches(postBase, repBase);
            });
          });

          if (!inspectionMatch) return false;

          // 4. Systems match (at least one must match OR post has no system requirements OR rep is open to new systems)
          // Handle "Other: CustomText" format
          const systemsMatch = 
            !post.systems_required_array?.length ||
            repProfile.open_to_new_systems === true ||
            post.systems_required_array.some((postSys: string) => {
              const postSysBase = postSys.startsWith("Other:") 
                ? postSys.substring(6).trim().toLowerCase() 
                : postSys.toLowerCase();
              
              return repProfile.systems_used?.some((repSys: string) => {
                const repSysBase = repSys.startsWith("Other:") 
                  ? repSys.substring(6).trim().toLowerCase() 
                  : repSys.toLowerCase();
                
                return postSysBase.includes(repSysBase) || repSysBase.includes(postSysBase);
              });
            });

          if (!systemsMatch) return false;

          // 5. Vendor availability check (exclude vendors not accepting new reps)
          if (!post.vendor.is_accepting_new_reps) return false;

          return true;
        });

      setAllPosts(matched as MatchedPost[]);
      applyClientSideFilters(matched as MatchedPost[]);
      setLastUpdated(new Date());
      toast.success(`Found ${matched.length} matching opportunities`);
    } catch (error: any) {
      console.error("Search error:", error);
      toast.error("Failed to search for work");
      setAllPosts([]);
      setFilteredPosts([]);
    } finally {
      setSearching(false);
    }
  };

  const applyClientSideFilters = (posts: MatchedPost[]) => {
    let filtered = [...posts];

    // State filter
    if (selectedState !== "all") {
      filtered = filtered.filter(p => p.state_code === selectedState);
    }

    // County filter
    if (selectedCounty !== "all") {
      filtered = filtered.filter(p => p.county?.county_name === selectedCounty);
    }

    // Inspection type filter
    if (selectedInspectionTypes.length > 0) {
      filtered = filtered.filter(p =>
        p.inspection_types.some(type =>
          selectedInspectionTypes.some(selected =>
            type.toLowerCase().includes(selected.toLowerCase())
          )
        )
      );
    }

    // Systems filter
    if (selectedSystems.length > 0) {
      filtered = filtered.filter(p =>
        !p.systems_required_array?.length ||
        p.systems_required_array.some(sys =>
          selectedSystems.some(selected =>
            sys.toLowerCase().includes(selected.toLowerCase())
          )
        )
      );
    }

    setFilteredPosts(filtered);
    pagination.setTotalItems(filtered.length);
    pagination.resetToFirstPage();
  };

  // Reapply filters when filter state changes
  useEffect(() => {
    if (hasSearched) {
      applyClientSideFilters(allPosts);
    }
  }, [selectedState, selectedCounty, selectedInspectionTypes, selectedSystems]);

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

  const handleInterestedClick = (post: MatchedPost) => {
    // If already expressed interest, redirect to messages instead
    if (repInterest.has(post.id)) {
      navigate("/messages");
      return;
    }
    // Open the express interest dialog
    setInterestDialogPost(post);
  };

  const handleInterestExpressed = (postId: string) => {
    setRepInterest((prev) => new Map([...prev, [postId, "interested"]]));
  };

  const handleNotInterestedConfirmed = (postId: string) => {
    setRepInterest((prev) => new Map([...prev, [postId, "not_interested"]]));
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const isExpiringSoon = (expiresAt: string | null) => {
    if (!expiresAt) return false;
    const diff = new Date(expiresAt).getTime() - new Date().getTime();
    const days = diff / (1000 * 60 * 60 * 24);
    return days <= 7 && days > 0;
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!user || (!profile?.is_fieldrep && !profile?.is_admin)) {
    return null;
  }

  return (
    <>
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-1">
              <h1 className="text-3xl font-bold text-foreground">{seekingCoverageCopy.fieldRep.sectionTitle}</h1>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setMatchSettingsOpen(true)}
                  className="gap-2"
                >
                  <Bell className="h-4 w-4" />
                  Match Alerts
                </Button>
              </div>
              <p className="text-muted-foreground mt-1">
                {seekingCoverageCopy.fieldRep.sectionSubtitle}
              </p>
            </div>
            <Button variant="outline" onClick={() => navigate("/dashboard")}>
              Back to Dashboard
            </Button>
          </div>
          
          {/* Match alerts banner */}
          <Alert className="mt-4 border-primary/50 bg-primary/5">
            <Bell className="h-4 w-4" />
            <AlertDescription>
              {hasMatchSettings ? (
                <span>
                  Match alerts are enabled. We'll notify you when new opportunities match your coverage and preferences.{" "}
                  <button
                    onClick={() => setMatchSettingsOpen(true)}
                    className="underline hover:text-primary"
                  >
                    Manage settings
                  </button>
                </span>
              ) : (
                <span>
                  Set up match alerts to get notified when new opportunities match your coverage.{" "}
                  <button
                    onClick={() => setMatchSettingsOpen(true)}
                    className="underline hover:text-primary font-semibold"
                  >
                    Configure alerts
                  </button>
                </span>
              )}
            </AlertDescription>
          </Alert>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Admin View Banner */}
        {profile?.is_admin && <AdminViewBanner />}
        
        {/* Profile Incomplete Blocking Panel */}
        {isProfileIncomplete() ? (
          <Card className="border-destructive bg-destructive/5">
            <CardContent className="py-12 text-center">
              <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-foreground mb-2">
                Profile Incomplete
              </h2>
              <p className="text-muted-foreground max-w-md mx-auto mb-6">
                To see matching work, please complete your profile and coverage areas first. 
                Required: City, State, at least one System Used, at least one Inspection Type, 
                and at least one Coverage Area with a Base Rate set.
              </p>
              <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">
                <strong>Note:</strong> Set your Base Rate for each county in your Coverage settings 
                to see matching posts. Posts that don't meet your pricing requirements won't be shown.
              </p>
              <Button onClick={() => navigate("/rep/profile")}>
                Complete My Profile
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
        {/* Helper Text */}
        <Card className="mb-8 bg-primary/5 border-primary/20">
          <CardContent className="py-4">
            <p className="text-sm text-foreground">
              <strong>How it works:</strong> When you click "I'm Interested", the vendor will see your profile for this county and can shortlist you. 
              Contact and connection workflows will be added in a later phase.
            </p>
          </CardContent>
        </Card>

        {/* Match Assistant Card */}
        <div className="mb-6">
          <MatchAssistantCard />
        </div>

        {/* Search Filters */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Filter Opportunities
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* State Filter */}
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="state-filter">State</Label>
                <Select value={selectedState} onValueChange={setSelectedState}>
                  <SelectTrigger id="state-filter" className="mt-2">
                    <SelectValue placeholder="All my states" />
                  </SelectTrigger>
                  <SelectContent className="bg-background border border-border z-50">
                    <SelectItem value="all">All my states</SelectItem>
                    {[...new Set(coverageAreas.map(c => c.state_code))].map((stateCode) => {
                      const state = US_STATES.find(s => s.value === stateCode);
                      return (
                        <SelectItem key={stateCode} value={stateCode}>
                          {stateCode} - {state?.label || stateCode}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              {/* County Filter */}
              <div>
                <Label htmlFor="county-filter">County</Label>
                <Select 
                  value={selectedCounty} 
                  onValueChange={setSelectedCounty}
                  disabled={selectedState === "all" || availableCounties.length === 0}
                >
                  <SelectTrigger id="county-filter" className="mt-2">
                    <SelectValue placeholder="All counties in state" />
                  </SelectTrigger>
                  <SelectContent className="bg-background border border-border z-50">
                    <SelectItem value="all">All my counties in this state</SelectItem>
                    {availableCounties.map((county) => (
                      <SelectItem key={county.county_name} value={county.county_name}>
                        {county.county_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
            </div>

            {/* Systems Filter */}
            <div>
              <Label>Systems Required</Label>
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
            </div>

            {/* Only Accepting Reps Filter */}
            <div className="flex items-center gap-2">
              <Checkbox
                id="accepting-filter"
                checked={onlyAcceptingReps}
                onCheckedChange={(checked) => setOnlyAcceptingReps(checked as boolean)}
              />
              <Label htmlFor="accepting-filter" className="font-normal cursor-pointer">
                Only show vendors accepting new reps
              </Label>
            </div>

            {/* Search Button */}
            <div className="flex gap-2">
              <Button
                onClick={handleSearch}
                disabled={searching || isProfileIncomplete()}
                className="flex-1 md:flex-none md:w-auto"
              >
                {searching ? "Searching..." : "Search Opportunities"}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setSelectedState("all");
                  setSelectedCounty("all");
                  setSelectedSystems([]);
                  setSelectedInspectionTypes([]);
                  setOnlyAcceptingReps(true);
                }}
              >
                Clear Filters
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Results Section */}
        {hasSearched && (
          <div>
            {/* Data Freshness Notice */}
            <div className="mb-4">
              <DataFreshnessNotice 
                mode="manual" 
                lastUpdated={lastUpdated?.toISOString()} 
                onRefresh={handleSearch}
                isRefreshing={searching}
              />
            </div>

            <h2 className="text-2xl font-semibold text-foreground mb-4">
              {filteredPosts.length} {filteredPosts.length === 1 ? "Opportunity" : "Opportunities"} Found
            </h2>

            {filteredPosts.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  {allPosts.length === 0 ? (
                    // No matches at all without filters
                    <>
                      <p className="text-lg font-medium text-foreground mb-2">
                        {seekingCoverageCopy.fieldRep.emptyState}
                      </p>
                      <p className="text-muted-foreground mb-4">
                        Vendors may not have posted yet, or your filters may be too narrow. 
                        Try expanding your coverage areas, systems, or inspection types.
                      </p>
                      <Button variant="outline" onClick={() => navigate("/rep/profile")}>
                        Review My Profile
                      </Button>
                    </>
                  ) : (
                    // Filters narrowed results to zero
                    <>
                      <p className="text-lg font-medium text-foreground mb-2">
                        No posts match these filters
                      </p>
                      <p className="text-muted-foreground mb-4">
                        Try clearing filters or adjusting your search criteria. 
                        You have {allPosts.length} {allPosts.length === 1 ? "post" : "posts"} matching your base coverage.
                      </p>
                      <Button 
                        variant="outline" 
                        onClick={() => {
                          setSelectedState("all");
                          setSelectedCounty("all");
                          setSelectedSystems([]);
                          setSelectedInspectionTypes([]);
                          applyClientSideFilters(allPosts);
                        }}
                      >
                        Clear All Filters
                      </Button>
                    </>
                  )}
                </CardContent>
              </Card>
            ) : (
              <>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {(() => {
                  // Apply pagination
                  const start = (pagination.currentPage - 1) * pagination.pageSize;
                  const end = start + pagination.pageSize;
                  const paginatedPosts = filteredPosts.slice(start, end);
                  
                  return paginatedPosts.map((post) => (
                  <Card key={post.id} className="hover:border-primary/50 transition-colors">
                    <CardHeader>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium text-foreground">
                            {post.vendor.anonymous_id ?? "Vendor"}
                          </span>
                        </div>
                        <Badge variant="secondary" className="text-xs">
                          {post.status}
                        </Badge>
                      </div>
                      <CardTitle className="text-lg line-clamp-2">{post.title}</CardTitle>
                      <div className="flex items-center gap-2 text-muted-foreground text-sm">
                        <MapPin className="h-4 w-4" />
                        {post.county?.county_name ? `${post.county.county_name}, ` : ""}{post.state_code}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Description Preview */}
                      {post.description && (
                        <p className="text-sm text-muted-foreground line-clamp-3">
                          {post.description}
                        </p>
                      )}

                      {/* Inspection Types */}
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">
                          Inspection Types
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {post.inspection_types.map((type, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs">
                              {type}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      {/* Systems Required */}
                      {post.systems_required_array && post.systems_required_array.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1">
                            Systems Required
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {post.systems_required_array.map((system, idx) => (
                              <Badge key={idx} variant="secondary" className="text-xs">
                                {system}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Background Check Status Badge */}
                      {post.requires_background_check && repProfile && (
                        <div className="mt-2">
                          {isBackgroundCheckActive({
                            background_check_is_active: repProfile.background_check_is_active,
                            background_check_expires_on: repProfile.background_check_expires_on,
                          }) && (
                            <span className="inline-flex items-center rounded-full bg-green-600/10 text-green-600 px-2 py-0.5 text-[11px] font-medium">
                              You have an active background check on file.
                            </span>
                          )}
                          {!isBackgroundCheckActive({
                            background_check_is_active: repProfile.background_check_is_active,
                            background_check_expires_on: repProfile.background_check_expires_on,
                          }) && (repProfile.willing_to_obtain_background_check ?? false) && (
                            <span className="inline-flex items-center rounded-full bg-amber-500/10 text-amber-500 px-2 py-0.5 text-[11px] font-medium">
                              Vendor requires a background check. You've marked yourself willing to obtain one.
                            </span>
                          )}
                          {!isBackgroundCheckActive({
                            background_check_is_active: repProfile.background_check_is_active,
                            background_check_expires_on: repProfile.background_check_expires_on,
                          }) && !(repProfile.willing_to_obtain_background_check ?? false) && (
                            <span className="inline-flex items-center rounded-full bg-muted text-muted-foreground px-2 py-0.5 text-[11px] font-medium">
                              Vendor requires a background check. You do not have one on file yet.
                            </span>
                          )}
                        </div>
                      )}

                      {/* Pricing - Rep view: hide vendor rate, show "matches your rate" */}
                      {(() => {
                        // Find the matching coverage to get base_price
                        const matchingCoverage = coverageAreas.find((coverage) => {
                          if (coverage.state_code !== post.state_code) return false;
                          if (coverage.covers_entire_state) return true;
                          if (!post.county_id) return true;
                          if (coverage.county_id === post.county_id) return true;
                          return false;
                        });

                        return (
                          <div className="p-2 bg-emerald-500/10 rounded border border-emerald-500/30">
                            <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                              ✓ Pay matches your rate for this county
                            </p>
                            {matchingCoverage?.base_price && (
                              <p className="text-xs text-muted-foreground mt-0.5">
                                Your base rate here: ${matchingCoverage.base_price.toFixed(2)} / order
                              </p>
                            )}
                          </div>
                        );
                      })()}

                      {/* Date Info */}
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        <span>Posted {formatDate(post.created_at)}</span>
                      </div>

                      {/* Expiring Soon Warning */}
                      {isExpiringSoon(post.expires_at) && (
                        <div className="flex items-center gap-2 text-xs text-orange-500">
                          <AlertCircle className="h-3 w-3" />
                          <span>Expiring soon</span>
                        </div>
                      )}

                      {post.expires_at === null && (
                        <p className="text-xs text-muted-foreground">Open until filled</p>
                      )}

                      {/* Action Buttons */}
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          onClick={() => setViewingPost(post)}
                        >
                          <ExternalLink className="h-3 w-3 mr-1" />
                          View Details
                        </Button>
                        {repInterest.has(post.id) ? (
                          repInterest.get(post.id) === "declined_by_vendor" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1 text-muted-foreground"
                              disabled
                            >
                              Not selected
                            </Button>
                          ) : repInterest.get(post.id) === "not_interested" ? (
                            <Badge variant="secondary" className="flex-1 justify-center py-2 text-muted-foreground">
                              Not interested
                            </Badge>
                          ) : (
                            <Button
                              size="sm"
                              variant="secondary"
                              className="flex-1"
                              disabled
                            >
                              Interest Sent
                            </Button>
                          )
                        ) : (
                          <>
                            <Button
                              size="sm"
                              className="flex-1"
                              onClick={() => handleInterestedClick(post)}
                            >
                              I'm Interested
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="px-2"
                              onClick={() => setNotInterestedPost(post)}
                              title="Not interested"
                            >
                              <X className="h-4 w-4 text-muted-foreground" />
                            </Button>
                          </>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ));
                })()}
              </div>
              
              {/* Pagination Controls */}
              {filteredPosts.length > pagination.pageSize && (
                <div className="mt-6">
                  <PaginationControls
                    currentPage={pagination.currentPage}
                    totalPages={Math.ceil(filteredPosts.length / pagination.pageSize)}
                    onPageChange={pagination.setPage}
                    showingFrom={(pagination.currentPage - 1) * pagination.pageSize + 1}
                    showingTo={Math.min(pagination.currentPage * pagination.pageSize, filteredPosts.length)}
                    totalItems={filteredPosts.length}
                  />
                </div>
              )}
              </>
            )}
          </div>
        )}
          </>
        )}
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!viewingPost} onOpenChange={() => setViewingPost(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{viewingPost?.title}</DialogTitle>
            <DialogDescription>
              Posted by {viewingPost?.vendor.anonymous_id || "Anonymous Vendor"}
            </DialogDescription>
          </DialogHeader>
          
          {viewingPost && (
            <div className="space-y-4">
              {/* Location */}
              <div>
                <Label className="text-sm font-medium">Location</Label>
                <p className="text-sm text-muted-foreground mt-1">
                  {viewingPost.county?.county_name ? `${viewingPost.county.county_name}, ` : ""}{viewingPost.state_code}
                </p>
              </div>

              {/* Description */}
              {viewingPost.description && (
                <div>
                  <Label className="text-sm font-medium">Description</Label>
                  <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">
                    {viewingPost.description}
                  </p>
                </div>
              )}

              {/* Inspection Types */}
              <div>
                <Label className="text-sm font-medium">Inspection Types</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {viewingPost.inspection_types.map((type, idx) => (
                    <Badge key={idx} variant="outline">
                      {type}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Systems Required */}
              {viewingPost.systems_required_array && viewingPost.systems_required_array.length > 0 && (
                <div>
                  <Label className="text-sm font-medium">Systems Required</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {viewingPost.systems_required_array.map((system, idx) => (
                      <Badge key={idx} variant="secondary">
                        {system}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Posted</Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    {formatDate(viewingPost.created_at)}
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Expires</Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    {viewingPost.expires_at ? formatDate(viewingPost.expires_at) : "Open until filled"}
                  </p>
                </div>
              </div>

              {/* Action Button */}
              {repInterest.has(viewingPost.id) ? (
                <Button className="w-full" variant="secondary" disabled>
                  Interest Sent
                </Button>
              ) : (
                <Button 
                  className="w-full" 
                  onClick={() => handleInterestedClick(viewingPost)}
                >
                  I'm Interested
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Match Settings Dialog */}
      <RepMatchSettingsDialog
        open={matchSettingsOpen}
        onOpenChange={setMatchSettingsOpen}
        userId={user?.id || ""}
      />

      {/* Express Interest Dialog */}
      {interestDialogPost && repProfile && (
        <ExpressInterestDialog
          open={!!interestDialogPost}
          onOpenChange={(open) => {
            if (!open) setInterestDialogPost(null);
          }}
          post={{
            id: interestDialogPost.id,
            title: interestDialogPost.title,
            state_code: interestDialogPost.state_code,
            county: interestDialogPost.county,
            vendor_id: interestDialogPost.vendor_id,
          }}
          repProfile={{
            id: repProfile.id,
            user_id: user?.id || "",
            city: repProfile.city,
            state: repProfile.state,
            zip_code: repProfile.zip_code,
            systems_used: repProfile.systems_used,
            inspection_types: repProfile.inspection_types,
            is_accepting_new_vendors: repProfile.is_accepting_new_vendors,
            willing_to_travel_out_of_state: repProfile.willing_to_travel_out_of_state,
          }}
          coverageAreas={coverageAreas}
          onInterestExpressed={handleInterestExpressed}
        />
      )}

      {/* Not Interested Dialog */}
      {notInterestedPost && repProfile && (
        <NotInterestedDialog
          open={!!notInterestedPost}
          onOpenChange={(open) => {
            if (!open) setNotInterestedPost(null);
          }}
          postId={notInterestedPost.id}
          postTitle={notInterestedPost.title}
          repProfileId={repProfile.id}
          onConfirmed={() => handleNotInterestedConfirmed(notInterestedPost.id)}
        />
      )}
    </>
  );
}
