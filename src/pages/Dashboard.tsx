import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { signOut } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { OnboardingChecklist } from "@/components/OnboardingChecklist";
import { Search, FileText, User, Building2, PlusCircle, Users, Edit, MessageSquare, Briefcase, Star, Bell, ShieldAlert, Calendar, Coins, ChevronDown, ChevronUp, Headphones } from "lucide-react";
import { NavIconCluster } from "@/components/NavIconCluster";
import { Badge } from "@/components/ui/badge";
import { NavLink } from "@/components/NavLink";
import { computeRepProfileCompleteness, computeVendorProfileCompleteness, ProfileCompletenessResult } from "@/lib/profileCompleteness";
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { SiteFooter } from "@/components/SiteFooter";

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  
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

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/signin");
      return;
    }

    if (user) {
      loadProfile();
    }
  }, [user, authLoading, navigate]);

  const loadProfile = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error) {
      console.error('Error loading profile:', error);
    } else {
      setProfile(data);
      
      // Redirect to onboarding if needed (admins bypass role selection)
      const isAdmin = data.is_admin === true;
      
      if (!data.has_signed_terms && !isAdmin) {
        navigate("/onboarding/terms");
        return;
      }
      if (!isAdmin && !data.is_fieldrep && !data.is_vendor_admin) {
        navigate("/onboarding/role");
        return;
      }

      // Load role-specific profile
      if (data.is_fieldrep) {
        const { data: repData } = await supabase
          .from("rep_profile")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle();
        
        if (repData) {
          const { count } = await supabase
            .from("rep_coverage_areas")
            .select("*", { count: "exact", head: true })
            .eq("user_id", user.id);
          
          setRepProfile({ ...repData, coverage_count: count || 0 });
        } else {
          setRepProfile(repData);
        }
      }

      if (data.is_vendor_admin) {
        const { data: vendorData } = await supabase
          .from("vendor_profile")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle();
        
        setVendorProfile(vendorData);
      }

      // Load unread message count
      const { count } = await supabase
        .from("messages")
        .select("*", { count: "exact", head: true })
        .eq("recipient_id", user.id)
        .eq("read", false);
      
      setUnreadMessageCount(count || 0);

      // Load pending connection count for field reps
      if (data.is_fieldrep) {
        const { count: pendingCount } = await supabase
          .from("vendor_connections")
          .select("*", { count: "exact", head: true })
          .eq("field_rep_id", user.id)
          .eq("status", "pending");
        
        setPendingConnectionCount(pendingCount || 0);

        // Count new opportunities (last 7 days)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const { count: oppCount } = await supabase
          .from("seeking_coverage_posts")
          .select("*", { count: "exact", head: true })
          .eq("status", "active")
          .is("deleted_at", null)
          .gte("created_at", sevenDaysAgo.toISOString());
        
        setNewOpportunityCount(oppCount || 0);
      }

      // Load unread notification count
      const { count: notificationCount } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("is_read", false);
      
      setUnreadNotificationCount(notificationCount || 0);

      // Load vendor credits if vendor
      if (data.is_vendor_admin) {
        const { data: walletData } = await supabase
          .from("user_wallet")
          .select("credits")
          .eq("user_id", user.id)
          .maybeSingle();
        
        setVendorCredits(walletData?.credits ?? 0);
      }

      // Check for 14-day review prompts
      await checkReviewPrompts(user.id, data.is_fieldrep, data.is_vendor_admin);

      // Compute profile completeness
      if (data.is_fieldrep) {
        const repResult = await computeRepProfileCompleteness(supabase, user.id);
        setRepCompleteness(repResult);
        // Show setup section if profile incomplete
        setShowSetupSection(repResult.percent < 100);
      }
      if (data.is_vendor_admin) {
        const vendorResult = await computeVendorProfileCompleteness(supabase, user.id);
        setVendorCompleteness(vendorResult);
        setShowSetupSection(vendorResult.percent < 100);
      }

      // Check for soft warnings
      const role = data.is_fieldrep ? "rep" : data.is_vendor_admin ? "vendor" : null;
      if (role) {
        const warningData = await checkSoftWarnings(user.id, role);
        setSoftWarning(warningData);
      }

      // Check for upcoming time-off for field reps
      if (data.is_fieldrep) {
        const today = new Date().toISOString().split("T")[0];
        const { data: upcomingAvailability } = await supabase
          .from("rep_availability")
          .select("start_date, end_date, auto_reply_enabled")
          .eq("rep_user_id", user.id)
          .gte("end_date", today)
          .order("start_date", { ascending: true })
          .limit(1)
          .maybeSingle();
        
        setUpcomingTimeOff(upcomingAvailability);
      }
    }

    setLoading(false);
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

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const isRep = profile?.is_fieldrep;
  const isVendor = profile?.is_vendor_admin;
  const isAdmin = profile?.is_admin === true;
  const isAdminOnly = isAdmin && !isRep && !isVendor;

  const profileCompletion = isRep 
    ? (repCompleteness?.percent ?? 0) 
    : (vendorCompleteness?.percent ?? 0);

  const checklistData = isRep && repCompleteness 
    ? { title: "Rep Onboarding", items: repCompleteness.checklist, completedCount: repCompleteness.completedCount, totalCount: repCompleteness.totalCount }
    : isVendor && vendorCompleteness 
    ? { title: "Vendor Onboarding", items: vendorCompleteness.checklist, completedCount: vendorCompleteness.completedCount, totalCount: vendorCompleteness.totalCount }
    : { title: "Onboarding", items: [], completedCount: 0, totalCount: 0 };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header with navigation */}
      <header className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-8">
              <Link to="/" className="text-xl font-bold text-foreground hover:text-primary transition-colors flex items-center gap-2">
                ClearMarket
                <BetaBadge />
              </Link>
              <nav className="hidden md:flex gap-6">
                <NavLink to="/dashboard" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2" activeClassName="text-primary">
                  <Briefcase className="w-4 h-4" />
                  Dashboard
                </NavLink>
                <NavLink to="/community" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2" activeClassName="text-primary">
                  <Users className="w-4 h-4" />
                  Community
                </NavLink>
                <NavLink to="/safety" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2" activeClassName="text-primary">
                  <ShieldAlert className="w-4 h-4" />
                  Safety
                </NavLink>
                {profile?.is_admin && (
                  <NavLink to="/admin/moderation" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2" activeClassName="text-primary">
                    <ShieldAlert className="w-4 h-4" />
                    Admin
                    <CountBadge count={sectionCounts.adminOpenReports + sectionCounts.adminOpenTickets} className="ml-1" />
                  </NavLink>
                )}
              </nav>
            </div>
            <div className="flex items-center gap-3">
              <NavIconCluster 
                vendorCredits={vendorCredits} 
                showCredits={isVendor} 
              />
              <Button variant="outline" size="sm" onClick={handleSignOut}>
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

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
                {isRep ? "Field Rep" : "Vendor"} Dashboard
                {isRep && repProfile?.anonymous_id && ` · ${repProfile.anonymous_id}`}
                {isVendor && vendorProfile?.anonymous_id && ` · ${vendorProfile.anonymous_id}`}
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
                        onClick={() => navigate(isRep ? "/rep/my-vendors" : "/vendor/my-reps")}
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
              <QuickActions isRep={isRep} isVendor={isVendor} />
            </div>

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
                  <TodayFeed 
                    userId={user?.id || ''} 
                    isRep={isRep} 
                    isVendor={isVendor} 
                  />
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
                        <CardContent className="pt-0 px-4 pb-4">
                          <OnboardingChecklist
                            title=""
                            items={checklistData.items}
                            completedCount={checklistData.completedCount}
                            totalCount={checklistData.totalCount}
                          />
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
                  isRep={isRep}
                  isVendor={isVendor}
                  profileCompletion={profileCompletion}
                  unreadMessages={unreadMessageCount}
                  unreadNotifications={unreadNotificationCount}
                  vendorCredits={vendorCredits}
                  upcomingTimeOff={upcomingTimeOff}
                  pendingConnections={pendingConnectionCount}
                  newOpportunities={newOpportunityCount}
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
