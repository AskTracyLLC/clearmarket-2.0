import { useState, useEffect, useMemo } from "react";
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
import { Search, MapPin, CheckCircle2, XCircle, Shield, Key, Users, HelpCircle, ChevronDown, ChevronUp } from "lucide-react";
import { US_STATES, SYSTEMS_LIST, INSPECTION_TYPES_LIST } from "@/lib/constants";
import { isBackgroundCheckActive } from "@/lib/backgroundCheckUtils";
import { fetchTrustScoresForUsers } from "@/lib/reviews";
import { ReviewsDetailDialog } from "@/components/ReviewsDetailDialog";
// Contact unlock feature has been removed - access is now based on connection status only
import { PublicProfileDialog } from "@/components/PublicProfileDialog";
import { fetchBlockedUserIds } from "@/lib/blocks";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { fetchInspectionTypesForRole, InspectionTypeOption } from "@/lib/inspectionTypes";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { usePagination } from "@/hooks/usePagination";
import { PaginationControls } from "@/components/PaginationControls";
import { DataFreshnessNotice } from "@/components/DataFreshnessNotice";

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
  allow_willing_to_obtain_background_check?: boolean | null;
}

interface RepCoverageArea {
  id: string;
  user_id: string;
  state_code: string;
  county_id: string | null;
  covers_entire_state: boolean;
  base_price: number | null;
  inspection_types: string[] | null;
}

interface RepResult {
  id: string;
  user_id: string;
  anonymous_id: string | null;
  city: string;
  state: string;
  systems_used: string[];
  open_to_new_systems: boolean;
  inspection_types: string[];
  is_accepting_new_vendors: boolean;
  coverageAreas: RepCoverageArea[];
  background_check_is_active?: boolean | null;
  background_check_expires_on?: string | null;
  background_check_provider?: string | null;
  willing_to_obtain_background_check?: boolean | null;
  has_hud_keys?: boolean | null;
  equipment_notes?: string | null;
  trustScore?: number | null;
  trustScoreCount?: number;
  communityScore?: number;
  connectedSince?: string | null;
  // isContactUnlocked removed - contact access is now based on connection status only
  hasValidBackgroundCheck?: boolean;
  isWillingToObtain?: boolean;
  last_seen_at?: string | null;
  unavailable_from?: string | null;
  unavailable_to?: string | null;
  unavailable_note?: string | null;
  inspectionTypesInArea?: string[];
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
  
  // Detailed inspection type filter
  const [allInspectionTypesByCategory, setAllInspectionTypesByCategory] = useState<Record<string, InspectionTypeOption[]>>({});
  const [selectedDetailedTypes, setSelectedDetailedTypes] = useState<string[]>([]);
  const [inspectionTypesExpanded, setInspectionTypesExpanded] = useState(false);
  
  // "Other" text search inputs
  const [otherSystemText, setOtherSystemText] = useState<string>("");
  const [otherInspectionTypeText, setOtherInspectionTypeText] = useState<string>("");

  // Background check filter mode
  const [bgCheckFilterMode, setBgCheckFilterMode] = useState<"include-willing" | "active-only">("include-willing");

  // Activity filter
  const [activityFilter, setActivityFilter] = useState<"all" | "active-week">("all");

  // Availability filter
  const [availabilityFilter, setAvailabilityFilter] = useState<"all" | "hide-unavailable">("all");

  // Results state
  const [results, setResults] = useState<RepResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [searching, setSearching] = useState(false);
  const [sortBy, setSortBy] = useState<string>("best-match");

  // Reviews dialog
  const [showReviewsDialog, setShowReviewsDialog] = useState(false);
  const [reviewsDialogUserId, setReviewsDialogUserId] = useState<string | null>(null);
  
  // Fetch all inspection types on mount
  useEffect(() => {
    const loadInspectionTypes = async () => {
      const grouped = await fetchInspectionTypesForRole('vendor');
      setAllInspectionTypesByCategory(grouped);
    };
    loadInspectionTypes();
  }, []);

