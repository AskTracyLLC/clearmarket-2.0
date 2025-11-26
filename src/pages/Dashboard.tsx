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
import { Search, FileText, User, Building2, PlusCircle, Users } from "lucide-react";

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState<any>(null);
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
            {/* My Profile Card - MVP Feature */}
            <Card className="p-6 bg-card-elevated border border-border">
              <div className="flex items-start gap-4 mb-4">
                {isRep ? (
                  <User className="h-6 w-6 text-primary" />
                ) : (
                  <Building2 className="h-6 w-6 text-primary" />
                )}
                <div className="flex-1">
                  <h2 className="text-xl font-semibold text-foreground mb-2">
                    {isRep ? "My Profile" : "My Company Profile"}
                  </h2>
                  <div className="space-y-2 text-sm">
                    <p className="text-muted-foreground">
                      <span className="font-medium text-foreground">Name:</span> {profile?.full_name || "Not set"}
                    </p>
                    <p className="text-muted-foreground">
                      <span className="font-medium text-foreground">Email:</span> {profile?.email}
                    </p>
                    <p className="text-muted-foreground">
                      <span className="font-medium text-foreground">Role:</span> {isRep ? "Field Representative" : "Vendor"}
                    </p>
                    {/* TODO: Add city, state, ZIP fields when profile editing is implemented */}
                    <p className="text-xs text-secondary mt-4">
                      Full profile editing coming soon
                    </p>
                  </div>
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
                {/* TODO: COMING SOON - Seeking Coverage posts */}
                <div onClick={() => handleComingSoonClick("Seeking Coverage")}>
                  <ComingSoonCard
                    icon={<PlusCircle className="h-6 w-6" />}
                    title="Seeking Coverage"
                    description="Create posts to find qualified field reps for your coverage needs. Specify location, inspection types, and required systems."
                  />
                </div>

                {/* TODO: COMING SOON - Find Reps feature */}
                <div onClick={() => handleComingSoonClick("Find Reps")}>
                  <ComingSoonCard
                    icon={<Users className="h-6 w-6" />}
                    title="Find Reps"
                    description="Search and filter field representatives by location, certifications, systems used, and reputation scores."
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
