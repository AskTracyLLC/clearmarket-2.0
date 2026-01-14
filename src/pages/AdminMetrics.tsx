import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useStaffPermissions } from "@/hooks/useStaffPermissions";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { 
  ArrowLeft, 
  Users, 
  Building2, 
  User, 
  Shield, 
  MessageSquare, 
  Star, 
  Briefcase,
  CheckCircle2,
  Activity,
  TrendingUp,
  FileText,
  BarChart3
} from "lucide-react";
import { format, subDays, startOfWeek, endOfWeek } from "date-fns";

interface UserMetrics {
  total: number;
  fieldReps: number;
  vendorAdmins: number;
  vendorStaff: number;
  platformStaff: number;
}

interface ActivationMetrics {
  activeReps: number;
  activeVendors: number;
  signedTermsPercent: number;
  profileCompletedPercent: number;
  repsWithBgCheck: number;
  vendorsWithPost: number;
}

interface MatchingMetrics {
  totalPosts: number;
  activePosts: number;
  closedPosts: number;
  totalConnections: number;
  connectionsLast30Days: number;
  weeklyConnections: { week: string; count: number }[];
}

interface MessagingMetrics {
  totalMessages: number;
  messagesLast7Days: number;
  avgMessagesPerUser: number;
}

interface ReviewMetrics {
  totalReviews: number;
  reviewsLast30Days: number;
  avgRepTrustScore: number;
  avgVendorTrustScore: number;
}

interface CommunityMetrics {
  totalPosts: number;
  postsLast30Days: number;
  totalComments: number;
  commentsLast30Days: number;
  topAuthors: { anonymousId: string; count: number; score: number }[];
}

interface AdminActivityMetrics {
  actionsLast7Days: number;
  breakdown: { actionType: string; count: number }[];
}

