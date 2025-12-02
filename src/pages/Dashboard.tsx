import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { signOut } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { ComingSoonCard } from "@/components/ComingSoonCard";
import { OnboardingChecklist } from "@/components/OnboardingChecklist";
import { Search, FileText, User, Building2, PlusCircle, Users, Edit, MessageSquare, Briefcase, Star, Bell, ShieldAlert, CheckCircle2, Circle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { NavLink } from "@/components/NavLink";
import { Progress } from "@/components/ui/progress";
import { computeRepProfileCompleteness, computeVendorProfileCompleteness, getCompletionMessage, ProfileCompletenessResult } from "@/lib/profileCompleteness";
import { SoftWarningBanner } from "@/components/SoftWarningBanner";
import { checkSoftWarnings } from "@/lib/qualityAnalytics";

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
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
      
      // Redirect to onboarding if needed
      if (!data.has_signed_terms) {
        navigate("/onboarding/terms");
        return;
      }
      if (!data.is_fieldrep && !data.is_vendor_admin) {
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
        
        // Get coverage areas count for completion calculation
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
      }
      if (data.is_vendor_admin) {
        const vendorResult = await computeVendorProfileCompleteness(supabase, user.id);
        setVendorCompleteness(vendorResult);
      }

      // Check for soft warnings
      const role = data.is_fieldrep ? "rep" : data.is_vendor_admin ? "vendor" : null;
      if (role) {
        const warningData = await checkSoftWarnings(user.id, role);
        setSoftWarning(warningData);
      }
    }

    setLoading(false);
  };

  const checkReviewPrompts = async (userId: string, isRep: boolean, isVendor: boolean) => {
    try {
      const fourteenDaysAgo = new Date();
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

      // Query connections that are ≥14 days old
      let query = supabase
        .from("vendor_connections")
        .select("vendor_id, field_rep_id, requested_at")
        .eq("status", "connected")
        .lte("requested_at", fourteenDaysAgo.toISOString())
        .limit(5);

      // Filter by user role
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

        // Check if user has already reviewed this person
        const { data: existingReview } = await supabase
          .from("reviews")
          .select("id")
          .eq("reviewer_id", userId)
          .eq("reviewee_id", otherUserId)
          .eq("direction", direction)
          .maybeSingle();

        if (existingReview) continue; // Already reviewed

        // Check if there's at least one message exchanged
        const { count: messageCount } = await supabase
          .from("messages")
          .select("*", { count: "exact", head: true })
          .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
          .or(`sender_id.eq.${otherUserId},recipient_id.eq.${otherUserId}`)
          .limit(1);

        if (!messageCount || messageCount === 0) continue; // No messages

        // Fetch anonymous ID
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

  // TODO: Implement feature when ready
  const handleComingSoonClick = (featureName: string) => {
    toast({
      title: "Coming Soon",
      description: `${featureName} is not available yet in ClearMarket 2.0. Stay tuned!`,
      variant: "default",
    });
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

  // Calculate profile completion for Reps (MVP version + coverage areas)
  const calculateRepCompletion = () => {
    if (!repProfile) return 0;
    let completed = 0;
    let total = 6; // city, state, zip, at least one system, at least one inspection type, at least one coverage area
    
    if (repProfile.city) completed++;
    if (repProfile.state) completed++;
    if (repProfile.zip_code) completed++;
    if (repProfile.systems_used && repProfile.systems_used.length > 0) completed++;
    if (repProfile.inspection_types && repProfile.inspection_types.length > 0) completed++;
    if (repProfile.coverage_count > 0) completed++;
    
    return Math.round((completed / total) * 100);
  };

  // Get missing items for rep profile
  const getRepMissingItems = () => {
    if (!repProfile) return [];
    const missing = [];
    if (!repProfile.city) missing.push("City");
    if (!repProfile.state) missing.push("State");
    if (!repProfile.zip_code) missing.push("ZIP Code");
    if (!repProfile.systems_used || repProfile.systems_used.length === 0) missing.push("At least one System Used");
    if (!repProfile.inspection_types || repProfile.inspection_types.length === 0) missing.push("At least one Inspection Type");
    if (!repProfile.coverage_count || repProfile.coverage_count === 0) missing.push("At least one Coverage Area");
    return missing;
  };

  // Calculate profile completion for Vendors (MVP version)
  const calculateVendorCompletion = () => {
    if (!vendorProfile) return 0;
    let completed = 0;
    let total = 4; // company_name, city+state, at least one system, at least one inspection type
    
    if (vendorProfile.company_name) completed++;
    if (vendorProfile.city && vendorProfile.state) completed++;
    if (vendorProfile.systems_used && vendorProfile.systems_used.length > 0) completed++;
    if (vendorProfile.primary_inspection_types && vendorProfile.primary_inspection_types.length > 0) completed++;
    
    return Math.round((completed / total) * 100);
  };

  // Get missing items for vendor profile
  const getVendorMissingItems = () => {
    if (!vendorProfile) return [];
    const missing = [];
    if (!vendorProfile.company_name) missing.push("Company Name");
    if (!vendorProfile.city || !vendorProfile.state) missing.push("City and State");
    if (!vendorProfile.systems_used || vendorProfile.systems_used.length === 0) missing.push("At least one System Used");
    if (!vendorProfile.primary_inspection_types || vendorProfile.primary_inspection_types.length === 0) missing.push("At least one Inspection Type");
    return missing;
  };

  // Rep onboarding checklist items
  const repChecklistItems = [
    {
      id: "profile",
      label: "Confirm your basic profile info",
      completed: true,
    },
    {
      id: "coverage",
      label: "Add your coverage areas and pricing",
      completed: repProfile?.coverage_count > 0,
      comingSoon: false,
    },
    {
      id: "documents",
      label: "Upload your documents",
      completed: false,
      comingSoon: true,
    },
  ];

  // Vendor onboarding checklist items
  const vendorChecklistItems = [
    {
      id: "profile",
      label: "Confirm your company profile info",
      completed: true,
    },
    {
      id: "post",
      label: "Create your first Seeking Coverage post",
      completed: false,
      comingSoon: true,
    },
    {
      id: "review",
      label: "Review interested reps",
      completed: false,
      comingSoon: true,
    },
  ];

  return (
    <div className="min-h-screen">
      {/* Header with navigation */}
      <header className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-8">
              <Link to="/" className="text-xl font-bold text-foreground hover:text-primary transition-colors">
                ClearMarket
              </Link>
              <nav className="hidden md:flex gap-6">
                <NavLink to="/dashboard" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2" activeClassName="text-primary">
                  <Briefcase className="w-4 h-4" />
                  Dashboard
                </NavLink>
                <NavLink to="/messages" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2" activeClassName="text-primary">
                  <MessageSquare className="w-4 h-4" />
                  Messages
                  {unreadMessageCount > 0 && (
                    <Badge variant="secondary" className="bg-orange-500/20 text-orange-500 hover:bg-orange-500/30 ml-1">
                      {unreadMessageCount}
                    </Badge>
                  )}
                </NavLink>
                <NavLink to="/notifications" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2" activeClassName="text-primary">
                  <Bell className="w-4 h-4" />
                  Notifications
                  {unreadNotificationCount > 0 && (
                    <Badge variant="secondary" className="bg-orange-500/20 text-orange-500 hover:bg-orange-500/30 ml-1">
                      {unreadNotificationCount}
                    </Badge>
                  )}
                </NavLink>
                <NavLink to="/safety" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2" activeClassName="text-primary">
                  <ShieldAlert className="w-4 h-4" />
                  Safety
                </NavLink>
                {profile?.is_admin && (
                  <NavLink to="/admin/moderation" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2" activeClassName="text-primary">
                    <ShieldAlert className="w-4 h-4" />
                    Admin
                  </NavLink>
                )}
                {isVendor && vendorCredits !== null && (
                  <Link to="/vendor/credits" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2">
                    <Badge variant="secondary" className="bg-secondary/20 text-secondary hover:bg-secondary/30">
                      Credits: {vendorCredits}
                    </Badge>
                  </Link>
                )}
              </nav>
            </div>
            <Button variant="outline" size="sm" onClick={handleSignOut}>
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-12">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-2">
            {isRep ? "Field Rep Dashboard" : "Vendor Dashboard"}
          </h1>
          <p className="text-muted-foreground">
            Welcome back, {profile?.full_name || user?.email}
            {isRep && repProfile?.anonymous_id && ` (${repProfile.anonymous_id})`}
            {isVendor && vendorProfile?.anonymous_id && ` (${vendorProfile.anonymous_id})`}
          </p>
        </div>

        {/* Review Prompts */}
        {reviewPrompts.length > 0 && (
          <div className="mb-6 space-y-3 max-w-7xl">
            {reviewPrompts.map((prompt) => (
              <Card key={prompt.userId} className="bg-secondary/10 border-secondary/30">
                <CardContent className="py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <Star className="w-5 h-5 text-secondary flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-foreground mb-1">
                          Leave a review for {prompt.anonymousId}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          You've been connected for over 2 weeks. Share your experience to help build trust in the network.
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
            ))}
          </div>
        )}

        {/* Soft Warning Banner */}
        {softWarning.showWarning && softWarning.warningType && (
          <SoftWarningBanner message={softWarning.warningMessage} type={softWarning.warningType} />
        )}

        <div className="grid lg:grid-cols-3 gap-6 max-w-7xl">
          {/* Main Content Area */}
          <div className="lg:col-span-2 space-y-6">
            {/* Profile Setup Cards */}
            {isRep && repCompleteness && (
              <Card>
                <CardHeader>
                  <CardTitle>Field Rep Profile Setup</CardTitle>
                  <CardDescription>
                    You're {repCompleteness.percent}% set up. {getCompletionMessage(repCompleteness.percent)}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Progress value={repCompleteness.percent} />
                  <ul className="space-y-3">
                    {repCompleteness.checklist.map((item) => (
                      <li key={item.id} className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2 flex-1">
                          {item.done ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                          ) : (
                            <Circle className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                          )}
                          <div className="flex-1">
                            <p className="text-sm font-medium text-foreground">{item.label}</p>
                            {item.description && (
                              <p className="text-xs text-muted-foreground">{item.description}</p>
                            )}
                          </div>
                        </div>
                        {!item.done && item.link && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(item.link)}
                            className="flex-shrink-0"
                          >
                            Complete
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {isVendor && vendorCompleteness && (
              <Card>
                <CardHeader>
                  <CardTitle>Vendor Profile Setup</CardTitle>
                  <CardDescription>
                    You're {vendorCompleteness.percent}% set up. {getCompletionMessage(vendorCompleteness.percent)}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Progress value={vendorCompleteness.percent} />
                  <ul className="space-y-3">
                    {vendorCompleteness.checklist.map((item) => (
                      <li key={item.id} className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2 flex-1">
                          {item.done ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                          ) : (
                            <Circle className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                          )}
                          <div className="flex-1">
                            <p className="text-sm font-medium text-foreground">{item.label}</p>
                            {item.description && (
                              <p className="text-xs text-muted-foreground">{item.description}</p>
                            )}
                          </div>
                        </div>
                        {!item.done && item.link && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(item.link)}
                            className="flex-shrink-0"
                          >
                            Complete
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
            {/* Profile Status Card */}
            <Card className="p-6 bg-card-elevated border border-border">
              <div className="flex items-start gap-4">
                {isRep ? (
                  <User className="h-6 w-6 text-primary flex-shrink-0 mt-1" />
                ) : (
                  <Building2 className="h-6 w-6 text-primary flex-shrink-0 mt-1" />
                )}
                <div className="flex-1">
                  <h2 className="text-xl font-semibold text-foreground mb-4">
                    {isRep ? "My Profile" : "My Company Profile"}
                  </h2>
                  
                  {/* Completion percentage */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-muted-foreground">Profile Completion</span>
                      <span className="text-sm font-semibold text-foreground">
                        {isRep ? calculateRepCompletion() : calculateVendorCompletion()}%
                      </span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className="bg-secondary h-2 rounded-full transition-all duration-300"
                        style={{ 
                          width: `${isRep ? calculateRepCompletion() : calculateVendorCompletion()}%` 
                        }}
                      />
                    </div>
                  </div>

                  {/* Missing items */}
                  {isRep && getRepMissingItems().length > 0 && (
                    <div className="mb-4 p-3 bg-muted/30 rounded-md border border-border">
                      <p className="text-sm font-medium text-foreground mb-2">Still needed:</p>
                      <ul className="space-y-1">
                        {getRepMissingItems().map((item, idx) => (
                          <li key={idx} className="text-sm text-muted-foreground flex items-center gap-2">
                            <span className="text-secondary">•</span> {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {isVendor && getVendorMissingItems().length > 0 && (
                    <div className="mb-4 p-3 bg-muted/30 rounded-md border border-border">
                      <p className="text-sm font-medium text-foreground mb-2">Still needed:</p>
                      <ul className="space-y-1">
                        {getVendorMissingItems().map((item, idx) => (
                          <li key={idx} className="text-sm text-muted-foreground flex items-center gap-2">
                            <span className="text-secondary">•</span> {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {isRep && calculateRepCompletion() === 100 && (
                    <p className="text-sm text-secondary mb-4">✓ Your profile is complete!</p>
                  )}

                  {isVendor && calculateVendorCompletion() === 100 && (
                    <p className="text-sm text-secondary mb-4">✓ Your profile is complete!</p>
                  )}

                  <Link to={isRep ? "/rep/profile" : "/vendor/profile"}>
                    <Button size="sm" variant="secondary">
                      <Edit className="h-4 w-4 mr-2" />
                      {isRep 
                        ? (calculateRepCompletion() === 100 ? "View My Profile" : "Complete My Profile")
                        : (calculateVendorCompletion() === 100 ? "View Company Profile" : "Complete Company Profile")
                      }
                    </Button>
                  </Link>
                </div>
              </div>
            </Card>

            {/* Messages Card - Available to all users */}
            <Card className="p-6 bg-card-elevated border border-border hover:border-primary/50 transition-colors cursor-pointer" onClick={() => navigate("/messages")}>
              <div className="flex items-start gap-4">
                <MessageSquare className="h-6 w-6 text-primary flex-shrink-0 mt-1" />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-lg font-semibold text-foreground">Messages</h3>
                    {unreadMessageCount > 0 && (
                      <Badge variant="secondary" className="bg-orange-500/20 text-orange-500 hover:bg-orange-500/30">
                        {unreadMessageCount}
                      </Badge>
                    )}
                    {isRep && pendingConnectionCount > 0 && (
                      <Badge variant="secondary" className="bg-amber-500/20 text-amber-500 hover:bg-amber-500/30">
                        {pendingConnectionCount} pending
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    {unreadMessageCount > 0 
                      ? `You have ${unreadMessageCount} unread message${unreadMessageCount === 1 ? '' : 's'}`
                      : pendingConnectionCount > 0 
                      ? `${pendingConnectionCount} pending connection request${pendingConnectionCount === 1 ? '' : 's'}`
                      : `View and respond to conversations with ${isRep ? "vendors" : "field reps"}`
                    }
                  </p>
                  <div className="flex items-center gap-3">
                    <Button size="sm" variant="secondary">
                      Open Inbox →
                    </Button>
                    {(isVendor || isRep) && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(isVendor ? "/vendor/message-templates" : "/rep/message-templates");
                        }}
                      >
                        <FileText className="h-3 w-3 mr-1" />
                        Templates
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </Card>

            {/* My Network Card - Role-specific */}
            {isRep && (
              <>
                <Card className="p-6 bg-card-elevated border border-border hover:border-primary/50 transition-colors cursor-pointer" onClick={() => navigate("/rep/my-vendors")}>
                  <div className="flex items-start gap-4">
                    <Building2 className="h-6 w-6 text-primary flex-shrink-0 mt-1" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-lg font-semibold text-foreground">My Vendors</h3>
                        <span className="text-xs px-2 py-0.5 bg-secondary/20 text-secondary rounded-full">
                          New
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mb-4">
                        View vendors you've connected with through Seeking Coverage posts. Message them and track your connections.
                      </p>
                      <Button size="sm" variant="secondary">
                        View My Vendors →
                      </Button>
                    </div>
                  </div>
                </Card>

                <Card className="p-6 bg-card-elevated border border-border hover:border-primary/50 transition-colors cursor-pointer" onClick={() => navigate("/rep/reviews")}>
                  <div className="flex items-start gap-4">
                    <Star className="h-6 w-6 text-primary flex-shrink-0 mt-1" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-lg font-semibold text-foreground">Reviews</h3>
                        <span className="text-xs px-2 py-0.5 bg-secondary/20 text-secondary rounded-full">
                          New
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mb-4">
                        View your Trust Score, reviews you've received, and reviews you've given to vendors.
                      </p>
                      <Button size="sm" variant="secondary">
                        View Reviews →
                      </Button>
                    </div>
                  </div>
                </Card>
              </>
            )}

            {isVendor && (
              <>
                <Card className="p-6 bg-card-elevated border border-border hover:border-primary/50 transition-colors cursor-pointer" onClick={() => navigate("/vendor/my-reps")}>
                  <div className="flex items-start gap-4">
                    <Users className="h-6 w-6 text-primary flex-shrink-0 mt-1" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-lg font-semibold text-foreground">My Reps</h3>
                        <span className="text-xs px-2 py-0.5 bg-secondary/20 text-secondary rounded-full">
                          New
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mb-4">
                        View field reps you've marked as Connected. Message them and manage your network.
                      </p>
                      <Button size="sm" variant="secondary">
                        View My Reps →
                      </Button>
                    </div>
                  </div>
                </Card>

                <Card className="p-6 bg-card-elevated border border-border hover:border-primary/50 transition-colors cursor-pointer" onClick={() => navigate("/vendor/reviews")}>
                  <div className="flex items-start gap-4">
                    <Star className="h-6 w-6 text-primary flex-shrink-0 mt-1" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-lg font-semibold text-foreground">Reviews</h3>
                        <span className="text-xs px-2 py-0.5 bg-secondary/20 text-secondary rounded-full">
                          New
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mb-4">
                        View your Trust Score, reviews you've received, and reviews you've given to field reps.
                      </p>
                      <Button size="sm" variant="secondary">
                        View Reviews →
                      </Button>
                    </div>
                  </div>
                </Card>

                <Card className="p-6 bg-card-elevated border border-border hover:border-primary/50 transition-colors cursor-pointer" onClick={() => navigate("/vendor/credits")}>
                  <div className="flex items-start gap-4">
                    <div className="h-6 w-6 text-primary flex-shrink-0 mt-1">💳</div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-lg font-semibold text-foreground">Credits</h3>
                        {vendorCredits !== null && (
                          <Badge variant="secondary" className="bg-secondary/20 text-secondary">
                            {vendorCredits}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mb-4">
                        Manage your credits for posting Seeking Coverage and other premium features.
                      </p>
                      <Button size="sm" variant="secondary">
                        View Details →
                      </Button>
                    </div>
                  </div>
                </Card>
              </>
            )}

            {/* Coming Soon Cards - Role-specific */}
            {isRep && (
              <>
                {/* MVP READY - Find Work */}
                <Card className="p-6 bg-card-elevated border border-border hover:border-primary/50 transition-colors cursor-pointer" onClick={() => navigate("/rep/find-work")}>
                  <div className="flex items-start gap-4">
                    <Search className="h-6 w-6 text-primary flex-shrink-0 mt-1" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-lg font-semibold text-foreground">Find Work</h3>
                        <span className="text-xs px-2 py-0.5 bg-secondary/20 text-secondary rounded-full">
                          MVP Ready
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mb-4">
                        Browse Seeking Coverage posts from verified vendors in your area. Matched to your coverage, inspection types, and systems.
                      </p>
                      <Button size="sm" variant="secondary">
                        Browse Opportunities →
                      </Button>
                    </div>
                  </div>
                </Card>

                {/* NEW - Find Vendors */}
                <Card className="p-6 bg-card-elevated border border-border hover:border-primary/50 transition-colors cursor-pointer" onClick={() => navigate("/rep/find-vendors")}>
                  <div className="flex items-start gap-4">
                    <Building2 className="h-6 w-6 text-primary flex-shrink-0 mt-1" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-lg font-semibold text-foreground">Find Vendors</h3>
                        <span className="text-xs px-2 py-0.5 bg-secondary/20 text-secondary rounded-full">
                          New
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mb-4">
                        Discover and connect with vendors in your coverage areas. View trust scores, reviews, and vendor expectations.
                      </p>
                      <Button size="sm" variant="secondary">
                        Browse Vendors →
                      </Button>
                    </div>
                  </div>
                </Card>

                {/* TODO: COMING SOON - Looking for Work posts */}
                <div onClick={() => handleComingSoonClick("Looking for Work")}>
                  <ComingSoonCard
                    icon={<FileText className="h-6 w-6" />}
                    title="Looking for Work"
                    description="Post your availability and let vendors know you're seeking work. Specify your coverage areas, rates, and availability."
                  />
                </div>
              </>
            )}

            {isVendor && (
              <>
                {/* MVP PREVIEW - Find Reps (read-only) */}
                <Card className="p-6 bg-card-elevated border border-border hover:border-primary/50 transition-colors cursor-pointer" onClick={() => navigate("/vendor/find-reps")}>
                  <div className="flex items-start gap-4">
                    <Users className="h-6 w-6 text-primary flex-shrink-0 mt-1" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-lg font-semibold text-foreground">Find Reps</h3>
                        <span className="text-xs px-2 py-0.5 bg-secondary/20 text-secondary rounded-full">
                          MVP Preview
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mb-4">
                        Search and filter field representatives by location, systems used, and inspection types (unlock coming soon).
                      </p>
                      <Button size="sm" variant="secondary">
                        Browse Reps →
                      </Button>
                    </div>
                  </div>
                </Card>

                {/* MVP READY - Seeking Coverage */}
                <Card className="p-6 bg-card-elevated border border-border hover:border-primary/50 transition-colors cursor-pointer" onClick={() => navigate("/vendor/seeking-coverage")}>
                  <div className="flex items-start gap-4">
                    <PlusCircle className="h-6 w-6 text-primary flex-shrink-0 mt-1" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-lg font-semibold text-foreground">Seeking Coverage</h3>
                        <span className="text-xs px-2 py-0.5 bg-secondary/20 text-secondary rounded-full">
                          MVP Ready
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mb-4">
                        Create posts to find qualified field reps for your coverage needs. Specify location, inspection types, and required systems.
                      </p>
                      <Button size="sm" variant="secondary">
                        Manage Posts →
                      </Button>
                    </div>
                  </div>
                </Card>
              </>
            )}
          </div>

          {/* Sidebar - Getting Started Checklist */}
          <div className="space-y-6">
            <OnboardingChecklist
              title="Getting Started"
              items={isRep ? repChecklistItems : vendorChecklistItems}
            />

            {/* Quick Stats Card */}
            <Card className="p-6 bg-card-elevated border border-border">
              <h3 className="text-lg font-semibold mb-4 text-foreground">Quick Stats</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Profile Complete</span>
                  <span className="font-medium text-foreground">33%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {isRep ? "Jobs Applied" : "Posts Created"}
                  </span>
                  <span className="font-medium text-muted-foreground">—</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Messages</span>
                  <span className="font-medium text-muted-foreground">—</span>
                </div>
                <p className="text-xs text-secondary pt-2 border-t border-border">
                  More features coming soon
                </p>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
