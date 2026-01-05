import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ExternalLink, MapPin, Briefcase, CheckCircle, XCircle, ShieldCheck, AlertCircle, MessageSquare, Lock, Unlock, Ban, Info, Clock, Calendar, DollarSign } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { isBackgroundCheckActive, maskBackgroundCheckId } from "@/lib/backgroundCheckUtils";
import { getBackgroundCheckSignedUrl } from "@/lib/storage";
import { fetchTrustScoresForUsers } from "@/lib/reviews";
import { ReviewsDetailDialog } from "@/components/ReviewsDetailDialog";
import { unlockRepContact, checkContactUnlocked } from "@/lib/credits";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { ReportFlagButton } from "@/components/ReportFlagButton";
import { ReportUserDialog } from "@/components/ReportUserDialog";
import { checkAlreadyReported } from "@/lib/reports";
import { useBlockStatus } from "@/hooks/useBlockStatus";
import { useCreditConfirm } from "@/hooks/useCreditConfirm";
import { VendorCalendarDialog, useVendorCalendarSummary } from "@/components/VendorCalendarDialog";
import { format, parseISO } from "date-fns";

interface PublicProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetUserId: string | null;
  viewerContext?: {
    type: "vendor_my_reps";
    rep?: any;
    actions?: {
      onMessage?: (repUserId: string, conversationId?: string) => void;
      onReview?: (rep: any) => void;
      onAgreement?: (rep: any) => void;
      onDisconnect?: (repUserId: string) => void;
    };
  };
}

interface ProfileData {
  role: "rep" | "vendor" | null;
  anonymousId: string;
  displayName: string;
  city?: string;
  state?: string;
  zipCode?: string;
  bio?: string;
  companyName?: string;
  companyDescription?: string;
  website?: string;
  systemsUsed?: string[];
  openToNewSystems?: boolean;
  inspectionTypes?: string[];
  isAcceptingNewVendors?: boolean;
  isAcceptingNewReps?: boolean;
  willingToTravelOutOfState?: boolean;
  lastSeenAt?: string | null;
  unavailableFrom?: string | null;
  unavailableTo?: string | null;
  unavailableNote?: string | null;
  isDualRoleUser?: boolean; // True if user has both Field Rep and Vendor profiles
  otherRole?: "rep" | "vendor"; // The other role if dual-role user
  otherAnonymousId?: string; // Anonymous ID for the other role
  coverageAreas?: Array<{
    stateCode: string;
    stateName: string;
    // For reps (old model)
    countyName?: string | null;
    coversEntireState?: boolean;
    coversEntireCounty?: boolean;
    basePrice?: number | null;
    rushPrice?: number | null;
    // For vendors (new model)
    coverageMode?: "entire_state" | "entire_state_except" | "selected_counties";
    excludedCountyNames?: string[];
    includedCountyNames?: string[];
    // Shared fields
    regionNote?: string | null;
    inspectionTypes?: string[] | null;
  }>;
  backgroundCheck?: {
    isActive: boolean;
    provider: string | null;
    providerOtherName: string | null;
    id: string | null;
    expiresOn: string | null;
    screenshotUrl: string | null;
    willingToObtain?: boolean | null;
  };
  accessEquipment?: {
    hasHudKeys: boolean | null;
    hudKeysDetails: string | null;
    equipmentNotes: string | null;
  };
}

// Internal component for vendor calendar section
function VendorCalendarSection({ 
  vendorId, 
  isOwnerOrAdmin 
}: { 
  vendorId: string; 
  isOwnerOrAdmin: boolean;
}) {
  const calendarSummary = useVendorCalendarSummary(vendorId);
  const [showCalendarDialog, setShowCalendarDialog] = useState(false);
  
  if (calendarSummary.loading) return null;
  if (!calendarSummary.hoursSummary && !calendarSummary.nextPayDay) {
    if (!isOwnerOrAdmin) return null;
    return (
      <Card className="p-4 bg-card-elevated">
        <div className="flex items-start gap-3">
          <Clock className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-foreground mb-1">Office & Pay Schedule</h3>
            <p className="text-sm text-muted-foreground">Not configured yet.</p>
          </div>
        </div>
      </Card>
    );
  }
  
  return (
    <>
      <Card className="p-4 bg-card-elevated">
        <div className="flex items-start gap-3">
          <Clock className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold text-foreground mb-2">Office & Pay Schedule</h3>
            {calendarSummary.hoursSummary && (
              <p className="text-sm text-muted-foreground mb-1">
                <span className="font-medium">Office Hours:</span> {calendarSummary.hoursSummary}
              </p>
            )}
            {calendarSummary.nextPayDay && (
              <p className="text-sm text-muted-foreground mb-2">
                <span className="font-medium">Next Pay Day:</span>{" "}
                {format(parseISO(calendarSummary.nextPayDay.date), "MMM d, yyyy")}
              </p>
            )}
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0 text-primary"
              onClick={() => setShowCalendarDialog(true)}
            >
              View full calendar →
            </Button>
          </div>
        </div>
      </Card>
      <VendorCalendarDialog
        open={showCalendarDialog}
        onOpenChange={setShowCalendarDialog}
        vendorId={vendorId}
      />
    </>
  );
}

