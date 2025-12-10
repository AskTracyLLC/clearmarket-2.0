import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Briefcase, Building, Shield, Users } from "lucide-react";
import { sendWelcomeEmail } from "@/lib/welcomeEmail";

const RoleSelection = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/signin");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!user) {
        setCheckingAdmin(false);
        return;
      }
      
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", user.id)
        .maybeSingle();
      
      console.log("Admin check:", { profile, error, userId: user.id });
      
      if (error) {
        console.error("Error checking admin status:", error);
      }
      
      setIsAdmin(profile?.is_admin === true);
      setCheckingAdmin(false);
    };

    if (user && !authLoading) {
      checkAdminStatus();
    } else if (!authLoading && !user) {
      setCheckingAdmin(false);
    }
  }, [user, authLoading]);

  const handleRoleSelect = async (role: 'rep' | 'vendor' | 'both') => {
    if (!user) return;

    setLoading(true);

    // Set the appropriate flags based on selection
    const updates = (() => {
      switch (role) {
        case 'rep':
          return { is_fieldrep: true, active_role: null };
        case 'vendor':
          return { is_vendor_admin: true, active_role: null };
        case 'both':
          // For hybrid users, default to 'rep' as active role
          return { is_fieldrep: true, is_vendor_admin: true, active_role: 'rep' };
      }
    })();

    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id);

    if (error) {
      setLoading(false);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    // For hybrid users, create both profile records
    if (role === 'both') {
      // Create rep_profile if needed
      const { data: existingRepProfile } = await supabase
        .from('rep_profile')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!existingRepProfile) {
        await supabase.from('rep_profile').insert({ user_id: user.id });
      }

      // Create vendor_profile if needed
      const { data: existingVendorProfile } = await supabase
        .from('vendor_profile')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!existingVendorProfile) {
        await supabase.from('vendor_profile').insert({ 
          user_id: user.id, 
          company_name: 'My Company' // Required field with default
        });
      }
    }

    // Fetch anonymous ID from the appropriate profile table
    let anonymousId = `User`;
    const profileTable = role === 'vendor' ? 'vendor_profile' : 'rep_profile';
    
    const { data: profileData } = await supabase
      .from(profileTable)
      .select('anonymous_id')
      .eq('user_id', user.id)
      .maybeSingle();
    
    if (profileData?.anonymous_id) {
      anonymousId = profileData.anonymous_id;
    }

    // Send welcome email (non-blocking) - for 'both', send as rep
    const emailRole = role === 'both' ? 'rep' : role;
    sendWelcomeEmail(user.email || '', anonymousId, emailRole)
      .then((result) => {
        if (result.ok) {
          console.log("Welcome email sent successfully");
        } else if (!result.skipped) {
          console.error("Failed to send welcome email:", result.error);
        }
      })
      .catch((err) => console.error("Exception sending welcome email:", err));

    setLoading(false);

    const roleDescription = role === 'both' 
      ? "You can now switch between Field Rep and Vendor roles!"
      : "Proceeding to terms agreement...";

    toast({
      title: "Role selected!",
      description: roleDescription,
    });

    navigate("/onboarding/terms");
  };

  const handleAdminSkip = async () => {
    if (!user) return;

    setLoading(true);

    // Update terms for admin users skipping role selection
    const { error } = await supabase
      .from('profiles')
      .update({
        has_signed_terms: true,
        terms_signed_at: new Date().toISOString(),
        terms_version: 'v1'
      })
      .eq('id', user.id);

    setLoading(false);

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Welcome, Admin!",
      description: "Redirecting to dashboard...",
    });

    navigate("/dashboard");
  };

  if (authLoading || checkingAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-4xl">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4 text-foreground">Choose Your Role</h1>
          <p className="text-xl text-muted-foreground">
            How will you be using ClearMarket?
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <Card 
            className="p-6 cursor-pointer hover:border-primary transition-all duration-300 hover:shadow-primary-glow group"
            onClick={() => !loading && handleRoleSelect('rep')}
          >
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-primary/10 rounded-full flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                <Briefcase className="text-primary" size={32} />
              </div>
              <h2 className="text-xl font-bold mb-2 text-foreground">I'm a Field Rep</h2>
              <p className="text-sm text-muted-foreground mb-4">
                I perform inspections and am looking for work from vendors.
              </p>
              <Button 
                size="sm" 
                className="w-full"
                disabled={loading}
              >
                Continue as Field Rep
              </Button>
            </div>
          </Card>

          <Card 
            className="p-6 cursor-pointer hover:border-secondary transition-all duration-300 hover:shadow-secondary-glow group"
            onClick={() => !loading && handleRoleSelect('vendor')}
          >
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-secondary/10 rounded-full flex items-center justify-center group-hover:bg-secondary/20 transition-colors">
                <Building className="text-secondary" size={32} />
              </div>
              <h2 className="text-xl font-bold mb-2 text-foreground">I'm a Vendor</h2>
              <p className="text-sm text-muted-foreground mb-4">
                I assign work to field reps and seek coverage in my areas.
              </p>
              <Button 
                size="sm" 
                variant="secondary"
                className="w-full"
                disabled={loading}
              >
                Continue as Vendor
              </Button>
            </div>
          </Card>

          <Card 
            className="p-6 cursor-pointer hover:border-primary transition-all duration-300 hover:shadow-primary-glow group border-dashed"
            onClick={() => !loading && handleRoleSelect('both')}
          >
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-primary/10 to-secondary/10 rounded-full flex items-center justify-center group-hover:from-primary/20 group-hover:to-secondary/20 transition-colors">
                <Users className="text-foreground" size={32} />
              </div>
              <h2 className="text-xl font-bold mb-2 text-foreground">Both</h2>
              <p className="text-sm text-muted-foreground mb-4">
                I perform inspections and assign work to other reps.
              </p>
              <Button 
                size="sm" 
                variant="outline"
                className="w-full"
                disabled={loading}
              >
                Continue as Both
              </Button>
            </div>
          </Card>
        </div>

        {isAdmin && (
          <div className="mt-8 text-center">
            <Button
              variant="outline"
              size="lg"
              onClick={handleAdminSkip}
              disabled={loading}
              className="gap-2"
            >
              <Shield className="h-4 w-4" />
              Skip (Admin Only)
            </Button>
            <p className="text-sm text-muted-foreground mt-2">
              You have admin privileges. Skip role selection to access admin features directly.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default RoleSelection;
