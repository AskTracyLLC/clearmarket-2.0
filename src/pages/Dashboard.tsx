import { useEffect, useState } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { useActiveRole } from "@/hooks/useActiveRole";
import { supabase } from "@/integrations/supabase/client";
import { signOut } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { OnboardingChecklist } from "@/components/OnboardingChecklist";
import { Search, FileText, User, Building2, PlusCircle, Users, Edit, MessageSquare, Briefcase, Star, Bell, ShieldAlert, Calendar, Coins, ChevronDown, ChevronUp, Headphones, Settings } from "lucide-react";
import { NavIconCluster } from "@/components/NavIconCluster";
import { Badge } from "@/components/ui/badge";
import { NavLink } from "@/components/NavLink";
import { computeRepProfileCompleteness, computeVendorProfileCompleteness, ProfileCompletenessResult, ChecklistItem } from "@/lib/profileCompleteness";
import { ExtrasChecklist } from "@/components/ExtrasChecklist";
import { SoftWarningBanner } from "@/components/SoftWarningBanner";
import { checkSoftWarnings } from "@/lib/qualityAnalytics";
import { useLastSeenHeartbeat } from "@/hooks/useLastSeenHeartbeat";
import { format, parseISO } from "date-fns";
import { BetaBadge } from "@/components/BetaBadge";
import { useSectionCounts } from "@/hooks/useSectionCounts";
import { CountBadge } from "@/components/CountBadge";
import { TodayFeed } from "@/components/dashboard/TodayFeed";
import { AtAGlanceSidebar } from "@/components/dashboard/AtAGlanceSidebar";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { MatchAssistantCard } from "@/components/dashboard/MatchAssistantCard";
import { VendorMatchAssistantCard } from "@/components/dashboard/VendorMatchAssistantCard";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { AuthenticatedNav } from "@/components/AuthenticatedNav";
import { SiteFooter } from "@/components/SiteFooter";
import { MimicBanner } from "@/components/MimicBanner";
import { useMimic } from "@/hooks/useMimic";