  // Public profile dialog
  const [showProfileDialog, setShowProfileDialog] = useState(false);
  const [profileDialogUserId, setProfileDialogUserId] = useState<string | null>(null);

  // Check auth and vendor role
  useState(() => {
    const checkAuth = async () => {
      if (!authLoading && user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("is_vendor_admin, is_vendor_staff, is_admin")
          .eq("id", user.id)
          .single();

        setProfiles(profile);

        if (!profile?.is_vendor_admin && !profile?.is_vendor_staff && !profile?.is_admin) {
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

  if (!user || (!profiles?.is_vendor_admin && !profiles?.is_vendor_staff && !profiles?.is_admin)) {
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
        .select(`
          id, 
          user_id, 
          anonymous_id, 
          city, 
          state, 
          systems_used,
          open_to_new_systems, 
          inspection_types, 
          is_accepting_new_vendors, 
          background_check_is_active, 
          background_check_provider, 
          background_check_expires_on, 
          willing_to_obtain_background_check, 
          has_hud_keys, 
          equipment_notes,
          unavailable_from,
          unavailable_to,
          unavailable_note,
          profiles!inner(last_seen_at, account_status)
        `)
        .eq("profiles.account_status", "active");

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

      // For each rep, load their coverage areas with pricing, inspection types, and background check info
      const repsWithCoverage = await Promise.all(
        (data || []).map(async (rep) => {
          const { data: coverageData } = await supabase
            .from("rep_coverage_areas")
            .select("id, user_id, state_code, county_id, covers_entire_state, base_price, inspection_types")
            .eq("user_id", rep.user_id);

          return {
            ...rep,
            last_seen_at: (rep as any).profiles?.last_seen_at || null,
            unavailable_from: (rep as any).unavailable_from || null,
            unavailable_to: (rep as any).unavailable_to || null,
            unavailable_note: (rep as any).unavailable_note || null,
            coverageAreas: (coverageData || []) as RepCoverageArea[],
          };
        })
      );

      // Client-side filtering for systems and inspection types
      let filtered = repsWithCoverage;

      if (selectedSystems.length > 0 || otherSystemText.trim()) {
        filtered = filtered.filter((rep) => {
          // Rep is compatible if they're open to new systems
          if (rep.open_to_new_systems) return true;
          
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

      // Legacy broad inspection type filter (kept for backwards compatibility)
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

      // NEW: Detailed inspection type filter with per-region awareness
      // This uses the same logic as TodayFeed opportunities matching
      if (selectedDetailedTypes.length > 0) {
        filtered = filtered.filter((rep) => {
          // Find all coverage areas that match the selected state (if state is selected)
          const matchingCoverageAreas = selectedState !== "all" 
            ? rep.coverageAreas.filter((ca: RepCoverageArea) => ca.state_code === selectedState)
            : rep.coverageAreas;

          if (matchingCoverageAreas.length === 0 && selectedState !== "all") {
            return false; // No coverage in this state
          }

          // Compute rep's active inspection types for the searched area
          const repTypesInArea = new Set<string>();
          
          for (const coverage of matchingCoverageAreas) {
            // If coverage has specific inspection_types, use those
            if (coverage.inspection_types && coverage.inspection_types.length > 0) {
              coverage.inspection_types.forEach((t: string) => repTypesInArea.add(t));
            } else {
              // Fall back to profile-level inspection types
              (rep.inspection_types || []).forEach((t: string) => repTypesInArea.add(t));
            }
          }

          // If no specific coverage but state is "all", use profile-level types
          if (matchingCoverageAreas.length === 0 && selectedState === "all") {
            (rep.inspection_types || []).forEach((t: string) => repTypesInArea.add(t));
          }

          // If rep has no types at all, exclude when vendor has selected types
          if (repTypesInArea.size === 0) {
            return false;
          }

          // Check for intersection using "any-of" logic
          const hasIntersection = selectedDetailedTypes.some((vt) => repTypesInArea.has(vt));
          return hasIntersection;
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
            const hasValidCheck = isBackgroundCheckActive({
              background_check_is_active: rep.background_check_is_active,
              background_check_expires_on: rep.background_check_expires_on,
            });

            const isWillingToObtain = rep.willing_to_obtain_background_check ?? false;
            const allowWilling = post.allow_willing_to_obtain_background_check ?? true;

            // Rep must have valid check OR be willing to obtain (if vendor allows)
            if (!hasValidCheck && !(allowWilling && isWillingToObtain)) {
              return false;
            }

            // AspenGrove-specific requirement (only check if rep has a valid check)
            if (hasValidCheck && post.requires_aspen_grove && rep.background_check_provider !== "aspen_grove") {
              return false;
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

      // Fetch trust scores for all reps
      const repUserIds = filtered.map(r => r.user_id);
      const trustScores = await fetchTrustScoresForUsers(repUserIds);

      // Fetch community scores for all reps
      const { data: communityScoreData } = await supabase
        .from("profiles")
        .select("id, community_score")
        .in("id", repUserIds);
      
      const communityScoreMap = new Map<string, number>();
      communityScoreData?.forEach(p => communityScoreMap.set(p.id, p.community_score ?? 0));

      // Fetch connection status (connected_at) for all reps
      let connectionMap = new Map<string, string | null>();
      if (user && repUserIds.length > 0) {
        const { data: connections } = await supabase
          .from("vendor_connections")
          .select("field_rep_id, requested_at")
          .eq("vendor_id", user.id)
          .eq("status", "connected")
          .in("field_rep_id", repUserIds);
        
        (connections || []).forEach(conn => {
          connectionMap.set(conn.field_rep_id, conn.requested_at);
        });
      }

      // Contact unlock feature has been removed - access is now based on connection status only

      // Fetch blocked user IDs
      const blockedUserIds = await fetchBlockedUserIds();

      // Enhance results with trust scores, community scores, connection data, and filter blocked users
      let enhancedResults = filtered
        .filter(rep => !blockedUserIds.includes(rep.user_id)) // Filter out blocked users
        .map(rep => {
          // Compute inspection types in area for display
          const matchingCoverageAreas = selectedState !== "all" 
            ? rep.coverageAreas.filter((ca: RepCoverageArea) => ca.state_code === selectedState)
            : rep.coverageAreas;
          
          const repTypesInArea = new Set<string>();
          for (const coverage of matchingCoverageAreas) {
            if (coverage.inspection_types && coverage.inspection_types.length > 0) {
              coverage.inspection_types.forEach((t: string) => repTypesInArea.add(t));
            } else {
              (rep.inspection_types || []).forEach((t: string) => repTypesInArea.add(t));
            }
          }
          // Fallback for when state is "all" and no coverage areas
          if (matchingCoverageAreas.length === 0 && selectedState === "all") {
            (rep.inspection_types || []).forEach((t: string) => repTypesInArea.add(t));
          }

          return {
            ...rep,
            trustScore: trustScores[rep.user_id]?.average ?? null,
            trustScoreCount: trustScores[rep.user_id]?.count ?? 0,
            communityScore: communityScoreMap.get(rep.user_id) ?? 0,
            connectedSince: connectionMap.get(rep.user_id) ?? null,
            inspectionTypesInArea: Array.from(repTypesInArea),
          };
        });

      // Apply activity filter (client-side)
      if (activityFilter === "active-week") {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        enhancedResults = enhancedResults.filter(rep => {
          if (!rep.last_seen_at) return false;
          return new Date(rep.last_seen_at) >= sevenDaysAgo;
        });
      }

      // Apply availability filter (client-side)
      if (availabilityFilter === "hide-unavailable") {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        enhancedResults = enhancedResults.filter(rep => {
          if (!rep.unavailable_from) return true; // No time-off set, include
          
          const from = new Date(rep.unavailable_from);
          from.setHours(0, 0, 0, 0);
          
          // If only from is set (no end date)
          if (!rep.unavailable_to) {
            return from > today; // Only exclude if from date has passed (ongoing)
          }
          
          // If both from and to are set
          const to = new Date(rep.unavailable_to);
          to.setHours(0, 0, 0, 0);
          
          // Include rep if today is NOT between from and to (inclusive)
          return !(today >= from && today <= to);
        });
      }

      setResults(enhancedResults as RepResult[]);
      toast.success(`Found ${enhancedResults.length} matching reps`);
    } catch (error: any) {
      console.error("Search error:", error);
      toast.error("Failed to search reps");
    } finally {
      setSearching(false);
    }
  };

  const toggleDetailedType = (typeLabel: string) => {
    setSelectedDetailedTypes((prev) =>
      prev.includes(typeLabel)
        ? prev.filter((t) => t !== typeLabel)
        : [...prev, typeLabel]
    );
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

  const getSortedResults = () => {
    const sorted = [...results];
    
    switch (sortBy) {
      case "best-match":
        // Primary: Trust Score desc (neutral baseline 3.0 for new users)
        // Secondary: has active background check > willing to obtain > none
        // Tertiary: HUD keys present > none
        return sorted.sort((a, b) => {
          const scoreA = a.trustScore ?? 3.0;
          const scoreB = b.trustScore ?? 3.0;
          if (scoreA !== scoreB) return scoreB - scoreA;
          
          const bgScoreA = isBackgroundCheckActive({ background_check_is_active: a.background_check_is_active, background_check_expires_on: a.background_check_expires_on }) ? 2 : (a.willing_to_obtain_background_check ? 1 : 0);
          const bgScoreB = isBackgroundCheckActive({ background_check_is_active: b.background_check_is_active, background_check_expires_on: b.background_check_expires_on }) ? 2 : (b.willing_to_obtain_background_check ? 1 : 0);
          if (bgScoreA !== bgScoreB) return bgScoreB - bgScoreA;
          
          const hudScoreA = a.has_hud_keys ? 1 : 0;
          const hudScoreB = b.has_hud_keys ? 1 : 0;
          return hudScoreB - hudScoreA;
        });
      
      case "trust-score":
        return sorted.sort((a, b) => {
          const scoreA = a.trustScore ?? 3.0;
          const scoreB = b.trustScore ?? 3.0;
          if (scoreA !== scoreB) return scoreB - scoreA;
          return (a.anonymous_id || "").localeCompare(b.anonymous_id || "");
        });
      
      case "community-score":
        return sorted.sort((a, b) => {
          const scoreA = a.communityScore ?? 0;
          const scoreB = b.communityScore ?? 0;
          if (scoreA !== scoreB) return scoreB - scoreA;
          return (a.anonymous_id || "").localeCompare(b.anonymous_id || "");
        });
      
      case "most-reviews":
        return sorted.sort((a, b) => {
          if ((b.trustScoreCount ?? 0) !== (a.trustScoreCount ?? 0)) {
            return (b.trustScoreCount ?? 0) - (a.trustScoreCount ?? 0);
          }
          const scoreA = a.trustScore ?? 3.0;
          const scoreB = b.trustScore ?? 3.0;
          return scoreB - scoreA;
        });
      
      case "newest":
        // Note: We don't have created_at in the current payload, so use anonymous_id as proxy (higher number = newer)
        return sorted.sort((a, b) => {
          const numA = parseInt((a.anonymous_id || "FieldRep#0").replace(/\D/g, "")) || 0;
          const numB = parseInt((b.anonymous_id || "FieldRep#0").replace(/\D/g, "")) || 0;
          return numB - numA;
        });
      
      case "alphabetical":
        return sorted.sort((a, b) => (a.anonymous_id || "").localeCompare(b.anonymous_id || ""));
      
      default:
        return sorted;
    }
  };

  const getActivityStatus = (lastSeenAt: string | null | undefined) => {
    if (!lastSeenAt) return { label: "Last active: Unknown", variant: "outline" as const };
    
    const now = new Date();
    const lastSeen = new Date(lastSeenAt);
    const diffMs = now.getTime() - lastSeen.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffMinutes < 15) {
      return { label: "● Active now", variant: "default" as const };
    } else if (diffDays < 7) {
      return { label: "● Active this week", variant: "secondary" as const };
    } else if (diffDays >= 30) {
      return { label: `Last active: ${lastSeen.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' })}`, variant: "outline" as const };
    } else {
      return { label: `Active recently (${lastSeen.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' })})`, variant: "outline" as const };
    }
  };

  return (
    <>
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground">Find Reps</h1>
          <p className="text-muted-foreground mt-1">
            MVP Preview - Browse field reps (unlock coming soon)
          </p>
        </div>
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

            {/* Detailed Inspection Types Filter (per-region aware) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">Inspection Types (optional)</Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Choose the inspection types you need help with. Leave blank to see all matching reps in this area.
                  </p>
                </div>
                {selectedDetailedTypes.length > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {selectedDetailedTypes.length} selected
                  </Badge>
                )}
              </div>
              
              <Collapsible open={inspectionTypesExpanded} onOpenChange={setInspectionTypesExpanded}>
                <CollapsibleTrigger asChild>
                  <Button variant="outline" size="sm" className="w-full justify-between">
                    <span>{inspectionTypesExpanded ? "Hide inspection types" : "Show inspection types"}</span>
                    {inspectionTypesExpanded ? (
                      <ChevronUp className="h-4 w-4 ml-2" />
                    ) : (
                      <ChevronDown className="h-4 w-4 ml-2" />
                    )}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-3 space-y-4">
                  {Object.entries(allInspectionTypesByCategory).length === 0 ? (
                    <p className="text-sm text-muted-foreground">Loading inspection types...</p>
                  ) : (
                    Object.entries(allInspectionTypesByCategory).map(([category, types]) => (
                      <div key={category} className="space-y-2">
                        <Label className="text-sm font-medium text-muted-foreground">{category}</Label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {types.map((type) => (
                            <div key={type.id} className="flex items-center gap-2">
                              <Checkbox
                                id={`detailed-type-${type.id}`}
                                checked={selectedDetailedTypes.includes(type.label)}
                                onCheckedChange={() => toggleDetailedType(type.label)}
                              />
                              <Label
                                htmlFor={`detailed-type-${type.id}`}
                                className="font-normal cursor-pointer text-sm"
                              >
                                {type.label}
                              </Label>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                  
                  {selectedDetailedTypes.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedDetailedTypes([])}
                      className="text-muted-foreground"
                    >
                      Clear all selections
                    </Button>
                  )}
                </CollapsibleContent>
              </Collapsible>
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

            {/* Background Check Filter - only show if a post is selected and requires background check */}
            {selectedPost && vendorPosts.find(p => p.id === selectedPost)?.requires_background_check && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Background Check Filter</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={bgCheckFilterMode === "include-willing" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setBgCheckFilterMode("include-willing")}
                    className="flex-1"
                  >
                    Include willing-to-obtain
                  </Button>
                  <Button
                    type="button"
                    variant={bgCheckFilterMode === "active-only" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setBgCheckFilterMode("active-only")}
                    className="flex-1"
                  >
                    Active check only
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {bgCheckFilterMode === "include-willing"
                    ? "Showing reps with active background checks and those who are willing to obtain one."
                    : "Showing only reps with a current background check on file."}
                </p>
              </div>
            )}

            {/* Activity Filter */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Activity</Label>
              <Select value={activityFilter} onValueChange={(val) => setActivityFilter(val as "all" | "active-week")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-background border border-border z-50">
                  <SelectItem value="all">All activity</SelectItem>
                  <SelectItem value="active-week">Active this week only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Availability Filter */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Availability</Label>
              <Select value={availabilityFilter} onValueChange={(val) => setAvailabilityFilter(val as "all" | "hide-unavailable")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-background border border-border z-50">
                  <SelectItem value="all">Include reps on time off</SelectItem>
                  <SelectItem value="hide-unavailable">Hide reps currently on time off</SelectItem>
                </SelectContent>
              </Select>
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
        {hasSearched && (() => {
          // Get the selected post
          const post = selectedPost ? vendorPosts.find(p => p.id === selectedPost) : null;
          
          // Compute flags and apply background check filter
          const processedResults = results.map((rep) => {
            // Compute hasValidBackgroundCheck
            const hasValidBackgroundCheck = isBackgroundCheckActive({
              background_check_is_active: rep.background_check_is_active,
              background_check_expires_on: rep.background_check_expires_on,
            });

            // Compute isWillingToObtain (only true if they DON'T have valid check AND are willing)
            const isWillingToObtain = !hasValidBackgroundCheck && (rep.willing_to_obtain_background_check ?? false);

            return {
              ...rep,
              hasValidBackgroundCheck,
              isWillingToObtain,
            };
          });

          // Apply background check filter if post requires it
          const filteredResults = processedResults.filter((rep) => {
            // If no post selected or post doesn't require background check, show all
            if (!post || !post.requires_background_check) {
              return true;
            }

            // If "active-only" mode, only show reps with valid background check
            if (bgCheckFilterMode === "active-only") {
              return rep.hasValidBackgroundCheck;
            }

            // "include-willing" mode: show all (already passed backend matching)
            return true;
          });

          return (
            <div>
              {/* Sort Control */}
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-semibold text-foreground">
                  {filteredResults.length} {filteredResults.length === 1 ? "Rep" : "Reps"} Found
                </h2>
                <div className="flex items-center gap-2">
                  <Label htmlFor="sort-by" className="text-sm text-muted-foreground">
                    Sort by:
                  </Label>
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger id="sort-by" className="w-[200px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-background border border-border z-50">
                      <SelectItem value="best-match">Best match (recommended)</SelectItem>
                      <SelectItem value="trust-score">Highest Trust Score</SelectItem>
                      <SelectItem value="community-score">Community Score (High to Low)</SelectItem>
                      <SelectItem value="most-reviews">Most reviews</SelectItem>
                      <SelectItem value="newest">Newest profiles</SelectItem>
                      <SelectItem value="alphabetical">Alphabetical (Anon ID)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {filteredResults.length === 0 ? (
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
                  {getSortedResults().filter(rep => {
                    // Apply the same filtering logic as above
                    const hasValidBgCheck = isBackgroundCheckActive({
                      background_check_is_active: rep.background_check_is_active,
                      background_check_expires_on: rep.background_check_expires_on,
                    });
                    const isWillingToObtain = !hasValidBgCheck && (rep.willing_to_obtain_background_check ?? false);
                    
                    if (!post || !post.requires_background_check) return true;
                    if (bgCheckFilterMode === "active-only") return hasValidBgCheck;
                    return true;
                  }).map((rep) => {
                    const hasValidBgCheck = isBackgroundCheckActive({
                      background_check_is_active: rep.background_check_is_active,
                      background_check_expires_on: rep.background_check_expires_on,
                    });
                    const isWillingToObtain = !hasValidBgCheck && (rep.willing_to_obtain_background_check ?? false);
                    
                    return (
                  <Card key={rep.id}>
                    <CardHeader>
                      <CardTitle className="text-lg">
                        {rep.anonymous_id || `FieldRep#${rep.id.slice(0, 8)}`}
                      </CardTitle>
                      <div className="flex items-center gap-2 text-muted-foreground text-sm">
                        <MapPin className="h-4 w-4" />
                        {rep.city ? `${rep.city}, ${rep.state}` : rep.state}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Trust Score */}
                      <div className="pb-3 border-b border-border">
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <p className="text-xs font-medium text-muted-foreground">Trust Score</p>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button className="inline-flex" onClick={(e) => e.stopPropagation()}>
                                  <HelpCircle className="h-3 w-3 text-muted-foreground/70 hover:text-muted-foreground transition-colors" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs">
                                <div className="space-y-1">
                                  <p className="font-semibold text-xs">Trust Score (MVP)</p>
                                  <p className="text-xs">Everyone starts in the middle. The score moves up or down based on verified reviews over time. It's intended as a quick signal, not a guarantee.</p>
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                        <button
                          onClick={() => {
                            setReviewsDialogUserId(rep.user_id);
                            setShowReviewsDialog(true);
                          }}
                          className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                        >
                          <div className="flex items-center gap-1.5">
                            <div className={`h-2 w-16 rounded-full ${
                              rep.trustScoreCount === 0 
                                ? 'bg-muted' 
                                : 'bg-gradient-to-r from-amber-500/20 via-primary/30 to-green-500/40'
                            }`}>
                              <div 
                                className={`h-full rounded-full ${
                                  rep.trustScoreCount === 0 
                                    ? 'bg-muted-foreground/30' 
                                    : 'bg-gradient-to-r from-amber-500 via-primary to-green-500'
                                }`}
                                style={{ 
                                  width: `${((rep.trustScore ?? 3.0) / 5) * 100}%` 
                                }}
                              />
                            </div>
                            <span className={`text-sm font-semibold ${
                              rep.trustScoreCount === 0 ? 'text-muted-foreground' : 'text-foreground'
                            }`}>
                              {rep.trustScore?.toFixed(1) ?? '3.0'}
                            </span>
                          </div>
                          {rep.trustScoreCount === 0 ? (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                              New – not yet rated
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground underline">
                              View {rep.trustScoreCount} review{rep.trustScoreCount !== 1 ? 's' : ''}
                            </span>
                          )}
                        </button>
                      </div>

                      {/* Community Score */}
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>Community Score:</span>
                        <Badge variant="outline" className="text-xs">
                          {(rep.communityScore ?? 0) >= 0 ? `+${rep.communityScore ?? 0}` : rep.communityScore}
                        </Badge>
                      </div>

                      {/* Credentials Badges */}
                      <div className="flex flex-wrap gap-2">
                        {/* Connected Badge */}
                        {rep.connectedSince && (
                          <Badge variant="default" className="text-xs gap-1">
                            <Users className="h-3 w-3" />
                            Connected
                          </Badge>
                        )}

                        {/* Background Check Badge */}
                        {(() => {
                          const hasValidCheck = isBackgroundCheckActive({
                            background_check_is_active: rep.background_check_is_active,
                            background_check_expires_on: rep.background_check_expires_on,
                          });
                          const isWilling = !hasValidCheck && (rep.willing_to_obtain_background_check ?? false);

                          if (hasValidCheck) {
                            return (
                              <Badge variant="secondary" className="text-xs gap-1">
                                <Shield className="h-3 w-3" />
                                Active Background Check
                              </Badge>
                            );
                          } else if (isWilling) {
                            return (
                              <Badge variant="outline" className="text-xs gap-1">
                                <Shield className="h-3 w-3" />
                                Willing to obtain
                              </Badge>
                            );
                          }
                          return null;
                        })()}

                        {/* HUD Keys Badge */}
                        {rep.has_hud_keys && (
                          <Badge variant="secondary" className="text-xs gap-1">
                            <Key className="h-3 w-3" />
                            HUD keys
                          </Badge>
                        )}

                        {/* Additional Equipment Hint */}
                        {rep.equipment_notes && (
                          <span className="text-xs text-muted-foreground">
                            + equipment
                          </span>
                        )}
                      </div>

                      {/* Inspection Types in Area (when vendor filtered by types) */}
                      {selectedDetailedTypes.length > 0 && rep.inspectionTypesInArea && rep.inspectionTypesInArea.length > 0 && (
                        <div className="text-xs">
                          <span className="text-muted-foreground">Types in this area: </span>
                          <span className="text-foreground">
                            {rep.inspectionTypesInArea.slice(0, 3).join(", ")}
                            {rep.inspectionTypesInArea.length > 3 && ` +${rep.inspectionTypesInArea.length - 3} more`}
                          </span>
                        </div>
                      )}

                      {/* Activity Badge */}
                      <div className="pb-3 border-b border-border">
                        {(() => {
                          const activity = getActivityStatus(rep.last_seen_at);
                          return (
                            <Badge variant={activity.variant} className="text-xs">
                              {activity.label}
                            </Badge>
                          );
                        })()}
                      </div>

                      {/* Time-Off Badge */}
                      {(rep.unavailable_from || rep.unavailable_to) && (
                        <div className="pb-3 border-b border-border">
                          {(() => {
                            const today = new Date();
                            today.setHours(0, 0, 0, 0);
                            
                            if (rep.unavailable_from && rep.unavailable_to) {
                              const from = new Date(rep.unavailable_from);
                              from.setHours(0, 0, 0, 0);
                              const to = new Date(rep.unavailable_to);
                              to.setHours(0, 0, 0, 0);
                              
                              if (today >= from && today <= to) {
                                return (
                                  <Badge variant="secondary" className="text-xs bg-amber-500/10 text-amber-500 border-amber-500/20">
                                    ● Currently unavailable
                                  </Badge>
                                );
                              }
                            } else if (rep.unavailable_from) {
                              const from = new Date(rep.unavailable_from);
                              from.setHours(0, 0, 0, 0);
                              
                              if (from > today) {
                                return (
                                  <p className="text-xs text-muted-foreground">
                                    Planned time off from {new Date(rep.unavailable_from).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' })}
                                  </p>
                                );
                              } else {
                                return (
                                  <p className="text-xs text-muted-foreground">
                                    Marked unavailable since {new Date(rep.unavailable_from).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' })}
                                  </p>
                                );
                              }
                            }
                            return null;
                          })()}
                          {rep.unavailable_note && (
                            <p className="text-xs text-muted-foreground italic mt-1">
                              "{rep.unavailable_note}"
                            </p>
                          )}
                        </div>
                      )}

                      {/* Connected Since (if applicable) */}
                      {rep.connectedSince && (
                        <div className="text-xs text-muted-foreground">
                          Connected since {new Date(rep.connectedSince).toLocaleDateString('en-US', { 
                            month: 'numeric', 
                            day: 'numeric', 
                            year: 'numeric' 
                          })}
                        </div>
                      )}
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

                      {/* Background Check Status Badge */}
                      {selectedPost && (() => {
                        const post = vendorPosts.find(p => p.id === selectedPost);
                        if (!post?.requires_background_check) return null;
                        
                        return (
                          <div className="mt-2">
                            {rep.hasValidBackgroundCheck && (
                              <span className="inline-flex items-center rounded-full bg-green-600/10 text-green-600 px-2 py-0.5 text-[11px] font-medium">
                                Background Check: Active
                              </span>
                            )}
                            {!rep.hasValidBackgroundCheck && rep.isWillingToObtain && (
                              <span className="inline-flex items-center rounded-full bg-amber-500/10 text-amber-500 px-2 py-0.5 text-[11px] font-medium">
                                Background Check: Willing to Obtain
                              </span>
                            )}
                            {!rep.hasValidBackgroundCheck && !rep.isWillingToObtain && (
                              <span className="inline-flex items-center rounded-full bg-muted text-muted-foreground px-2 py-0.5 text-[11px] font-medium">
                                Background Check: Not on File
                              </span>
                            )}
                          </div>
                        );
                      })()}

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

                      {/* View Profile Button */}
                      <Button
                        onClick={() => {
                          setProfileDialogUserId(rep.user_id);
                          setShowProfileDialog(true);
                        }}
                        variant="outline"
                        className="w-full"
                      >
                        View Profile
                      </Button>
                    </CardContent>
                  </Card>
                    );
                  })}
                </div>
              )}
          </div>
        );
      })()}
      </div>

      {/* Reviews Detail Dialog */}
      <ReviewsDetailDialog
        open={showReviewsDialog}
        onOpenChange={setShowReviewsDialog}
        targetUserId={reviewsDialogUserId}
      />

      {/* Public Profile Dialog */}
      <PublicProfileDialog
        open={showProfileDialog}
        onOpenChange={setShowProfileDialog}
        targetUserId={profileDialogUserId}
      />
    </>
  );
}
