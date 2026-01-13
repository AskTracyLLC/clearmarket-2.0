import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { sendWelcomeEmail } from "@/lib/welcomeEmail";

type OnboardingRole = "rep" | "vendor";

/**
 * RoleSelection - Silent role handler (no UI cards)
 * 
 * Reads role from URL query param, sets it via RPC, and redirects to /onboarding/terms.
 * If no valid role param, redirects to homepage.
 */
const RoleSelection = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [error, setError] = useState<string | null>(null);
  
  // Guard to ensure we only process once per mount
  const hasProcessed = useRef(false);

  // Get role from URL param
  const roleParam = searchParams.get("role") as OnboardingRole | null;
  const validRoleParam = roleParam === "rep" || roleParam === "vendor" ? roleParam : null;

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/signin");
    }
  }, [user, authLoading, navigate]);

  // Process role on mount - only once
  useEffect(() => {
    if (authLoading || !user || hasProcessed.current) return;

    // If no valid role param, redirect to homepage
    if (!validRoleParam) {
      navigate("/");
      return;
    }

    // Mark as processed immediately to prevent re-runs
    hasProcessed.current = true;
    processRole(validRoleParam);
  }, [authLoading, user, validRoleParam]);

  const processRole = async (role: OnboardingRole) => {
    if (!user) return;

    // First check if role is already set - skip RPC if so
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("is_fieldrep, is_vendor_admin, active_role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error("Error checking profile:", profileError);
      // Continue to terms anyway - the role might get set there
      navigate("/onboarding/terms");
      return;
    }

    // Check if role already matches
    const roleAlreadySet = 
      (role === "rep" && profile?.is_fieldrep && profile?.active_role === "rep") ||
      (role === "vendor" && profile?.is_vendor_admin && profile?.active_role === "vendor");

    if (roleAlreadySet) {
      console.log("Role already set, skipping RPC");
      navigate("/onboarding/terms");
      return;
    }

    // Call the secure RPC to set role
    const { data: rpcResult, error: rpcError } = await supabase.rpc(
      "set_onboarding_role",
      { p_role: role }
    );

    const result = rpcResult as { success: boolean; error?: string; role?: string } | null;

    if (rpcError || (result && !result.success)) {
      const errorMsg = rpcError?.message || result?.error || "Failed to set role";
      console.error("RPC error:", errorMsg);
      setError(errorMsg);
      toast({
        title: "Setup Notice",
        description: "Continuing to terms...",
      });
      // Navigate to terms anyway - don't loop
      navigate("/onboarding/terms");
      return;
    }

    // Process vendor contact matches for new vendors (non-blocking)
    if (role === "vendor" && user.email) {
      try {
        const { data: existingVendorProfile } = await supabase
          .from("vendor_profile")
          .select("id, company_name")
          .eq("user_id", user.id)
          .maybeSingle();

        const vendorCompanyName = existingVendorProfile?.company_name || undefined;

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
              console.error("Error processing vendor contact matches:", response.error);
            }
          })
          .catch((err) => {
            console.error("Exception processing vendor contact matches:", err);
          });
      } catch (err) {
        console.error("Error initiating vendor contact matching:", err);
      }
    }

    // Fetch anonymous ID for welcome email
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

    // Redirect to terms
    navigate("/onboarding/terms");
  };

  // Always show loading state - this is a silent handler
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <p className="text-muted-foreground">
          {error ? "Redirecting..." : "Setting up your account..."}
        </p>
      </div>
    </div>
  );
};

export default RoleSelection;