const Dashboard = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const mimicUserIdFromUrl = searchParams.get("mimic");
  const { user, loading: authLoading } = useAuth();
  const { effectiveRole, isHybrid, isRep: hasRepRole, isVendor: hasVendorRole, loading: roleLoading } = useActiveRole();
  const { toast } = useToast();
  const { mimickedUser, startMimic, isLoading: mimicLoading } = useMimic();
  
  // Auto-update last_seen_at heartbeat
  useLastSeenHeartbeat();
  const sectionCounts = useSectionCounts();
  const [profile, setProfile] = useState<any>(null);
  const [repProfile, setRepProfile] = useState<any>(null);
  const [vendorProfile, setVendorProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  const [pendingConnectionCount, setPendingConnectionCount] = useState(0);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [vendorCredits, setVendorCredits] = useState<number | null>(null);
  const [reviewPrompts, setReviewPrompts] = useState<Array<{
    userId: string;
    anonymousId: string;
    role: 'rep' | 'vendor';
    connectedAt: string;
  }>>([]);
  const [repCompleteness, setRepCompleteness] = useState<ProfileCompletenessResult | null>(null);
  const [vendorCompleteness, setVendorCompleteness] = useState<ProfileCompletenessResult | null>(null);
  const [softWarning, setSoftWarning] = useState<{
    showWarning: boolean;
    warningMessage: string;
    warningType: "reports" | "reviews" | null;
  }>({ showWarning: false, warningMessage: "", warningType: null });
  const [upcomingTimeOff, setUpcomingTimeOff] = useState<{
    start_date: string;
    end_date: string;
    auto_reply_enabled: boolean;
  } | null>(null);
  const [newOpportunityCount, setNewOpportunityCount] = useState(0);
  const [showSetupSection, setShowSetupSection] = useState(false);
  const [coverageStats, setCoverageStats] = useState<{
    statesCount: number;
    countiesCount: number;
    activeAgreementsCount: number;
  }>({ statesCount: 0, countiesCount: 0, activeAgreementsCount: 0 });
  
  const [isAdminUser, setIsAdminUser] = useState(false);

  // When URL has mimic param and user is admin, start mimic session
  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/signin");
      return;
    }

    if (user && mimicUserIdFromUrl && !mimickedUser) {
      // Check if user is admin and start mimic
      supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single()
        .then(({ data }) => {
          if (data?.is_admin) {
            startMimic(mimicUserIdFromUrl);
          }
        });
    }
  }, [user, authLoading, mimicUserIdFromUrl]);

  useEffect(() => {
    if (!authLoading && user) {
      loadProfile();
    }
  }, [user, authLoading, mimickedUser, mimicLoading]);

  const loadProfile = async () => {
    if (!user) return;

    // First, load the current user's profile to check if they're an admin
    const { data: currentUserData, error: currentUserError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (currentUserError) {
      console.error('Error loading profile:', currentUserError);
      setLoading(false);
      return;
    }
    
    const currentUserIsAdmin = currentUserData?.is_admin === true;
    setIsAdminUser(currentUserIsAdmin);
    
    // If mimic mode is active (from context), use mimicked user's data
    if (mimickedUser) {
      // Use mimicked user's profile data for dashboard display
      setProfile({
        ...currentUserData,
        is_fieldrep: mimickedUser.is_fieldrep,
        is_vendor_admin: mimickedUser.is_vendor_admin,
        full_name: mimickedUser.full_name,
        email: mimickedUser.email,
      });
      
      // Load the full mimicked user profile for dashboard data
      const { data: mimicProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', mimickedUser.id)
        .single();
      
      if (mimicProfile) {
        await loadUserDashboardData(mimicProfile);
      }
    } else {
      // Normal flow - load current user's dashboard
      setProfile(currentUserData);
      
      // Redirect to onboarding if needed (admins bypass role selection)
      const isAdmin = currentUserData.is_admin === true;
      
      if (!currentUserData.has_signed_terms && !isAdmin) {
        navigate("/onboarding/terms");
        return;
      }
      if (!isAdmin && !currentUserData.is_fieldrep && !currentUserData.is_vendor_admin) {
        navigate("/onboarding/role");
        return;
      }
      
      await loadUserDashboardData(currentUserData);
    }
    
    setLoading(false);
  };
  
  const loadUserDashboardData = async (data: any) => {
    const targetUserId = data.id;
    
    // Load role-specific profile
    if (data.is_fieldrep) {
      const { data: repData } = await supabase
        .from("rep_profile")
        .select("*")
        .eq("user_id", targetUserId)
        .maybeSingle();
      
      if (repData) {
        // Get rep coverage areas for count and stats
        const { data: repCoverageAreas } = await supabase
          .from("rep_coverage_areas")
          .select("state_code, county_id")
          .eq("user_id", targetUserId);
        
        const coverageCount = repCoverageAreas?.length || 0;
        const uniqueStates = new Set(repCoverageAreas?.map(ca => ca.state_code) || []);
        
        // Get active working terms agreements count
        const { count: agreementsCount } = await supabase
          .from("working_terms_requests")
          .select("*", { count: "exact", head: true })
          .eq("rep_id", targetUserId)
          .eq("status", "active");
        
        setRepProfile({ ...repData, coverage_count: coverageCount });
        setCoverageStats({
          statesCount: uniqueStates.size,
          countiesCount: coverageCount,
          activeAgreementsCount: agreementsCount || 0,
        });
      } else {
        setRepProfile(repData);
      }
    }

    if (data.is_vendor_admin) {
      const { data: vendorData } = await supabase
        .from("vendor_profile")
        .select("*")
        .eq("user_id", targetUserId)
        .maybeSingle();
      
      setVendorProfile(vendorData);
      
      // Get vendor coverage areas for stats
      const { data: vendorCoverageAreas } = await supabase
        .from("vendor_coverage_areas")
        .select("state_code, county_id")
        .eq("user_id", targetUserId);
      
      const vendorCoverageCount = vendorCoverageAreas?.length || 0;
      const vendorUniqueStates = new Set(vendorCoverageAreas?.map(ca => ca.state_code) || []);
      
      // Get active working terms agreements count for vendor
      const { count: vendorAgreementsCount } = await supabase
        .from("working_terms_requests")
        .select("*", { count: "exact", head: true })
        .eq("vendor_id", targetUserId)
        .eq("status", "active");
      
      setCoverageStats({
        statesCount: vendorUniqueStates.size,
        countiesCount: vendorCoverageCount,
        activeAgreementsCount: vendorAgreementsCount || 0,
      });
    }

    // Load unread message count
    const { count } = await supabase
      .from("messages")
      .select("*", { count: "exact", head: true })
      .eq("recipient_id", targetUserId)
      .eq("read", false);
    
    setUnreadMessageCount(count || 0);

    // Load pending connection count for field reps
    if (data.is_fieldrep) {
      const { count: pendingCount } = await supabase
        .from("vendor_connections")
        .select("*", { count: "exact", head: true })
        .eq("field_rep_id", targetUserId)
        .eq("status", "pending");
      
      setPendingConnectionCount(pendingCount || 0);

      // Count new opportunities (last 7 days) that match rep's coverage
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      // Get rep's coverage areas
      const { data: repCoverage } = await supabase
        .from("rep_coverage_areas")
        .select("state_code, county_id, covers_entire_state")
        .eq("user_id", targetUserId);
        
        // Get all active opportunities from last 7 days
        const { data: opportunities } = await supabase
          .from("seeking_coverage_posts")
          .select("id, state_code, county_id, covers_entire_state")
          .eq("status", "active")
          .is("deleted_at", null)
          .gte("created_at", sevenDaysAgo.toISOString());
        
        // Filter by coverage match
        const matchedCount = (opportunities || []).filter(opp => {
          if (!repCoverage || repCoverage.length === 0) return false;
          
          return repCoverage.some(coverage => {
            // Must match state first
            if (opp.state_code !== coverage.state_code) return false;
            
            // If post covers entire state, any rep in that state matches
            if (opp.covers_entire_state) return true;
            
            // If rep covers entire state, they match any post in that state
            if (coverage.covers_entire_state) return true;
            
            // If post is county-specific, rep must have that county
            if (opp.county_id && coverage.county_id) {
              return opp.county_id === coverage.county_id;
            }
            
            // If no county specified on post but rep has state coverage, match
            if (!opp.county_id) return true;
            
            return false;
          });
        }).length;
        
        setNewOpportunityCount(matchedCount);
      }

    // Load unread notification count
    const { count: notificationCount } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", targetUserId)
      .eq("is_read", false);
    
    setUnreadNotificationCount(notificationCount || 0);

    // Load vendor credits if vendor
    if (data.is_vendor_admin) {
      const { data: walletData } = await supabase
        .from("user_wallet")
        .select("credits")
        .eq("user_id", targetUserId)
        .maybeSingle();
      
      setVendorCredits(walletData?.credits ?? 0);
    }

    // Check for 14-day review prompts
    await checkReviewPrompts(targetUserId, data.is_fieldrep, data.is_vendor_admin);

    // Compute profile completeness
    if (data.is_fieldrep) {
      const repResult = await computeRepProfileCompleteness(supabase, targetUserId);
      setRepCompleteness(repResult);
      // Show setup section if profile incomplete
      setShowSetupSection(repResult.percent < 100);
    }
    if (data.is_vendor_admin) {
      const vendorResult = await computeVendorProfileCompleteness(supabase, targetUserId);
      setVendorCompleteness(vendorResult);
      setShowSetupSection(vendorResult.percent < 100);
    }

    // Check for soft warnings
    const role = data.is_fieldrep ? "rep" : data.is_vendor_admin ? "vendor" : null;
    if (role) {
      const warningData = await checkSoftWarnings(targetUserId, role);
      setSoftWarning(warningData);
    }

    // Check for upcoming time-off for field reps
    if (data.is_fieldrep) {
      const today = new Date().toISOString().split("T")[0];
      const { data: upcomingAvailability } = await supabase
        .from("rep_availability")
        .select("start_date, end_date, auto_reply_enabled")
        .eq("rep_user_id", targetUserId)
        .gte("end_date", today)
        .order("start_date", { ascending: true })
        .limit(1)
        .maybeSingle();
      
      setUpcomingTimeOff(upcomingAvailability);
    }
  };

  const checkReviewPrompts = async (userId: string, isRep: boolean, isVendor: boolean) => {
    try {
      const fourteenDaysAgo = new Date();
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

      let query = supabase
        .from("vendor_connections")
        .select("vendor_id, field_rep_id, requested_at")
        .eq("status", "connected")
        .lte("requested_at", fourteenDaysAgo.toISOString())
        .limit(5);

      if (isRep) {
        query = query.eq("field_rep_id", userId);
      } else if (isVendor) {
        query = query.eq("vendor_id", userId);
      }

      const { data: connections } = await query;

      if (!connections || connections.length === 0) return;

      const prompts: Array<{ userId: string; anonymousId: string; role: 'rep' | 'vendor'; connectedAt: string }> = [];

      for (const conn of connections) {
        const otherUserId = isRep ? conn.vendor_id : conn.field_rep_id;
        const reviewerRole = isRep ? 'rep' : 'vendor';
        const direction = isRep ? 'rep_to_vendor' : 'vendor_to_rep';

        const { data: existingReview } = await supabase
          .from("reviews")
          .select("id")
          .eq("reviewer_id", userId)
          .eq("reviewee_id", otherUserId)
          .eq("direction", direction)
          .maybeSingle();

        if (existingReview) continue;

        const { count: messageCount } = await supabase
          .from("messages")
          .select("*", { count: "exact", head: true })
          .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
          .or(`sender_id.eq.${otherUserId},recipient_id.eq.${otherUserId}`)
          .limit(1);

        if (!messageCount || messageCount === 0) continue;

        const profileTable = isRep ? 'vendor_profile' : 'rep_profile';
        const { data: profile } = await supabase
          .from(profileTable)
          .select("anonymous_id")
          .eq("user_id", otherUserId)
          .maybeSingle();

        if (profile) {
          prompts.push({
            userId: otherUserId,
            anonymousId: profile.anonymous_id || (isRep ? 'Vendor#???' : 'FieldRep#???'),
            role: reviewerRole === 'rep' ? 'vendor' : 'rep',
            connectedAt: conn.requested_at,
          });
        }
      }

      setReviewPrompts(prompts);
    } catch (error) {
      console.error("Error checking review prompts:", error);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    toast({
      title: "Signed out",
      description: "You have been signed out successfully.",
    });
    navigate("/");
  };

  if (authLoading || loading || roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  // Use effectiveRole for hybrid users to determine which dashboard view to show
  // In mimic mode, use the mimicked user's roles
  const isAdmin = profile?.is_admin === true;
  const inMimicMode = !!mimickedUser;
  const mimickedIsRep = mimickedUser?.is_fieldrep === true;
  const mimickedIsVendor = mimickedUser?.is_vendor_admin === true;
  const isAdminOnly = isAdmin && !hasRepRole && !hasVendorRole && !inMimicMode;
  
  // For non-admin users, determine which role view to show based on effectiveRole
  // In mimic mode, prioritize rep view if user is rep, otherwise vendor
  const showingAsRep = inMimicMode ? mimickedIsRep : effectiveRole === "rep";
  const showingAsVendor = inMimicMode ? (!mimickedIsRep && mimickedIsVendor) : effectiveRole === "vendor";

  const profileCompletion = showingAsRep 
    ? (repCompleteness?.percent ?? 0) 
    : (vendorCompleteness?.percent ?? 0);

  const checklistData = showingAsRep && repCompleteness 
    ? { title: "Rep Onboarding", items: repCompleteness.checklist, completedCount: repCompleteness.completedCount, totalCount: repCompleteness.totalCount, extras: repCompleteness.extras }
    : showingAsVendor && vendorCompleteness 
    ? { title: "Vendor Onboarding", items: vendorCompleteness.checklist, completedCount: vendorCompleteness.completedCount, totalCount: vendorCompleteness.totalCount, extras: vendorCompleteness.extras }
    : { title: "Onboarding", items: [], completedCount: 0, totalCount: 0, extras: [] as ChecklistItem[] };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Mimic Mode Banner - from context, no props needed */}
      <MimicBanner />
      
      <AuthenticatedNav 
        isAdmin={profile?.is_admin}
        isVendor={mimickedUser ? mimickedUser.is_vendor_admin : hasVendorRole}
        isRep={mimickedUser ? mimickedUser.is_fieldrep : hasRepRole}
        vendorCredits={vendorCredits}
      />

      <div className="container mx-auto px-4 py-8">
        {/* Admin Dashboard Content */}
        {isAdminOnly && (
          <>
            <div className="mb-6">
              <h1 className="text-3xl font-bold text-foreground mb-1">Admin Dashboard</h1>
              <p className="text-muted-foreground">Welcome back, {profile?.full_name || user?.email}</p>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 max-w-7xl">
              <Card className="hover:border-primary transition-colors cursor-pointer" onClick={() => navigate("/admin/users")}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Users className="w-5 h-5 text-primary" />
                    User Management
                  </CardTitle>
                  <CardDescription className="text-sm">Search users, manage accounts</CardDescription>
                </CardHeader>
              </Card>
              <Card className="hover:border-primary transition-colors cursor-pointer" onClick={() => navigate("/admin/moderation")}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <ShieldAlert className="w-5 h-5 text-primary" />
                    Moderation
                  </CardTitle>
                  <CardDescription className="text-sm">Review flagged content</CardDescription>
                </CardHeader>
              </Card>
              <Card className="hover:border-primary transition-colors cursor-pointer" onClick={() => navigate("/admin/reports")}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <FileText className="w-5 h-5 text-primary" />
                    Reports
                  </CardTitle>
                  <CardDescription className="text-sm">View user reports</CardDescription>
                </CardHeader>
              </Card>
              <Card className="hover:border-primary transition-colors cursor-pointer" onClick={() => navigate("/admin/invites")}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <PlusCircle className="w-5 h-5 text-primary" />
                    Invite Codes
                  </CardTitle>
                  <CardDescription className="text-sm">Manage beta invites</CardDescription>
                </CardHeader>
              </Card>
              <Card className="hover:border-primary transition-colors cursor-pointer" onClick={() => navigate("/admin/support")}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Headphones className="w-5 h-5 text-primary" />
                    Support Queue
                  </CardTitle>
                  <CardDescription className="text-sm">Manage support tickets</CardDescription>
                </CardHeader>
              </Card>
              <Card className="hover:border-primary transition-colors cursor-pointer" onClick={() => navigate("/admin/staff")}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Users className="w-5 h-5 text-primary" />
                    Staff & Roles
                  </CardTitle>
                  <CardDescription className="text-sm">Manage staff access</CardDescription>
                </CardHeader>
              </Card>
              <Card className="hover:border-primary transition-colors cursor-pointer" onClick={() => navigate("/admin/audit")}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <FileText className="w-5 h-5 text-primary" />
                    Activity Log
                  </CardTitle>
                  <CardDescription className="text-sm">Admin audit history</CardDescription>
                </CardHeader>
              </Card>
              <Card className="hover:border-primary transition-colors cursor-pointer" onClick={() => navigate("/admin/metrics")}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Search className="w-5 h-5 text-primary" />
                    System Metrics
                  </CardTitle>
                  <CardDescription className="text-sm">System overview</CardDescription>
                </CardHeader>
              </Card>
              <Card className="hover:border-primary transition-colors cursor-pointer" onClick={() => navigate("/admin/credits")}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Coins className="w-5 h-5 text-primary" />
                    Credit Management
                  </CardTitle>
                  <CardDescription className="text-sm">Adjust user credits</CardDescription>
                </CardHeader>
              </Card>
              <Card className="hover:border-primary transition-colors cursor-pointer" onClick={() => navigate("/admin/inspection-types")}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <FileText className="w-5 h-5 text-primary" />
                    Inspection Types
                  </CardTitle>
                  <CardDescription className="text-sm">Manage type options</CardDescription>
                </CardHeader>
              </Card>
              <Card className="hover:border-primary transition-colors cursor-pointer" onClick={() => navigate("/admin/background-checks")}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <ShieldAlert className="w-5 h-5 text-primary" />
                    Background Checks
                  </CardTitle>
                  <CardDescription className="text-sm">Review submissions</CardDescription>
                </CardHeader>
              </Card>
              <Card className="hover:border-primary transition-colors cursor-pointer" onClick={() => navigate("/admin/legal")}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <FileText className="w-5 h-5 text-primary" />
                    Legal & Help Center
                  </CardTitle>
                  <CardDescription className="text-sm">Manage ToS, Privacy, Help</CardDescription>
                </CardHeader>
              </Card>
              <Card className="hover:border-primary transition-colors cursor-pointer" onClick={() => navigate("/admin/features")}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Settings className="w-5 h-5 text-primary" />
                    Feature Flags
                  </CardTitle>
                  <CardDescription className="text-sm">Manage paid/beta features</CardDescription>
                </CardHeader>
              </Card>
            </div>
          </>
        )}

        {/* Rep/Vendor Dashboard Content */}
        {!isAdminOnly && (
          <>
            {/* Header */}
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-foreground mb-1">
                Welcome back, {profile?.full_name?.split(' ')[0] || 'there'}
              </h1>
              <p className="text-muted-foreground text-sm">
                {showingAsRep ? "Field Rep" : "Vendor"} Dashboard
                {isHybrid && <span className="text-xs ml-1">(Hybrid Account)</span>}
                {showingAsRep && repProfile?.anonymous_id && ` · ${repProfile.anonymous_id}`}
                {showingAsVendor && vendorProfile?.anonymous_id && ` · ${vendorProfile.anonymous_id}`}
              </p>
            </div>

            {/* Soft Warning Banner */}
            {softWarning.showWarning && softWarning.warningType && (
              <div className="mb-6 max-w-5xl">
                <SoftWarningBanner message={softWarning.warningMessage} type={softWarning.warningType} />
              </div>
            )}

            {/* Review Prompts */}
            {reviewPrompts.length > 0 && (
              <div className="mb-6 max-w-5xl">
                <Card className="bg-secondary/10 border-secondary/30">
                  <CardContent className="py-3">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <Star className="w-5 h-5 text-secondary flex-shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            You have {reviewPrompts.length} connection{reviewPrompts.length > 1 ? 's' : ''} to review
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Share your experience to help build trust in the network
                          </p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => navigate(showingAsRep ? "/rep/my-vendors" : "/vendor/my-reps")}
                      >
                        Leave Review
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Quick Actions - Always on top */}
            <div className="max-w-5xl mb-6">
              <QuickActions isRep={showingAsRep} isVendor={showingAsVendor} />
            </div>

            {/* Match Assistant Card - Rep only */}
            {showingAsRep && (
              <div className="max-w-5xl mb-6">
                <MatchAssistantCard />
              </div>
            )}

            {/* Vendor Match Assistant Card - Vendor only */}
            {showingAsVendor && (
              <div className="max-w-5xl mb-6">
                <VendorMatchAssistantCard />
              </div>
            )}

            {/* Main Content Grid */}
            <div className="grid lg:grid-cols-3 gap-6 max-w-5xl">
              {/* Main Column - Today Feed */}
              <div className="lg:col-span-2 space-y-6 order-1 lg:order-1">
                {/* Today Feed */}
                <div>
                  <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                    <Bell className="h-5 w-5 text-primary" />
                    Today
                  </h2>
                  {(inMimicMode && !mimickedUser?.id) ? (
                    <div className="animate-pulse space-y-3">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="bg-card border border-border rounded-lg p-4">
                          <div className="h-4 bg-muted rounded w-1/3 mb-2"></div>
                          <div className="h-3 bg-muted rounded w-2/3"></div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <TodayFeed 
                      userId={inMimicMode ? mimickedUser!.id : (user?.id || '')} 
                      isRep={showingAsRep} 
                      isVendor={showingAsVendor} 
                    />
                  )}
                </div>

                {/* Setup Section - Collapsible, hidden on mobile (shown in At a Glance instead) */}
                {checklistData.items.length > 0 && (
                  <Collapsible open={showSetupSection} onOpenChange={setShowSetupSection} className="hidden lg:block">
                    <Card className="bg-card border-border">
                      <CollapsibleTrigger className="w-full">
                        <CardHeader className="py-3 px-4">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-sm font-medium flex items-center gap-2">
                              {profileCompletion === 100 ? (
                                <span className="text-emerald-500">✓</span>
                              ) : null}
                              Profile Setup
                            </CardTitle>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">
                                {checklistData.completedCount}/{checklistData.totalCount} complete
                              </span>
                              {showSetupSection ? (
                                <ChevronUp className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              )}
                            </div>
                          </div>
                        </CardHeader>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <CardContent className="pt-0 px-4 pb-4 space-y-4">
                          <OnboardingChecklist
                            title=""
                            items={checklistData.items}
                            completedCount={checklistData.completedCount}
                            totalCount={checklistData.totalCount}
                          />
                          {checklistData.extras && checklistData.extras.length > 0 && (
                            <ExtrasChecklist items={checklistData.extras} />
                          )}
                        </CardContent>
                      </CollapsibleContent>
                    </Card>
                  </Collapsible>
                )}
              </div>

              {/* Right Sidebar - At a Glance (stacks below on mobile) */}
              <div className="order-2 lg:order-2">
                <h2 className="text-lg font-semibold text-foreground mb-3">At a Glance</h2>
                <AtAGlanceSidebar
                  isRep={showingAsRep}
                  isVendor={showingAsVendor}
                  vendorCredits={vendorCredits}
                  upcomingTimeOff={upcomingTimeOff}
                  coverageStats={coverageStats}
                />
              </div>
            </div>
          </>
        )}
      </div>

      <div className="mt-auto">
        <SiteFooter />
      </div>
    </div>
  );
};

export default Dashboard;