// Internal component for vendor coverage needs CTA
function VendorCoverageNeedsCTA({ 
  vendorUserId, 
  activePostsCount 
}: { 
  vendorUserId: string; 
  activePostsCount: number;
}) {
  const navigate = useNavigate();
  
  return (
    <Card className="p-4 bg-card-elevated border-primary/20">
      <div className="flex items-start gap-3">
        <MapPin className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h3 className="font-semibold text-foreground mb-2">Coverage Needs</h3>
          <p className="text-sm text-muted-foreground mb-3">
            This vendor posts specific areas where they're currently looking for Field Reps. 
            You can view their active Seeking Coverage requests for more detail.
          </p>
          <Button
            size="sm"
            onClick={() => navigate(`/rep/find-work?vendorId=${vendorUserId}`)}
          >
            <MapPin className="h-4 w-4 mr-2" />
            View Active Areas Looking for Coverage
            {activePostsCount > 0 && (
              <Badge variant="secondary" className="ml-2 text-xs">
                {activePostsCount}
              </Badge>
            )}
          </Button>
        </div>
      </div>
    </Card>
  );
}

// Internal component for public profile note
function PublicProfileNote({ 
  role, 
  shareProfileEnabled, 
  shareProfileSlug 
}: { 
  role: "rep" | "vendor" | null;
  shareProfileEnabled?: boolean;
  shareProfileSlug?: string | null;
}) {
  if (!role) return null;
  
  const noteText = role === "rep"
    ? "This is a public snapshot. Detailed coverage, systems, and background check info is only visible to the profile owner and ClearMarket staff."
    : "This is a public snapshot. Detailed coverage maps and internal systems are only visible to this vendor and ClearMarket staff.";
  
  return (
    <div className="space-y-3 pt-4 border-t border-border">
      {shareProfileEnabled && shareProfileSlug && (
        <Button
          variant="link"
          size="sm"
          className="px-0 h-auto"
          onClick={() => window.open(`/share/${role}/${shareProfileSlug}`, '_blank')}
        >
          <ExternalLink className="h-3 w-3 mr-1" />
          View full public profile
        </Button>
      )}
      <div className="flex items-start gap-2">
        <Info className="h-3 w-3 text-muted-foreground flex-shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground">
          {noteText}
        </p>
      </div>
    </div>
  );
}

