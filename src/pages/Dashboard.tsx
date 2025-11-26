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
import { Search, FileText, User, Building2, PlusCircle, Users, Edit } from "lucide-react";

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState<any>(null);
  const [repProfile, setRepProfile] = useState<any>(null);
  const [vendorProfile, setVendorProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

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
        
        setRepProfile(repData);
      }

      if (data.is_vendor_admin) {
        const { data: vendorData } = await supabase
          .from("vendor_profile")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle();
        
        setVendorProfile(vendorData);
      }
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

  // Calculate profile completion for Reps (MVP version)
  const calculateRepCompletion = () => {
    if (!repProfile) return 0;
    let completed = 0;
    let total = 5; // city, state, zip, at least one system, at least one inspection type
    
    if (repProfile.city) completed++;
    if (repProfile.state) completed++;
    if (repProfile.zip_code) completed++;
    if (repProfile.systems_used && repProfile.systems_used.length > 0) completed++;
    if (repProfile.inspection_types && repProfile.inspection_types.length > 0) completed++;
    
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
      completed: false,
      comingSoon: true,
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
                <Link to="/dashboard" className="text-sm font-medium text-primary">
                  Dashboard
                </Link>
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

            {/* Coming Soon Cards - Role-specific */}
            {isRep && (
              <>
                {/* TODO: COMING SOON - Find Work feature */}
                <div onClick={() => handleComingSoonClick("Find Work")}>
                  <ComingSoonCard
                    icon={<Search className="h-6 w-6" />}
                    title="Find Work"
                    description="Browse Seeking Coverage posts from verified vendors in your area. Filter by location, inspection type, and systems used."
                  />
                </div>

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

                {/* TODO: COMING SOON - Seeking Coverage posts */}
                <div onClick={() => handleComingSoonClick("Seeking Coverage")}>
                  <ComingSoonCard
                    icon={<PlusCircle className="h-6 w-6" />}
                    title="Seeking Coverage"
                    description="Create posts to find qualified field reps for your coverage needs. Specify location, inspection types, and required systems."
                  />
                </div>
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
