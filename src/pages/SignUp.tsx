import { useState, useEffect } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { signUp } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";
import { AlertCircle, Loader2 } from "lucide-react";

// Get beta mode from env - default to TRUE during beta (matches server BETA_MODE)
// Set VITE_BETA_MODE=false to disable invite code requirement
const BETA_MODE = import.meta.env.VITE_BETA_MODE !== "false";

const isBetaMode = () => BETA_MODE;

const SignUp = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
    inviteCode: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Get role from URL param (passed from homepage buttons)
  const role = searchParams.get("role");
  const roleLabel =
    role === "rep" ? "Field Rep" : role === "vendor" ? "Vendor" : "User";
  const betaMode = isBetaMode();
  
  // Staff invite bypass - staff invites from vendors skip invite code requirement
  const isStaffInvite = searchParams.get("staffInvite") === "1";
  const inviteId = searchParams.get("inviteId");
  const inviteToken = searchParams.get("token");
  
  // Staff invite state
  const [staffInviteLoading, setStaffInviteLoading] = useState(false);
  const [staffInviteError, setStaffInviteError] = useState<string | null>(null);
  const [staffInviteValid, setStaffInviteValid] = useState(false);

  // Fetch staff invite details on mount if this is a staff invite
  useEffect(() => {
    async function fetchStaffInviteDetails() {
      if (!isStaffInvite || !inviteId || !inviteToken) {
        if (isStaffInvite && (!inviteId || !inviteToken)) {
          setStaffInviteError("Invalid invite link. Please ask the vendor to resend your invite.");
        }
        return;
      }

      setStaffInviteLoading(true);
      setStaffInviteError(null);

      try {
        const { data, error } = await supabase.functions.invoke("get-staff-invite-details", {
          body: { inviteId, token: inviteToken },
        });

        if (error || !data?.success) {
          const errorMsg = data?.error || error?.message || "Invalid or expired invite link";
          setStaffInviteError(errorMsg);
          setStaffInviteLoading(false);
          return;
        }

        // Prefill form with invite details
        setFormData(prev => ({
          ...prev,
          fullName: data.full_name || "",
          email: data.email || "",
        }));
        setStaffInviteValid(true);
      } catch (err) {
        console.error("Failed to fetch staff invite details:", err);
        setStaffInviteError("Failed to validate invite. Please try again or ask the vendor to resend.");
      } finally {
        setStaffInviteLoading(false);
      }
    }

    fetchStaffInviteDetails();
  }, [isStaffInvite, inviteId, inviteToken]);

  // Dynamic schema based on whether this is a staff invite
  const getSignupSchema = () => {
    const baseSchema = {
      fullName: z.string().min(2, "Full name must be at least 2 characters"),
      email: z.string().email("Please enter a valid email address"),
      password: z.string().min(6, "Password must be at least 6 characters"),
      confirmPassword: z.string(),
      inviteCode: isStaffInvite 
        ? z.string().optional() 
        : (betaMode ? z.string().min(1, "Invite code is required for beta access") : z.string().optional()),
    };

    return z.object(baseSchema).refine((data) => data.password === data.confirmPassword, {
      message: "Passwords don't match",
      path: ["confirmPassword"],
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Staff invites require valid invite verification
    if (isStaffInvite && !staffInviteValid) {
      toast({
        title: "Invalid Invite",
        description: "Your staff invite could not be verified. Please ask the vendor to resend.",
        variant: "destructive",
      });
      return;
    }

    // Check invite code in beta mode (staff invites bypass this requirement)
    if (betaMode && !isStaffInvite && !formData.inviteCode.trim()) {
      setErrors({ inviteCode: "Invite code is required during beta" });
      toast({
        title: "Invite Code Required",
        description:
          "ClearMarket is currently in invite-only beta. Please enter a valid invite code.",
        variant: "destructive",
      });
      return;
    }

    // Validate form
    const signupSchema = getSignupSchema();
    const result = signupSchema.safeParse(formData);
    if (!result.success) {
      const newErrors: Record<string, string> = {};
      result.error.errors.forEach((error) => {
        if (error.path[0]) {
          newErrors[error.path[0] as string] = error.message;
        }
      });
      setErrors(newErrors);
      return;
    }

    setLoading(true);

    const { data, error } = await signUp(
      formData.email,
      formData.password,
      formData.fullName
    );

    if (error) {
      setLoading(false);
      toast({
        title: "Sign up failed",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    if (data.user) {
      // Staff invites skip invite code validation entirely
      if (!isStaffInvite) {
        // Validate and consume invite code for normal signups
        try {
          const response = await supabase.functions.invoke(
            "validate-invite-code",
            {
              body: {
                code: formData.inviteCode.trim() || null,
                userId: data.user.id,
              },
            }
          );

          console.log("Invite validation response:", response);

          // Check for function invoke error OR unsuccessful result
          const hasError =
            response.error || (response.data && response.data.success === false);

          if (hasError && betaMode) {
            console.error(
              "Invite validation failed:",
              response.error || response.data?.error
            );
            await supabase.auth.signOut({ scope: "local" });
            setLoading(false);
            toast({
              title: "Invalid Invite Code",
              description:
                response.data?.error ||
                response.error?.message ||
                "We couldn't validate your invite code. Your account wasn't activated. Please check your code or contact support.",
              variant: "destructive",
            });
            return;
          }
        } catch (err) {
          console.error("Invite validation exception:", err);
          if (betaMode) {
            await supabase.auth.signOut({ scope: "local" });
            setLoading(false);
            toast({
              title: "Validation Error",
              description:
                "We couldn't validate your invite code. Please try again or contact support.",
              variant: "destructive",
            });
            return;
          }
        }
      }

      setLoading(false);
      toast({
        title: "Account created!",
        description: "Completing setup...",
      });

      // Navigate directly to terms with role param for RPC processing
      // Pass staffInvite flag and inviteId to terms page for staff invite resolution
      const params = new URLSearchParams();
      if (role) params.set("role", role);
      if (isStaffInvite) {
        params.set("staffInvite", "1");
        if (inviteId) params.set("inviteId", inviteId);
      }
      const queryString = params.toString() ? `?${params.toString()}` : "";
      navigate(`/onboarding/terms${queryString}`);
    } else {
      setLoading(false);
    }
  };

  // Show loading state while fetching staff invite details
  if (isStaffInvite && staffInviteLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <Card className="w-full max-w-md p-8 shadow-lg">
          <div className="flex flex-col items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Validating your invite...</p>
          </div>
        </Card>
      </div>
    );
  }

  // Show error state for invalid staff invites
  if (isStaffInvite && staffInviteError) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <Card className="w-full max-w-md p-8 shadow-lg">
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
              <AlertCircle className="h-6 w-6 text-destructive" />
            </div>
            <h2 className="text-xl font-semibold mb-2 text-foreground">Invalid Invite Link</h2>
            <p className="text-muted-foreground mb-6">{staffInviteError}</p>
            <div className="space-y-3 w-full">
              <Button variant="outline" asChild className="w-full">
                <Link to="/signin">Sign In Instead</Link>
              </Button>
              <p className="text-xs text-muted-foreground">
                If you believe this is an error, please contact your vendor administrator to resend the invite.
              </p>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <Card className="w-full max-w-md p-8 shadow-lg">
        <div className="mb-8 text-center">
          <Link to="/" className="text-xl font-bold text-primary hover:underline">
            ClearMarket
          </Link>
          <h1 className="text-3xl font-bold mb-2 mt-4 text-foreground">
            {isStaffInvite ? "Complete Your Account" : "Create Account"}
          </h1>
          <p className="text-muted-foreground">
            {isStaffInvite 
              ? "Set your password to join the team" 
              : `Join ClearMarket as a ${roleLabel}`}
          </p>
        </div>

        {role === "vendor" && !isStaffInvite && (
          <div className="mb-6 p-3 rounded-md border border-border bg-muted/30">
            <p className="text-xs text-muted-foreground leading-relaxed">
              <span className="font-medium text-foreground/80">
                Also a Field Rep?
              </span>{" "}
              If you're a Field Rep who covers areas and coordinates work for
              other reps, please sign up as a Field Rep first. After signup,
              request Dual Role Access in Settings to enable Vendor tools.
            </p>
          </div>
        )}

        {role === "rep" && !isStaffInvite && (
          <div className="mb-6 p-3 rounded-md border border-border bg-muted/30">
            <p className="text-xs text-muted-foreground leading-relaxed">
              <span className="font-medium text-foreground/80">
                Need Vendor tools too?
              </span>{" "}
              If you coordinate work for other reps, you can request Dual Role
              Access in Settings after signup.
            </p>
          </div>
        )}

        {isStaffInvite && staffInviteValid && (
          <div className="mb-6 p-4 rounded-md border border-primary/30 bg-primary/5">
            <p className="text-sm font-medium text-primary mb-1">
              You've been invited to join as Vendor Staff
            </p>
            <p className="text-xs text-muted-foreground">
              Your name and email are locked to match the invite. Just set your password below.
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Input
              type="text"
              placeholder="Full Name"
              value={formData.fullName}
              onChange={(e) =>
                setFormData({ ...formData, fullName: e.target.value })
              }
              className={errors.fullName ? "border-destructive" : ""}
              disabled={isStaffInvite && staffInviteValid}
            />
            {errors.fullName && (
              <p className="text-sm text-destructive mt-1">{errors.fullName}</p>
            )}
          </div>

          <div>
            <Input
              type="email"
              placeholder="Email"
              value={formData.email}
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
              className={errors.email ? "border-destructive" : ""}
              disabled={isStaffInvite && staffInviteValid}
            />
            {errors.email && (
              <p className="text-sm text-destructive mt-1">{errors.email}</p>
            )}
          </div>

          <div>
            <Input
              type="password"
              placeholder="Password"
              value={formData.password}
              onChange={(e) =>
                setFormData({ ...formData, password: e.target.value })
              }
              className={errors.password ? "border-destructive" : ""}
            />
            {errors.password && (
              <p className="text-sm text-destructive mt-1">{errors.password}</p>
            )}
          </div>

          <div>
            <Input
              type="password"
              placeholder="Confirm Password"
              value={formData.confirmPassword}
              onChange={(e) =>
                setFormData({ ...formData, confirmPassword: e.target.value })
              }
              className={errors.confirmPassword ? "border-destructive" : ""}
            />
            {errors.confirmPassword && (
              <p className="text-sm text-destructive mt-1">
                {errors.confirmPassword}
              </p>
            )}
          </div>

          {betaMode && !isStaffInvite && (
            <div>
              <Input
                type="text"
                placeholder="Invite Code"
                value={formData.inviteCode}
                onChange={(e) =>
                  setFormData({ ...formData, inviteCode: e.target.value })
                }
                className={errors.inviteCode ? "border-destructive" : ""}
              />
              {errors.inviteCode && (
                <p className="text-sm text-destructive mt-1">
                  {errors.inviteCode}
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                ClearMarket is in invite-only beta. Enter your code above.
              </p>
            </div>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={loading || (betaMode && !isStaffInvite && !formData.inviteCode.trim()) || (isStaffInvite && !staffInviteValid)}
          >
            {loading ? "Creating account..." : isStaffInvite ? "Complete Account" : "Create Account"}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link to="/signin" className="text-primary hover:underline">
              Sign in
            </Link>
          </p>
        </div>

      </Card>
    </div>
  );
};

export default SignUp;