export function PublicProfileDialog({
  open,
  onOpenChange,
  targetUserId,
  viewerContext,
}: PublicProfileDialogProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [backgroundCheckSignedUrl, setBackgroundCheckSignedUrl] = useState<string | null>(null);
  const [trustScore, setTrustScore] = useState<{ average: number; count: number } | null>(null);
  const [communityScore, setCommunityScore] = useState<number>(0);
  const [showReviewsDialog, setShowReviewsDialog] = useState(false);
  const [isContactUnlocked, setIsContactUnlocked] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [viewerIsVendor, setViewerIsVendor] = useState(false);
  const [viewerIsAdmin, setViewerIsAdmin] = useState(false);
  const [repEmail, setRepEmail] = useState<string | null>(null);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [alreadyReported, setAlreadyReported] = useState(false);
  const [activePostsCount, setActivePostsCount] = useState<number>(0);
  const [shareProfileSlug, setShareProfileSlug] = useState<string | null>(null);
  const [shareProfileEnabled, setShareProfileEnabled] = useState(false);
  
  // Credit confirmation hook
  const { confirmCreditSpend, CreditConfirmDialog } = useCreditConfirm();
  
  // Check block status
  const blockStatus = useBlockStatus(targetUserId);

  // Determine if viewer is owner or admin
  const isSelf = user?.id === targetUserId;
  const isOwnerOrAdmin = isSelf || viewerIsAdmin;

  // Generate signed URL for background check screenshot when available
  useEffect(() => {
    async function generateSignedUrl() {
      if (!profileData?.backgroundCheck?.screenshotUrl) {
        setBackgroundCheckSignedUrl(null);
        return;
      }

      const url = await getBackgroundCheckSignedUrl(profileData.backgroundCheck.screenshotUrl, 300);
      setBackgroundCheckSignedUrl(url);
    }

    generateSignedUrl();
  }, [profileData?.backgroundCheck?.screenshotUrl]);

  // Check if viewer is a vendor/admin and if contact is unlocked
  useEffect(() => {
    if (!open || !targetUserId || !user) return;

    async function checkViewerAndUnlock() {
      // Check if current user is a vendor or admin
      const { data: viewerProfile } = await supabase
        .from("profiles")
        .select("is_vendor_admin, is_vendor_staff, is_admin")
        .eq("id", user.id)
        .maybeSingle();

      const isVendor = viewerProfile?.is_vendor_admin || viewerProfile?.is_vendor_staff || false;
      setViewerIsVendor(isVendor);
      setViewerIsAdmin(viewerProfile?.is_admin || false);

      // If vendor viewing a rep, check unlock status
      if (isVendor) {
        const unlocked = await checkContactUnlocked(user.id, targetUserId);
        setIsContactUnlocked(unlocked);
      }

      // Check if user has already reported this person
      const reported = await checkAlreadyReported(user.id, targetUserId);
      setAlreadyReported(reported);
    }

    checkViewerAndUnlock();
  }, [open, targetUserId, user]);

  // Fetch active Seeking Coverage posts count for vendor profiles
  useEffect(() => {
    if (!open || !targetUserId || !profileData || profileData.role !== "vendor") return;

    async function fetchActivePostsCount() {
      const { count } = await supabase
        .from("seeking_coverage_posts")
        .select("*", { count: "exact", head: true })
        .eq("vendor_id", targetUserId)
        .eq("status", "active")
        .is("deleted_at", null);
      
      setActivePostsCount(count || 0);
    }

    fetchActivePostsCount();
  }, [open, targetUserId, profileData?.role]);

  useEffect(() => {
    if (!open || !targetUserId) return;

    async function loadPublicProfile() {
      setLoading(true);
      try {
        // Load base profile (for display name and email)
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, email, is_fieldrep, is_vendor_admin, last_seen_at, share_profile_slug, share_profile_enabled")
          .eq("id", targetUserId)
          .maybeSingle();

        // Determine display name (first name + last initial)
        const fullName = profile?.full_name || "";
        const nameParts = fullName.trim().split(" ");
        const displayName =
          nameParts.length > 1
            ? `${nameParts[0]} ${nameParts[nameParts.length - 1].charAt(0)}.`
            : nameParts[0] || "User";

        // Load rep profile
        const { data: repProfile } = await supabase
          .from("rep_profile")
          .select("*, unavailable_from, unavailable_to, unavailable_note")
          .eq("user_id", targetUserId)
          .maybeSingle();

        // Load vendor profile
        const { data: vendorProfile } = await supabase
          .from("vendor_profile")
          .select("*")
          .eq("user_id", targetUserId)
          .maybeSingle();

        // Detect if this is a dual-role user (has both roles)
        const isDualRoleUser = Boolean(repProfile && vendorProfile);

        // If rep profile exists, use it (priority if user has both roles)
        if (repProfile) {
          // Store rep email for contact unlock feature
          setRepEmail(profile?.email || null);
          // Store share profile info
          setShareProfileSlug(profile?.share_profile_slug || null);
          setShareProfileEnabled(profile?.share_profile_enabled || false);

          // Load coverage areas
          const { data: coverageAreas } = await supabase
            .from("rep_coverage_areas")
            .select(`
              state_code,
              state_name,
              county_name,
              covers_entire_state,
              base_price,
              rush_price
            `)
            .eq("user_id", targetUserId)
            .order("state_code");

          setProfileData({
            role: "rep",
            anonymousId: repProfile.anonymous_id || "FieldRep#?",
            displayName,
            city: repProfile.city,
            state: repProfile.state,
            zipCode: repProfile.zip_code,
            bio: repProfile.bio,
            systemsUsed: repProfile.systems_used || [],
            openToNewSystems: repProfile.open_to_new_systems || false,
            inspectionTypes: repProfile.inspection_types || [],
            isAcceptingNewVendors: repProfile.is_accepting_new_vendors,
            willingToTravelOutOfState: repProfile.willing_to_travel_out_of_state,
            lastSeenAt: profile?.last_seen_at || null,
            unavailableFrom: repProfile.unavailable_from || null,
            unavailableTo: repProfile.unavailable_to || null,
            unavailableNote: repProfile.unavailable_note || null,
            isDualRoleUser,
            otherRole: isDualRoleUser ? "vendor" : undefined,
            otherAnonymousId: isDualRoleUser ? (vendorProfile?.anonymous_id || "Vendor#?") : undefined,
            coverageAreas: (coverageAreas || []).map(area => ({
              stateCode: area.state_code,
              stateName: area.state_name,
              countyName: area.county_name,
              coversEntireState: area.covers_entire_state,
              basePrice: area.base_price,
              rushPrice: area.rush_price,
            })),
            backgroundCheck: {
              isActive: repProfile.background_check_is_active || false,
              provider: repProfile.background_check_provider,
              providerOtherName: repProfile.background_check_provider_other_name,
              id: repProfile.background_check_id,
              expiresOn: repProfile.background_check_expires_on,
              screenshotUrl: repProfile.background_check_screenshot_url,
              willingToObtain: repProfile.willing_to_obtain_background_check || false,
            },
            accessEquipment: {
              hasHudKeys: repProfile.has_hud_keys,
              hudKeysDetails: repProfile.hud_keys_details,
              equipmentNotes: repProfile.equipment_notes,
            },
          });
        }
        // Otherwise use vendor profile
        else if (vendorProfile) {
          // Store share profile info
          setShareProfileSlug(profile?.share_profile_slug || null);
          setShareProfileEnabled(profile?.share_profile_enabled || false);
          // Load vendor coverage areas
          const { data: vendorCoverageAreas } = await supabase
            .from("vendor_coverage_areas")
            .select(`
              id,
              state_code,
              state_name,
              coverage_mode,
              excluded_county_ids,
              included_county_ids,
              region_note,
              inspection_types
            `)
            .eq("user_id", targetUserId)
            .order("state_code");

          // Resolve county names for excluded/included IDs
          const allCountyIds = new Set<string>();
          vendorCoverageAreas?.forEach(area => {
            area.excluded_county_ids?.forEach((id: string) => allCountyIds.add(id));
            area.included_county_ids?.forEach((id: string) => allCountyIds.add(id));
          });

          const countyIdToNameMap: Record<string, string> = {};
          if (allCountyIds.size > 0) {
            const { data: counties } = await supabase
              .from("us_counties")
              .select("id, county_name")
              .in("id", Array.from(allCountyIds));
            
            counties?.forEach(c => {
              countyIdToNameMap[c.id] = c.county_name;
            });
          }

          setProfileData({
            role: "vendor",
            anonymousId: vendorProfile.anonymous_id || "Vendor#?",
            displayName,
            companyName: vendorProfile.company_name,
            companyDescription: vendorProfile.company_description,
            website: vendorProfile.website,
            city: vendorProfile.city,
            state: vendorProfile.state,
            systemsUsed: vendorProfile.systems_used || [],
            inspectionTypes: vendorProfile.primary_inspection_types || [],
            isAcceptingNewReps: vendorProfile.is_accepting_new_reps,
            lastSeenAt: profile?.last_seen_at || null,
            coverageAreas: (vendorCoverageAreas || []).map(area => ({
              stateCode: area.state_code,
              stateName: area.state_name,
              coverageMode: area.coverage_mode as "entire_state" | "entire_state_except" | "selected_counties",
              excludedCountyNames: area.excluded_county_ids?.map((id: string) => countyIdToNameMap[id]).filter(Boolean) || [],
              includedCountyNames: area.included_county_ids?.map((id: string) => countyIdToNameMap[id]).filter(Boolean) || [],
              regionNote: area.region_note,
              inspectionTypes: area.inspection_types,
            })),
          });
        } 
        // No rep or vendor profile found
        else {
          setProfileData(null);
        }
      } catch (error) {
        console.error("Unexpected error loading public profile:", error);
        setProfileData(null);
      } finally {
        setLoading(false);
      }
    }

    loadPublicProfile();
  }, [open, targetUserId]);

  // Fetch trust score and community score separately
  useEffect(() => {
    if (!open || !targetUserId) return;

    async function loadScores() {
      const scores = await fetchTrustScoresForUsers([targetUserId]);
      const score = scores[targetUserId];
      setTrustScore(score || null);

      // Fetch community score
      const { data } = await supabase
        .from("profiles")
        .select("community_score")
        .eq("id", targetUserId)
        .maybeSingle();
      
      setCommunityScore(data?.community_score ?? 0);
    }

    loadScores();
  }, [open, targetUserId]);

  const handleUnlockContact = async () => {
    if (!user || !targetUserId) return;

    // Show credit confirmation dialog
    const confirmed = await confirmCreditSpend({
      cost: 1,
      actionLabel: "unlock this Field Rep's contact details",
    });
    if (!confirmed) return;

    setUnlocking(true);
    try {
      const result = await unlockRepContact(user.id, targetUserId);

      if (result.success) {
        setIsContactUnlocked(true);
        if (result.alreadyUnlocked) {
          toast.success("Contact already unlocked");
        } else {
          toast.success("Contact unlocked! 1 credit deducted.");
          // Trigger wallet refresh if you have a global refresh mechanism
          window.dispatchEvent(new Event("walletUpdated"));
        }
      } else {
        if (result.error === "Insufficient credits") {
          toast.error("Not enough credits", {
            description: "You don't have enough credits to unlock this rep's contact info. Please add credits in your Credits tab.",
          });
        } else {
          toast.error("Failed to unlock contact", {
            description: result.error || "An error occurred",
          });
        }
      }
    } catch (error) {
      console.error("Error unlocking contact:", error);
      toast.error("Failed to unlock contact");
    } finally {
      setUnlocking(false);
    }
  };

  if (loading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Loading profile...</DialogTitle>
          </DialogHeader>
          <div className="py-8 text-center text-muted-foreground">
            Loading...
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!profileData) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Profile Not Available</DialogTitle>
          </DialogHeader>
          <div className="py-8 text-center text-muted-foreground">
            This user hasn't completed their public profile yet.
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-2xl font-bold text-primary">
                {profileData.anonymousId}
              </DialogTitle>
              <p className="text-sm text-muted-foreground">{profileData.displayName}</p>
              {/* Dual Role user badge and helper text */}
              {profileData.isDualRoleUser && (
                <div className="mt-2">
                  <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
                    Dual Role (Vendor + Field Rep)
                  </Badge>
                  <p className="text-xs text-muted-foreground mt-1">
                    This member uses ClearMarket in a dual role, both assigning work as a Vendor and performing inspections as a Field Rep.
                  </p>
                </div>
              )}
            </div>
            {user && targetUserId && user.id !== targetUserId && (
              <div className="mr-8">
                <ReportFlagButton
                  onClick={() => setShowReportDialog(true)}
                  alreadyReported={alreadyReported}
                />
              </div>
            )}
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Trust Score */}
          <Card className="p-4 bg-card-elevated">
            <h3 className="font-semibold text-foreground mb-2">Trust Score</h3>
            {trustScore && trustScore.count > 0 ? (
              <button
                onClick={() => setShowReviewsDialog(true)}
                className="flex items-baseline gap-2 hover:opacity-80 cursor-pointer"
              >
                <span className="text-3xl font-bold text-primary underline decoration-dotted">{trustScore.average.toFixed(1)}</span>
                <span className="text-sm text-muted-foreground">
                  / 5.0 · {trustScore.count} {trustScore.count === 1 ? 'review' : 'reviews'}
                </span>
              </button>
            ) : (
              <button
                onClick={() => setShowReviewsDialog(true)}
                className="flex flex-col gap-2 hover:opacity-80 cursor-pointer text-left"
              >
                <span className="text-3xl font-bold text-muted-foreground">3.0</span>
                <Badge variant="secondary" className="text-sm w-fit">New – not yet rated</Badge>
              </button>
            )}
            {/* Community Score */}
            <div className="mt-3 pt-3 border-t border-border">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Community Score:</span>
                      <Badge variant="outline" className="text-xs">
                        {communityScore >= 0 ? `+${communityScore}` : communityScore}
                      </Badge>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs text-xs">Based on helpful/not helpful votes on this user's Community Board posts and comments.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </Card>
          {/* Last Active */}
          {profileData.lastSeenAt && (
            <Card className="p-4 bg-card-elevated">
              <p className="text-sm text-muted-foreground">
                Last active: {new Date(profileData.lastSeenAt).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' })}
              </p>
            </Card>
          )}
          {!profileData.lastSeenAt && (
            <Card className="p-4 bg-card-elevated">
              <p className="text-sm text-muted-foreground">Last active: Not yet recorded</p>
            </Card>
          )}

          {/* Location */}
          {(profileData.city || profileData.state) && (
            <Card className="p-4 bg-card-elevated">
              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-foreground mb-1">Location</h3>
                  <p className="text-sm text-muted-foreground">
                    {[profileData.city, profileData.state, profileData.zipCode]
                      .filter(Boolean)
                      .join(", ")}
                  </p>
                </div>
              </div>
            </Card>
          )}

          {/* Rep-specific sections */}
          {profileData.role === "rep" && (
            <>
              {/* Bio */}
              {profileData.bio && (
                <Card className="p-4 bg-card-elevated">
                  <h3 className="font-semibold text-foreground mb-2">About</h3>
                  <p className="text-sm text-muted-foreground">{profileData.bio}</p>
                </Card>
              )}

              {/* Systems Used - only visible to owner/admin */}
              {isOwnerOrAdmin && profileData.systemsUsed && profileData.systemsUsed.length > 0 && (
                <Card className="p-4 bg-card-elevated">
                  <h3 className="font-semibold text-foreground mb-3">Systems I Use</h3>
                  <div className="flex flex-wrap gap-2">
                    {profileData.systemsUsed.map((system, idx) => (
                      <Badge key={idx} variant="secondary">
                        {system}
                      </Badge>
                    ))}
                    {profileData.openToNewSystems && (
                      <Badge variant="outline" className="border-primary/50 text-primary">
                        Open to work in new systems
                      </Badge>
                    )}
                  </div>
                </Card>
              )}

              {/* Inspection Types - only visible to owner/admin */}
              {isOwnerOrAdmin && profileData.inspectionTypes && profileData.inspectionTypes.length > 0 && (
                <Card className="p-4 bg-card-elevated">
                  <h3 className="font-semibold text-foreground mb-3">Inspection Types</h3>
                  <div className="flex flex-wrap gap-2">
                    {profileData.inspectionTypes.map((type, idx) => (
                      <Badge key={idx} variant="outline">
                        {type}
                      </Badge>
                    ))}
                  </div>
                </Card>
              )}

              {/* Availability & Preferences */}
              <Card className="p-4 bg-card-elevated">
                <h3 className="font-semibold text-foreground mb-3">
                  Availability & Preferences
                </h3>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    {profileData.isAcceptingNewVendors ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="text-sm text-muted-foreground">
                      {profileData.isAcceptingNewVendors
                        ? "Accepting New Vendors"
                        : "Not Accepting New Vendors"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {profileData.willingToTravelOutOfState ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="text-sm text-muted-foreground">
                      {profileData.willingToTravelOutOfState
                        ? "Willing to Travel Out of State"
                        : "Not Willing to Travel Out of State"}
                    </span>
                  </div>
                </div>

                {/* Time Off Display */}
                {(profileData.unavailableFrom || profileData.unavailableTo) && (
                  <>
                    <Separator className="my-3" />
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-foreground">Time Off</h4>
                      {profileData.unavailableFrom && profileData.unavailableTo && (
                        <div>
                          <p className="text-sm text-muted-foreground">
                            {new Date(profileData.unavailableFrom).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' })}
                            {' – '}
                            {new Date(profileData.unavailableTo).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' })}
                          </p>
                          {(() => {
                            const today = new Date();
                            today.setHours(0, 0, 0, 0);
                            const from = new Date(profileData.unavailableFrom);
                            from.setHours(0, 0, 0, 0);
                            const to = new Date(profileData.unavailableTo);
                            to.setHours(0, 0, 0, 0);
                            
                            if (today >= from && today <= to) {
                              return (
                                <Badge variant="secondary" className="mt-1 bg-amber-500/10 text-amber-500 border-amber-500/20">
                                  ● Currently unavailable
                                </Badge>
                              );
                            }
                            return null;
                          })()}
                        </div>
                      )}
                      {profileData.unavailableFrom && !profileData.unavailableTo && (
                        <div>
                          {(() => {
                            const today = new Date();
                            today.setHours(0, 0, 0, 0);
                            const from = new Date(profileData.unavailableFrom);
                            from.setHours(0, 0, 0, 0);
                            
                            if (from > today) {
                              return (
                                <p className="text-sm text-muted-foreground">
                                  Planned time off starting: {new Date(profileData.unavailableFrom).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' })}
                                </p>
                              );
                            } else {
                              return (
                                <p className="text-sm text-muted-foreground">
                                  Time off: since {new Date(profileData.unavailableFrom).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' })}
                                </p>
                              );
                            }
                          })()}
                        </div>
                      )}
                      {profileData.unavailableNote && (
                        <p className="text-xs text-muted-foreground italic">
                          "{profileData.unavailableNote}"
                        </p>
                      )}
                    </div>
                  </>
                )}
              </Card>

              {/* Coverage Snapshot - only visible to owner/admin */}
              {isOwnerOrAdmin && profileData.coverageAreas && profileData.coverageAreas.length > 0 && (
                <Card className="p-4 bg-card-elevated">
                  <h3 className="font-semibold text-foreground mb-3">Coverage Snapshot</h3>
                  <div className="space-y-2">
                    {profileData.coverageAreas.map((area, idx) => (
                      <div key={idx} className="text-sm">
                        <span className="text-foreground font-medium">
                          {area.stateCode} – {area.stateName}
                        </span>
                        {area.countyName && !area.coversEntireState && (
                          <span className="text-muted-foreground"> / {area.countyName}</span>
                        )}
                        {area.coversEntireState && (
                          <span className="text-muted-foreground"> (Entire State)</span>
                        )}
                        {(area.basePrice || area.rushPrice) && (
                          <span className="text-muted-foreground">
                            {area.basePrice && ` • Base: $${area.basePrice}`}
                            {area.rushPrice && ` • Rush: $${area.rushPrice}`}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* Background Check - only visible to owner/admin */}
              {isOwnerOrAdmin && profileData.backgroundCheck && (
                <Card className="p-4 bg-card-elevated">
                  <div className="flex items-start gap-3">
                    <ShieldCheck className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <h3 className="font-semibold text-foreground mb-3">Background Check</h3>
                          
                      {isBackgroundCheckActive({
                        background_check_is_active: profileData.backgroundCheck.isActive,
                        background_check_expires_on: profileData.backgroundCheck.expiresOn,
                      }) ? (
                        <div className="space-y-3">
                          <Badge className="bg-green-600/10 text-green-600 border-green-600/20 text-[11px]">
                            Background Check: Active
                          </Badge>
                          
                          <div className="text-sm text-muted-foreground">
                            <p>
                              <span className="font-medium">Provider:</span>{" "}
                              {profileData.backgroundCheck.provider === "aspen_grove" 
                                ? "AspenGrove / Shield ID" 
                                : profileData.backgroundCheck.providerOtherName || "Other"}
                            </p>
                            
                            {profileData.backgroundCheck.expiresOn && (
                              <p>
                                <span className="font-medium">Expires:</span>{" "}
                                {new Date(profileData.backgroundCheck.expiresOn).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                          
                          {backgroundCheckSignedUrl && (
                            <Button
                              variant="link"
                              size="sm"
                              className="h-auto p-0 text-primary"
                              onClick={() => window.open(backgroundCheckSignedUrl, '_blank')}
                            >
                              <ExternalLink className="h-3 w-3 mr-1" />
                              View Screenshot
                            </Button>
                          )}
                        </div>
                      ) : profileData.backgroundCheck.willingToObtain ? (
                        <div className="space-y-2">
                          <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20 text-[11px]">
                            Background Check: Willing to Obtain
                          </Badge>
                          <p className="text-sm text-muted-foreground">
                            This rep is willing to obtain one if required.
                          </p>
                        </div>
                      ) : (
                        <Badge variant="outline" className="text-[11px]">
                          Background Check: Not on File
                        </Badge>
                      )}
                    </div>
                  </div>
                </Card>
              )}

              {/* Access & Equipment */}
              {profileData.accessEquipment && 
               (profileData.accessEquipment.hasHudKeys || profileData.accessEquipment.equipmentNotes) && (
                <Card className="p-4 bg-card-elevated">
                  <h3 className="font-semibold text-foreground mb-3">Access & Equipment</h3>
                  <div className="space-y-2 text-sm">
                    {profileData.accessEquipment.hasHudKeys && (
                      <div>
                        <p className="text-foreground font-medium">HUD Keys: Yes</p>
                        {profileData.accessEquipment.hudKeysDetails && (
                          <p className="text-muted-foreground">
                            Details: {profileData.accessEquipment.hudKeysDetails}
                          </p>
                        )}
                      </div>
                    )}
                    {profileData.accessEquipment.equipmentNotes && (
                      <div>
                        <p className="text-foreground font-medium mb-1">Equipment</p>
                        <p className="text-muted-foreground whitespace-pre-wrap">
                          {profileData.accessEquipment.equipmentNotes}
                        </p>
                      </div>
                    )}
                  </div>
                </Card>
              )}

              {/* Contact Info (Vendor View Only) */}
              {viewerIsVendor && (
                <Card className="p-4 bg-card-elevated border-2 border-primary/20">
                  <div className="flex items-start gap-3">
                    {isContactUnlocked ? (
                      <Unlock className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    ) : (
                      <Lock className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <h3 className="font-semibold text-foreground mb-2">Contact Information</h3>
                      
                      {isContactUnlocked ? (
                        <div className="space-y-2">
                          <Badge variant="default" className="mb-2">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Contact unlocked
                          </Badge>
                          {repEmail && (
                            <div className="text-sm">
                              <span className="text-muted-foreground">Email: </span>
                              <a
                                href={`mailto:${repEmail}`}
                                className="text-primary hover:underline font-medium"
                              >
                                {repEmail}
                              </a>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <p className="text-sm text-muted-foreground">
                            Contact info is locked. Unlock this rep's email and phone for 1 credit.
                          </p>
                          <Button
                            onClick={handleUnlockContact}
                            disabled={unlocking}
                            size="sm"
                            className="w-full sm:w-auto"
                          >
                            {unlocking ? (
                              "Unlocking..."
                            ) : (
                              <>
                                <Unlock className="h-4 w-4 mr-2" />
                                Unlock Contact (1 credit)
                              </>
                            )}
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              )}
            </>
          )}

          {/* Vendor-specific sections */}
          {profileData.role === "vendor" && (
            <>
              {/* Company Info */}
              <Card className="p-4 bg-card-elevated">
                <div className="flex items-start gap-3">
                  <Briefcase className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground mb-1">
                      {profileData.companyName}
                    </h3>
                    {profileData.companyDescription && (
                      <p className="text-sm text-muted-foreground mb-2">
                        {profileData.companyDescription}
                      </p>
                    )}
                    {profileData.website && (
                      <a
                        href={profileData.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                      >
                        {profileData.website}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </div>
              </Card>

              {/* Systems We Use - only visible to owner/admin */}
              {isOwnerOrAdmin && profileData.systemsUsed && profileData.systemsUsed.length > 0 && (
                <Card className="p-4 bg-card-elevated">
                  <h3 className="font-semibold text-foreground mb-3">Systems We Use</h3>
                  <div className="flex flex-wrap gap-2">
                    {profileData.systemsUsed.map((system, idx) => (
                      <Badge key={idx} variant="secondary">
                        {system}
                      </Badge>
                    ))}
                  </div>
                </Card>
              )}

              {/* Inspection Types We Assign - only visible to owner/admin */}
              {isOwnerOrAdmin && profileData.inspectionTypes && profileData.inspectionTypes.length > 0 && (
                <Card className="p-4 bg-card-elevated">
                  <h3 className="font-semibold text-foreground mb-3">
                    Inspection Types We Assign
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {profileData.inspectionTypes.map((type, idx) => (
                      <Badge key={idx} variant="outline">
                        {type}
                      </Badge>
                    ))}
                  </div>
                </Card>
              )}

              {/* Availability */}
              <Card className="p-4 bg-card-elevated">
                <h3 className="font-semibold text-foreground mb-3">Availability</h3>
                <div className="flex items-center gap-2">
                  {profileData.isAcceptingNewReps ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className="text-sm text-muted-foreground">
                    {profileData.isAcceptingNewReps
                      ? "Accepting New Reps"
                      : "Not Accepting New Reps"}
                  </span>
                </div>
              </Card>

              {/* Office & Pay Schedule - only for connected reps or admins */}
              {(isOwnerOrAdmin || viewerIsVendor === false) && targetUserId && (
                <VendorCalendarSection vendorId={targetUserId} isOwnerOrAdmin={isOwnerOrAdmin} />
              )}

              {/* Coverage & Focus Areas - only visible to owner/admin */}
              {isOwnerOrAdmin && profileData.coverageAreas && profileData.coverageAreas.length > 0 && (
                <Card className="p-4 bg-card-elevated">
                  <div className="mb-3">
                    <h3 className="font-semibold text-foreground flex items-center gap-2 mb-1">
                      <MapPin className="h-4 w-4" />
                      Coverage & Focus Areas
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      States and regions where this vendor actively places work.
                    </p>
                  </div>
                  <div className="space-y-3">
                    {profileData.coverageAreas.map((coverage, idx) => {
                      const maxCountiesInline = 4;
                      
                      // Helper to render county list with tooltip for long lists
                      const renderCountyList = (counties: string[], prefix: string) => {
                        if (!counties || counties.length === 0) return null;
                        
                        if (counties.length <= maxCountiesInline) {
                          return `${prefix}${counties.join(", ")} Counties`;
                        }
                        
                        const visible = counties.slice(0, maxCountiesInline);
                        const remaining = counties.slice(maxCountiesInline);
                        
                        return (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span>
                                  {prefix}{visible.join(", ")}{" "}
                                  <span className="text-primary cursor-help underline decoration-dotted">
                                    +{remaining.length} more
                                  </span>
                                </span>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs">
                                <p className="text-xs">All counties: {counties.join(", ")}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        );
                      };
                      
                      return (
                        <div key={idx} className="border-l-2 border-primary/30 pl-3">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="text-sm font-semibold text-foreground">
                              {coverage.stateCode} - {coverage.stateName}
                            </h4>
                            {coverage.coverageMode === "entire_state" && (
                              <Badge variant="secondary" className="text-xs">Entire State</Badge>
                            )}
                            {coverage.coverageMode === "entire_state_except" && (
                              <Badge variant="secondary" className="text-xs">Entire State (except...)</Badge>
                            )}
                            {coverage.coverageMode === "selected_counties" && (
                              <Badge variant="secondary" className="text-xs">Selected Counties</Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mb-1">
                            {coverage.coverageMode === "entire_state" && "All counties"}
                            {coverage.coverageMode === "entire_state_except" && 
                              (coverage.excludedCountyNames && coverage.excludedCountyNames.length > 0
                                ? renderCountyList(coverage.excludedCountyNames, "All counties except: ")
                                : "All counties"
                              )
                            }
                            {coverage.coverageMode === "selected_counties" && 
                              (coverage.includedCountyNames && coverage.includedCountyNames.length > 0
                                ? renderCountyList(coverage.includedCountyNames, "Selected counties: ")
                                : "No counties selected"
                              )
                            }
                          </p>
                          {coverage.regionNote && (
                            <p className="text-xs text-muted-foreground italic mb-1">
                              Notes: {coverage.regionNote}
                            </p>
                          )}
                          {coverage.inspectionTypes && coverage.inspectionTypes.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {coverage.inspectionTypes.map((type, typeIdx) => (
                                <Badge key={typeIdx} variant="outline" className="text-[10px] px-1.5 py-0">
                                  {type}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </Card>
              )}

              {/* Coverage Needs CTA - shown to non-owner/non-admin */}
              {!isOwnerOrAdmin && (
                <VendorCoverageNeedsCTA 
                  vendorUserId={targetUserId!} 
                  activePostsCount={activePostsCount} 
                />
              )}
            </>
          )}

          {/* Vendor Actions - shown when viewing from My Reps context */}
          {viewerContext?.type === "vendor_my_reps" && viewerContext.rep && viewerContext.actions && (
            <Card className="p-4 bg-card-elevated border-primary/20">
              <h3 className="font-semibold text-foreground mb-4">Actions</h3>
              
              {/* Block notice */}
              {blockStatus.anyBlock && (
                <div className="mb-4 p-3 rounded-md bg-destructive/10 border border-destructive/20">
                  <div className="flex items-center gap-2 text-sm text-destructive">
                    <Ban className="h-4 w-4" />
                    <span>Some actions are unavailable due to a block between users.</span>
                  </div>
                </div>
              )}
              
              <div className="space-y-3">
                <Button
                  className="w-full"
                  variant="default"
                  onClick={() => viewerContext.actions?.onMessage?.(
                    viewerContext.rep.repUserId,
                    viewerContext.rep.conversationId
                  )}
                >
                  <MessageSquare className="w-4 h-4 mr-2" />
                  View Messages
                </Button>

                <div className="space-y-2">
                  <Button
                    className="w-full"
                    variant="outline"
                    onClick={() => viewerContext.actions?.onAgreement?.(viewerContext.rep)}
                  >
                    {viewerContext.rep.agreementId ? "Edit Agreement" : "Add Agreement Details"}
                  </Button>
                  {viewerContext.rep.agreementId ? (
                    <div className="text-xs text-muted-foreground px-2">
                      <p className="mb-1">
                        <span className="font-medium">Coverage:</span>{" "}
                        {viewerContext.rep.coverageSummary || "Not specified"}
                      </p>
                      <p>
                        <span className="font-medium">Pricing:</span>{" "}
                        {viewerContext.rep.pricingSummary || "Not specified"}
                      </p>
                    </div>
                  ) : (
                    <Badge variant="secondary" className="w-full justify-center">
                      Agreement pending
                    </Badge>
                  )}
                </div>

                {/* Hide Review button when blocked */}
                {!blockStatus.anyBlock && (
                  <Button
                    className="w-full"
                    variant="outline"
                    onClick={() => viewerContext.actions?.onReview?.(viewerContext.rep)}
                  >
                    {viewerContext.rep.review ? "Edit Review" : "Leave Review"}
                  </Button>
                )}

                <Separator />

                <Button
                  className="w-full text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground"
                  variant="outline"
                  onClick={() => viewerContext.actions?.onDisconnect?.(viewerContext.rep.repUserId)}
                >
                  Disconnect
                </Button>
              </div>
            </Card>
          )}

          {/* Public profile note - shown only to non-owners */}
          {!isOwnerOrAdmin && (
            <PublicProfileNote 
              role={profileData.role} 
              shareProfileEnabled={shareProfileEnabled}
              shareProfileSlug={shareProfileSlug}
            />
          )}
        </div>
      </DialogContent>

      <ReviewsDetailDialog
        open={showReviewsDialog}
        onOpenChange={setShowReviewsDialog}
        targetUserId={targetUserId}
      />

      {/* Report User Dialog */}
      {user && targetUserId && (
        <ReportUserDialog
          open={showReportDialog}
          onOpenChange={setShowReportDialog}
          reporterUserId={user.id}
          reportedUserId={targetUserId}
          targetAnonId={profileData?.anonymousId || "this user"}
          alreadyReported={alreadyReported}
        />
      )}
      {CreditConfirmDialog}
    </Dialog>
  );
}