const AdminMetrics = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { loading: permLoading, permissions } = useStaffPermissions();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [userMetrics, setUserMetrics] = useState<UserMetrics | null>(null);
  const [activationMetrics, setActivationMetrics] = useState<ActivationMetrics | null>(null);
  const [matchingMetrics, setMatchingMetrics] = useState<MatchingMetrics | null>(null);
  const [messagingMetrics, setMessagingMetrics] = useState<MessagingMetrics | null>(null);
  const [reviewMetrics, setReviewMetrics] = useState<ReviewMetrics | null>(null);
  const [communityMetrics, setCommunityMetrics] = useState<CommunityMetrics | null>(null);
  const [adminActivity, setAdminActivity] = useState<AdminActivityMetrics | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/signin");
      return;
    }

    if (!permLoading && !permissions.canViewMetrics) {
      toast({
        title: "Access Denied",
        description: "You don't have access to Admin Metrics.",
        variant: "destructive",
      });
      navigate("/dashboard");
      return;
    }

    if (!authLoading && !permLoading && permissions.canViewMetrics) {
      loadAllMetrics();
    }
  }, [user, authLoading, permLoading, permissions]);

  const loadAllMetrics = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadUserMetrics(),
        loadActivationMetrics(),
        loadMatchingMetrics(),
        loadMessagingMetrics(),
        loadReviewMetrics(),
        loadCommunityMetrics(),
        loadAdminActivity(),
      ]);
    } catch (error) {
      console.error("Error loading metrics:", error);
      toast({
        title: "Error",
        description: "Failed to load some metrics. Partial data may be displayed.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadUserMetrics = async () => {
    // Total users
    const { count: total } = await supabase
      .from("profiles")
      .select("*", { count: "exact", head: true });

    // Field reps
    const { count: fieldReps } = await supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("is_fieldrep", true);

    // Vendor Admins (company owners)
    const { count: vendorAdmins } = await supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("is_vendor_admin", true);

    // Vendor Staff (staff members, not owners)
    const { count: vendorStaff } = await supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("is_vendor_staff", true);

    // Platform Staff (admin OR moderator OR support)
    const { count: platformStaff } = await supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .or("is_admin.eq.true,is_moderator.eq.true,is_support.eq.true");

    setUserMetrics({
      total: total || 0,
      fieldReps: fieldReps || 0,
      vendorAdmins: vendorAdmins || 0,
      vendorStaff: vendorStaff || 0,
      platformStaff: platformStaff || 0,
    });
  };

  const loadActivationMetrics = async () => {
    // Active reps (have rep_profile + at least 1 coverage area)
    const { data: repsWithProfile } = await supabase
      .from("rep_profile")
      .select("user_id");
    
    const repUserIds = repsWithProfile?.map(r => r.user_id) || [];
    
    let activeReps = 0;
    if (repUserIds.length > 0) {
      const { data: repsWithCoverage } = await supabase
        .from("rep_coverage_areas")
        .select("user_id")
        .in("user_id", repUserIds);
      
      const uniqueRepsWithCoverage = new Set(repsWithCoverage?.map(r => r.user_id) || []);
      activeReps = uniqueRepsWithCoverage.size;
    }

    // Active vendors (have vendor_profile + at least 1 coverage area)
    const { data: vendorsWithProfile } = await supabase
      .from("vendor_profile")
      .select("user_id");
    
    const vendorUserIds = vendorsWithProfile?.map(v => v.user_id) || [];
    
    let activeVendors = 0;
    if (vendorUserIds.length > 0) {
      const { data: vendorsWithCoverage } = await supabase
        .from("vendor_coverage_areas")
        .select("user_id")
        .in("user_id", vendorUserIds);
      
      const uniqueVendorsWithCoverage = new Set(vendorsWithCoverage?.map(v => v.user_id) || []);
      activeVendors = uniqueVendorsWithCoverage.size;
    }

    // Signed terms percentage
    const { count: totalUsers } = await supabase
      .from("profiles")
      .select("*", { count: "exact", head: true });
    
    const { count: signedTerms } = await supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("has_signed_terms", true);

    const signedTermsPercent = totalUsers ? Math.round((signedTerms || 0) / totalUsers * 100) : 0;

    // Profile completed % (rough estimate - have city/state)
    const { count: repsWithCity } = await supabase
      .from("rep_profile")
      .select("*", { count: "exact", head: true })
      .not("city", "is", null)
      .not("state", "is", null);

    const { count: vendorsWithCity } = await supabase
      .from("vendor_profile")
      .select("*", { count: "exact", head: true })
      .not("city", "is", null)
      .not("state", "is", null);

    const totalProfileUsers = (repUserIds.length || 0) + (vendorUserIds.length || 0);
    const completedProfiles = (repsWithCity || 0) + (vendorsWithCity || 0);
    const profileCompletedPercent = totalProfileUsers ? Math.round(completedProfiles / totalProfileUsers * 100) : 0;

    // Reps with background check or willing to obtain
    const { count: repsWithBgCheck } = await supabase
      .from("rep_profile")
      .select("*", { count: "exact", head: true })
      .or("background_check_is_active.eq.true,willing_to_obtain_background_check.eq.true");

    // Vendors with at least one post
    const { data: vendorsWithPosts } = await supabase
      .from("seeking_coverage_posts")
      .select("vendor_id");
    
    const uniqueVendorsWithPosts = new Set(vendorsWithPosts?.map(p => p.vendor_id) || []);

    setActivationMetrics({
      activeReps,
      activeVendors,
      signedTermsPercent,
      profileCompletedPercent,
      repsWithBgCheck: repsWithBgCheck || 0,
      vendorsWithPost: uniqueVendorsWithPosts.size,
    });
  };

  const loadMatchingMetrics = async () => {
    // Total posts
    const { count: totalPosts } = await supabase
      .from("seeking_coverage_posts")
      .select("*", { count: "exact", head: true })
      .is("deleted_at", null);

    // Active posts
    const { count: activePosts } = await supabase
      .from("seeking_coverage_posts")
      .select("*", { count: "exact", head: true })
      .eq("status", "active")
      .is("deleted_at", null);

    // Closed posts
    const { count: closedPosts } = await supabase
      .from("seeking_coverage_posts")
      .select("*", { count: "exact", head: true })
      .eq("status", "closed")
      .is("deleted_at", null);

    // Total connections
    const { count: totalConnections } = await supabase
      .from("rep_interest")
      .select("*", { count: "exact", head: true })
      .eq("status", "connected");

    // Connections last 30 days
    const thirtyDaysAgo = subDays(new Date(), 30).toISOString();
    const { count: connectionsLast30Days } = await supabase
      .from("rep_interest")
      .select("*", { count: "exact", head: true })
      .eq("status", "connected")
      .gte("connected_at", thirtyDaysAgo);

    // Weekly connections for last 8 weeks
    const weeklyConnections: { week: string; count: number }[] = [];
    for (let i = 7; i >= 0; i--) {
      const weekStart = startOfWeek(subDays(new Date(), i * 7));
      const weekEnd = endOfWeek(subDays(new Date(), i * 7));
      
      const { count } = await supabase
        .from("rep_interest")
        .select("*", { count: "exact", head: true })
        .eq("status", "connected")
        .gte("connected_at", weekStart.toISOString())
        .lte("connected_at", weekEnd.toISOString());
      
      weeklyConnections.push({
        week: format(weekStart, "MMM d"),
        count: count || 0,
      });
    }

    setMatchingMetrics({
      totalPosts: totalPosts || 0,
      activePosts: activePosts || 0,
      closedPosts: closedPosts || 0,
      totalConnections: totalConnections || 0,
      connectionsLast30Days: connectionsLast30Days || 0,
      weeklyConnections,
    });
  };

  const loadMessagingMetrics = async () => {
    // Total messages
    const { count: totalMessages } = await supabase
      .from("messages")
      .select("*", { count: "exact", head: true });

    // Messages last 7 days
    const sevenDaysAgo = subDays(new Date(), 7).toISOString();
    const { count: messagesLast7Days } = await supabase
      .from("messages")
      .select("*", { count: "exact", head: true })
      .gte("created_at", sevenDaysAgo);

    // Average messages per active user (last 30 days)
    const thirtyDaysAgo = subDays(new Date(), 30).toISOString();
    const { data: recentMessages } = await supabase
      .from("messages")
      .select("sender_id")
      .gte("created_at", thirtyDaysAgo);

    const uniqueSenders = new Set(recentMessages?.map(m => m.sender_id) || []);
    const avgMessagesPerUser = uniqueSenders.size > 0 
      ? Math.round((recentMessages?.length || 0) / uniqueSenders.size * 10) / 10
      : 0;

    setMessagingMetrics({
      totalMessages: totalMessages || 0,
      messagesLast7Days: messagesLast7Days || 0,
      avgMessagesPerUser,
    });
  };

  const loadReviewMetrics = async () => {
    // Total reviews
    const { count: totalReviews } = await supabase
      .from("reviews")
      .select("*", { count: "exact", head: true });

    // Reviews last 30 days
    const thirtyDaysAgo = subDays(new Date(), 30).toISOString();
    const { count: reviewsLast30Days } = await supabase
      .from("reviews")
      .select("*", { count: "exact", head: true })
      .gte("created_at", thirtyDaysAgo);

    // Average Trust Score for Field Reps (vendor_to_rep reviews)
    const { data: repReviews } = await supabase
      .from("reviews")
      .select("rating_on_time, rating_quality, rating_communication")
      .eq("direction", "vendor_to_rep")
      .eq("status", "published");

    let avgRepTrustScore = 3.0;
    if (repReviews && repReviews.length > 0) {
      const total = repReviews.reduce((sum, r) => {
        const ratings = [r.rating_on_time, r.rating_quality, r.rating_communication].filter(Boolean);
        return sum + (ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0);
      }, 0);
      avgRepTrustScore = Math.round((total / repReviews.length) * 10) / 10;
    }

    // Average Trust Score for Vendors (rep_to_vendor reviews)
    const { data: vendorReviews } = await supabase
      .from("reviews")
      .select("rating_on_time, rating_quality, rating_communication")
      .eq("direction", "rep_to_vendor")
      .eq("status", "published");

    let avgVendorTrustScore = 3.0;
    if (vendorReviews && vendorReviews.length > 0) {
      const total = vendorReviews.reduce((sum, r) => {
        const ratings = [r.rating_on_time, r.rating_quality, r.rating_communication].filter(Boolean);
        return sum + (ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0);
      }, 0);
      avgVendorTrustScore = Math.round((total / vendorReviews.length) * 10) / 10;
    }

    setReviewMetrics({
      totalReviews: totalReviews || 0,
      reviewsLast30Days: reviewsLast30Days || 0,
      avgRepTrustScore,
      avgVendorTrustScore,
    });
  };

  const loadCommunityMetrics = async () => {
    // Total posts
    const { count: totalPosts } = await supabase
      .from("community_posts")
      .select("*", { count: "exact", head: true });

    // Posts last 30 days
    const thirtyDaysAgo = subDays(new Date(), 30).toISOString();
    const { count: postsLast30Days } = await supabase
      .from("community_posts")
      .select("*", { count: "exact", head: true })
      .gte("created_at", thirtyDaysAgo);

    // Total comments
    const { count: totalComments } = await supabase
      .from("community_comments")
      .select("*", { count: "exact", head: true });

    // Comments last 30 days
    const { count: commentsLast30Days } = await supabase
      .from("community_comments")
      .select("*", { count: "exact", head: true })
      .gte("created_at", thirtyDaysAgo);

    // Top 5 most active authors
    const { data: posts } = await supabase
      .from("community_posts")
      .select("author_id, author_anonymous_id");

    const { data: comments } = await supabase
      .from("community_comments")
      .select("author_id");

    // Count contributions per author
    const authorCounts: Record<string, { count: number; anonymousId: string }> = {};
    
    posts?.forEach(p => {
      if (!authorCounts[p.author_id]) {
        authorCounts[p.author_id] = { count: 0, anonymousId: p.author_anonymous_id || "Unknown" };
      }
      authorCounts[p.author_id].count++;
    });

    comments?.forEach(c => {
      if (!authorCounts[c.author_id]) {
        authorCounts[c.author_id] = { count: 0, anonymousId: "Unknown" };
      }
      authorCounts[c.author_id].count++;
    });

    // Get community scores for top authors
    const topAuthorIds = Object.entries(authorCounts)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 5)
      .map(([id]) => id);

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, community_score")
      .in("id", topAuthorIds);

    const scoreMap = new Map(profiles?.map(p => [p.id, p.community_score]) || []);

    const topAuthors = Object.entries(authorCounts)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 5)
      .map(([id, data]) => ({
        anonymousId: data.anonymousId,
        count: data.count,
        score: scoreMap.get(id) || 0,
      }));

    setCommunityMetrics({
      totalPosts: totalPosts || 0,
      postsLast30Days: postsLast30Days || 0,
      totalComments: totalComments || 0,
      commentsLast30Days: commentsLast30Days || 0,
      topAuthors,
    });
  };

  const loadAdminActivity = async () => {
    const sevenDaysAgo = subDays(new Date(), 7).toISOString();

    // Actions last 7 days
    const { count: actionsLast7Days } = await supabase
      .from("admin_audit_log")
      .select("*", { count: "exact", head: true })
      .gte("created_at", sevenDaysAgo);

    // Breakdown by action type
    const { data: actions } = await supabase
      .from("admin_audit_log")
      .select("action_type")
      .gte("created_at", sevenDaysAgo);

    const typeCounts: Record<string, number> = {};
    actions?.forEach(a => {
      typeCounts[a.action_type] = (typeCounts[a.action_type] || 0) + 1;
    });

    const breakdown = Object.entries(typeCounts)
      .map(([actionType, count]) => ({ actionType, count }))
      .sort((a, b) => b.count - a.count);

    setAdminActivity({
      actionsLast7Days: actionsLast7Days || 0,
      breakdown,
    });
  };

  if (authLoading || permLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/dashboard">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Dashboard
              </Link>
            </Button>
            <h1 className="text-xl font-semibold">System Metrics</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <p className="text-muted-foreground mb-8">
          High-level overview of ClearMarket activity. All data is read-only.
        </p>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <p className="text-muted-foreground">Loading metrics...</p>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Section 1: Users & Roles */}
            <section>
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Users className="w-5 h-5" />
                Users & Roles
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <MetricCard
                  title="Total Users"
                  value={userMetrics?.total || 0}
                  icon={<Users className="w-4 h-4" />}
                />
                <MetricCard
                  title="Field Reps"
                  value={userMetrics?.fieldReps || 0}
                  icon={<User className="w-4 h-4" />}
                />
                <MetricCard
                  title="Vendor Admins"
                  value={userMetrics?.vendorAdmins || 0}
                  icon={<Building2 className="w-4 h-4" />}
                />
                <MetricCard
                  title="Vendor Staff"
                  value={userMetrics?.vendorStaff || 0}
                  icon={<User className="w-4 h-4" />}
                  subtitle="Company staff members"
                />
                <MetricCard
                  title="Platform Staff"
                  value={userMetrics?.platformStaff || 0}
                  icon={<Shield className="w-4 h-4" />}
                />
              </div>
            </section>

            {/* Section 2: Activation & Onboarding */}
            <section>
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5" />
                Activation & Onboarding
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <MetricCard
                  title="Active Reps"
                  value={activationMetrics?.activeReps || 0}
                  subtitle="With coverage areas"
                />
                <MetricCard
                  title="Active Vendors"
                  value={activationMetrics?.activeVendors || 0}
                  subtitle="With coverage areas"
                />
                <MetricCard
                  title="Signed Terms"
                  value={`${activationMetrics?.signedTermsPercent || 0}%`}
                  subtitle="Of all users"
                />
                <MetricCard
                  title="Profile Complete"
                  value={`${activationMetrics?.profileCompletedPercent || 0}%`}
                  subtitle="City & state filled"
                />
                <MetricCard
                  title="BG Check Ready"
                  value={activationMetrics?.repsWithBgCheck || 0}
                  subtitle="Reps with/willing"
                />
                <MetricCard
                  title="Vendors w/ Posts"
                  value={activationMetrics?.vendorsWithPost || 0}
                  subtitle="Created ≥1 post"
                />
              </div>
            </section>

            {/* Section 3: Matches & Network */}
            <section>
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Briefcase className="w-5 h-5" />
                Matches & Network
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <MetricCard
                  title="Total Posts"
                  value={matchingMetrics?.totalPosts || 0}
                  icon={<FileText className="w-4 h-4" />}
                />
                <MetricCard
                  title="Active Posts"
                  value={matchingMetrics?.activePosts || 0}
                  variant="success"
                />
                <MetricCard
                  title="Closed Posts"
                  value={matchingMetrics?.closedPosts || 0}
                  variant="muted"
                />
                <MetricCard
                  title="Total Connections"
                  value={matchingMetrics?.totalConnections || 0}
                  icon={<TrendingUp className="w-4 h-4" />}
                />
                <MetricCard
                  title="Last 30 Days"
                  value={matchingMetrics?.connectionsLast30Days || 0}
                  subtitle="New connections"
                />
              </div>
              
              {/* Simple weekly chart */}
              {matchingMetrics?.weeklyConnections && matchingMetrics.weeklyConnections.length > 0 && (
                <Card className="mt-4">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Connections per Week (Last 8 Weeks)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-end gap-2 h-24">
                      {matchingMetrics.weeklyConnections.map((w, i) => {
                        const max = Math.max(...matchingMetrics.weeklyConnections.map(x => x.count), 1);
                        const height = (w.count / max) * 100;
                        return (
                          <div key={i} className="flex-1 flex flex-col items-center gap-1">
                            <div 
                              className="w-full bg-primary/80 rounded-t"
                              style={{ height: `${Math.max(height, 4)}%` }}
                            />
                            <span className="text-xs text-muted-foreground">{w.week}</span>
                            <span className="text-xs font-medium">{w.count}</span>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}
            </section>

            {/* Section 4: Messaging & Reviews */}
            <section>
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <MessageSquare className="w-5 h-5" />
                Messaging & Reviews
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <MetricCard
                  title="Total Messages"
                  value={messagingMetrics?.totalMessages || 0}
                  icon={<MessageSquare className="w-4 h-4" />}
                />
                <MetricCard
                  title="Last 7 Days"
                  value={messagingMetrics?.messagesLast7Days || 0}
                  subtitle="Messages sent"
                />
                <MetricCard
                  title="Avg/User"
                  value={messagingMetrics?.avgMessagesPerUser || 0}
                  subtitle="Last 30 days"
                />
                <MetricCard
                  title="Total Reviews"
                  value={reviewMetrics?.totalReviews || 0}
                  icon={<Star className="w-4 h-4" />}
                />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
                <MetricCard
                  title="Reviews (30d)"
                  value={reviewMetrics?.reviewsLast30Days || 0}
                  subtitle="Submitted"
                />
                <MetricCard
                  title="Avg Rep Score"
                  value={reviewMetrics?.avgRepTrustScore?.toFixed(1) || "3.0"}
                  subtitle="Trust Score"
                  icon={<Star className="w-4 h-4 text-yellow-500" />}
                />
                <MetricCard
                  title="Avg Vendor Score"
                  value={reviewMetrics?.avgVendorTrustScore?.toFixed(1) || "3.0"}
                  subtitle="Trust Score"
                  icon={<Star className="w-4 h-4 text-yellow-500" />}
                />
              </div>
            </section>

            {/* Section 5: Community & Admin Activity */}
            <section>
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Activity className="w-5 h-5" />
                Community & Admin Activity
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Community */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Community Engagement</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <p className="text-2xl font-bold">{communityMetrics?.totalPosts || 0}</p>
                        <p className="text-sm text-muted-foreground">Total Posts</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{communityMetrics?.postsLast30Days || 0}</p>
                        <p className="text-sm text-muted-foreground">Posts (30d)</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{communityMetrics?.totalComments || 0}</p>
                        <p className="text-sm text-muted-foreground">Total Comments</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{communityMetrics?.commentsLast30Days || 0}</p>
                        <p className="text-sm text-muted-foreground">Comments (30d)</p>
                      </div>
                    </div>
                    
                    {communityMetrics?.topAuthors && communityMetrics.topAuthors.length > 0 && (
                      <div>
                        <p className="text-sm font-medium mb-2">Top Contributors</p>
                        <div className="space-y-2">
                          {communityMetrics.topAuthors.map((author, i) => (
                            <div key={i} className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">{author.anonymousId}</span>
                              <div className="flex items-center gap-2">
                                <span>{author.count} posts/comments</span>
                                <Badge variant="secondary" className="text-xs">
                                  Score: {author.score}
                                </Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Admin Activity */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <BarChart3 className="w-4 h-4" />
                      Admin Actions (Last 7 Days)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold mb-4">{adminActivity?.actionsLast7Days || 0}</p>
                    
                    {adminActivity?.breakdown && adminActivity.breakdown.length > 0 ? (
                      <div className="space-y-2">
                        {adminActivity.breakdown.map((item, i) => (
                          <div key={i} className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground font-mono">{item.actionType}</span>
                            <Badge variant="outline">{item.count}</Badge>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No admin actions recorded</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
};

// Reusable metric card component
interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  variant?: "default" | "success" | "muted";
}

const MetricCard = ({ title, value, subtitle, icon, variant = "default" }: MetricCardProps) => {
  const variantStyles = {
    default: "",
    success: "border-green-500/20 bg-green-500/5",
    muted: "border-muted bg-muted/5",
  };

  return (
    <Card className={variantStyles[variant]}>
      <CardContent className="pt-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
          </div>
          {icon && <div className="text-muted-foreground">{icon}</div>}
        </div>
      </CardContent>
    </Card>
  );
};

export default AdminMetrics;
