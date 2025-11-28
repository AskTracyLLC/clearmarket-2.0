import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { signOut } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { ComingSoonCard } from "@/components/ComingSoonCard";
import { OnboardingChecklist } from "@/components/OnboardingChecklist";
import { Search, FileText, User, Building2, PlusCircle, Users, Edit, MessageSquare, Briefcase } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { NavLink } from "@/components/NavLink";

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState<any>(null);
  const [repProfile, setRepProfile] = useState<any>(null);
  const [vendorProfile, setVendorProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);

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
    }

    setLoading(false);
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

        <div className="grid lg:grid-cols-3 gap-6 max-w-7xl">
          {/* Main Content Area */}
          <div className="lg:col-span-2 space-y-6">
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
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    {unreadMessageCount > 0 
                      ? `You have ${unreadMessageCount} unread message${unreadMessageCount === 1 ? '' : 's'}`
                      : `View and respond to conversations with ${isRep ? "vendors" : "field reps"}`
                    }
                  </p>
                  <Button size="sm" variant="secondary">
                    Open Inbox →
                  </Button>
                </div>
              </div>
            </Card>

            {/* My Network Card - Role-specific */}
            {isRep && (
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
            )}

            {isVendor && (
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
