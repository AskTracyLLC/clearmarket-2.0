import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Briefcase, Building, Shield } from "lucide-react";
import { sendWelcomeEmail } from "@/lib/welcomeEmail";

type OnboardingRole = "rep" | "vendor";

const RoleSelection = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const [autoApplying, setAutoApplying] = useState(false);

  // Check for role param from homepage buttons
  const roleParam = searchParams.get("role") as OnboardingRole | null;
  const validRoleParam = roleParam === "rep" || roleParam === "vendor" ? roleParam : null;

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

  // Auto-apply role if passed via URL param
  useEffect(() => {
    if (
      validRoleParam &&
      user &&
      !authLoading &&
      !checkingAdmin &&
      !loading &&
      !autoApplying
    ) {
      setAutoApplying(true);
      handleRoleSelect(validRoleParam);
    }
  }, [validRoleParam, user, authLoading, checkingAdmin, loading, autoApplying]);

  const handleRoleSelect = async (role: OnboardingRole) => {
    if (!user) return;

    setLoading(true);

    // Call the secure RPC to set role (avoids RLS restrictions on profiles)
    const { data: rpcResult, error: rpcError } = await supabase.rpc(
      "set_onboarding_role",
      { p_role: role }
    );

    // Type the result properly
    const result = rpcResult as { success: boolean; error?: string; role?: string } | null;

    if (rpcError || (result && !result.success)) {
      setLoading(false);
      setAutoApplying(false);
      const errorMsg =
        rpcError?.message || result?.error || "Failed to set role";
      toast({
        title: "Error",
        description: errorMsg,
        variant: "destructive",
      });
      return;
    }

    // Track if we created a new vendor profile (for matching)
    let vendorCompanyName: string | undefined;

    // If vendor role selected, vendor_profile will be created in VendorProfile page
    // We check if one exists for matching purposes
    if (role === "vendor") {
      const { data: existingVendorProfile } = await supabase
        .from("vendor_profile")
        .select("id, company_name")
        .eq("user_id", user.id)
        .maybeSingle();

      if (existingVendorProfile) {
        vendorCompanyName = existingVendorProfile.company_name || undefined;
      }
    }

    // Process manual vendor contact matches for new vendors
    if (role === "vendor" && user.email) {
      try {
        // Call edge function to process matches (non-blocking)
        supabase.functions
          .invoke("process-vendor-contact-matches", {
            body: {
              vendorUserId: user.id,
              vendorEmail: user.email,
              vendorCompanyName: vendorCompanyName,
            },
          })
          .then((response) => {
            if (response.error) {
              console.error(
                "Error processing vendor contact matches:",
                response.error
              );
            } else {
              console.log("Vendor contact matches processed:", response.data);
            }
          })
          .catch((err) => {
            console.error("Exception processing vendor contact matches:", err);
          });
      } catch (err) {
        console.error("Error initiating vendor contact matching:", err);
      }
    }

    // Fetch anonymous ID from the appropriate profile table
    let anonymousId = "User";
    const profileTable = role === "vendor" ? "vendor_profile" : "rep_profile";

    const { data: profileData } = await supabase
      .from(profileTable)
      .select("anonymous_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profileData?.anonymous_id) {
      anonymousId = profileData.anonymous_id;
    }

    // Send welcome email (non-blocking)
    sendWelcomeEmail(user.email || "", anonymousId, role)
      .then((result) => {
        if (result.ok) {
          console.log("Welcome email sent successfully");
        } else if (!result.skipped) {
          console.error("Failed to send welcome email:", result.error);
        }
      })
      .catch((err) => console.error("Exception sending welcome email:", err));

    setLoading(false);

    toast({
      title: "Role selected!",
      description: "Proceeding to terms agreement...",
    });

    navigate("/onboarding/terms");
  };

  const handleAdminSkip = async () => {
    if (!user) return;

    setLoading(true);

    // Update terms for admin users skipping role selection
    const { error } = await supabase
      .from("profiles")
      .update({
        has_signed_terms: true,
        terms_signed_at: new Date().toISOString(),
        terms_version: "v1",
      })
      .eq("id", user.id);

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

  // Show loading while auth/admin check in progress or auto-applying role
  if (authLoading || checkingAdmin || autoApplying) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">
          {autoApplying ? "Setting up your account..." : "Loading..."}
        </p>
      </div>
    );
  }

  // If role param is valid, we're auto-applying (handled above), so don't render cards
  // This is a fallback in case the effect hasn't triggered yet
  if (validRoleParam) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Setting up your account...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-3xl">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4 text-foreground">
            Choose Your Role
          </h1>
          <p className="text-xl text-muted-foreground">
            How will you be using ClearMarket?
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <Card
            className="p-6 cursor-pointer hover:border-primary transition-all duration-300 hover:shadow-primary-glow group"
            onClick={() => !loading && handleRoleSelect("rep")}
          >
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-primary/10 rounded-full flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                <Briefcase className="text-primary" size={32} />
              </div>
              <h2 className="text-xl font-bold mb-2 text-foreground">
                I'm a Field Rep
              </h2>
              <p className="text-sm text-muted-foreground mb-4">
                I perform inspections and am looking for work from vendors.
              </p>
              <Button size="sm" className="w-full" disabled={loading}>
                Continue as Field Rep
              </Button>
              <div className="mt-4 pt-4 border-t border-border">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  <span className="font-medium text-foreground/80">
                    Need Vendor tools too?
                  </span>{" "}
                  If you coordinate work for other reps, you can request Dual
                  Role Access in Settings after signup.
                </p>
              </div>
            </div>
          </Card>

          <Card
            className="p-6 cursor-pointer hover:border-secondary transition-all duration-300 hover:shadow-secondary-glow group"
            onClick={() => !loading && handleRoleSelect("vendor")}
          >
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-secondary/10 rounded-full flex items-center justify-center group-hover:bg-secondary/20 transition-colors">
                <Building className="text-secondary" size={32} />
              </div>
              <h2 className="text-xl font-bold mb-2 text-foreground">
                I'm a Vendor
              </h2>
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
              <div className="mt-4 pt-4 border-t border-border">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  <span className="font-medium text-foreground/80">
                    Also a Field Rep?
                  </span>{" "}
                  Sign up as a Field Rep first, then request Dual Role Access in
                  Settings to enable Vendor tools.
                </p>
              </div>
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
              You have admin privileges. Skip role selection to access admin
              features directly.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default RoleSelection;
