import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { signOut } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

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

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const isRep = profile?.is_fieldrep;
  const isVendor = profile?.is_vendor_admin;

  return (
    <div className="min-h-screen">
      <div className="container mx-auto px-4 py-12">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-foreground mb-2">
              {isRep ? "Field Rep Dashboard" : "Vendor Dashboard"}
            </h1>
            <p className="text-muted-foreground">
              Welcome back, {profile?.full_name || user?.email}
            </p>
          </div>
          <Button variant="outline" onClick={handleSignOut}>
            Sign Out
          </Button>
        </div>

        <div className="grid gap-6 max-w-4xl">
          <Card className="p-8">
            <h2 className="text-2xl font-bold mb-4 text-foreground">
              {isRep ? "Rep Dashboard Coming Soon" : "Vendor Dashboard Coming Soon"}
            </h2>
            <p className="text-muted-foreground mb-6">
              {isRep 
                ? "Your Field Rep dashboard is under development. Soon you'll be able to browse seeking coverage posts, manage your profile, and connect with vendors."
                : "Your Vendor dashboard is under development. Soon you'll be able to post seeking coverage, search for field reps, and manage your network."
              }
            </p>
            
            <div className="space-y-4">
              <div className="p-4 bg-card-elevated rounded-lg border border-border">
                <h3 className="font-semibold mb-2">Profile Status</h3>
                <p className="text-sm text-muted-foreground">
                  {isRep && "✓ Registered as Field Representative"}
                  {isVendor && "✓ Registered as Vendor"}
                </p>
                <p className="text-sm text-muted-foreground">
                  ✓ Terms & Conditions Accepted
                </p>
              </div>

              {isRep && (
                <div className="p-4 bg-card-elevated rounded-lg border border-border">
                  <h3 className="font-semibold mb-2">Coming Features</h3>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Browse Seeking Coverage posts</li>
                    <li>• Complete your rep profile</li>
                    <li>• Message vendors</li>
                    <li>• Build your reputation</li>
                  </ul>
                </div>
              )}

              {isVendor && (
                <div className="p-4 bg-card-elevated rounded-lg border border-border">
                  <h3 className="font-semibold mb-2">Coming Features</h3>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Post Seeking Coverage</li>
                    <li>• Search and filter field reps</li>
                    <li>• Unlock rep contact information</li>
                    <li>• Message your network</li>
                  </ul>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
