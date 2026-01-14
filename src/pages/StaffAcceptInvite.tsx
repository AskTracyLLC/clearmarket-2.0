import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { AlertCircle, Loader2, CheckCircle2 } from "lucide-react";

interface StaffInviteDetails {
  invited_name: string;
  invited_email: string;
  vendor_name: string;
  vendor_code: string;
  role: string;
  expires_at: string;
}

const StaffAcceptInvite = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  
  const inviteId = searchParams.get("inviteId");
  const inviteToken = searchParams.get("token");
  
  // Loading states
  const [validating, setValidating] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  // Invite state
  const [inviteDetails, setInviteDetails] = useState<StaffInviteDetails | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  
  // Form state
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Validate invite on mount
  useEffect(() => {
    async function validateInvite() {
      if (!inviteId || !inviteToken) {
        setInviteError("Invalid invite link. The link is missing required parameters.");
        setValidating(false);
        return;
      }

      try {
        const { data, error } = await supabase.functions.invoke("get-staff-invite-details", {
          body: { inviteId, token: inviteToken },
        });

        if (error || !data?.success) {
          // Map error codes to user-friendly messages
          const errorCode = data?.code;
          let errorMsg = data?.error || error?.message || "Invalid invite link";
          
          if (errorCode === "EXPIRED") {
            errorMsg = "This invite link has expired. Please ask your vendor to resend the invite.";
          } else if (errorCode === "INVITE_USED") {
            errorMsg = "This invite has already been accepted. If you need to sign in, use the login page.";
          } else if (errorCode === "INVALID_TOKEN") {
            errorMsg = "This invite link is invalid. Please ask your vendor to resend the invite.";
          }
          
          setInviteError(errorMsg);
          setValidating(false);
          return;
        }

        setInviteDetails({
          invited_name: data.full_name || "",
          invited_email: data.email || "",
          vendor_name: data.vendor_name || "",
          vendor_code: data.vendor_code || "",
          role: data.role || "staff",
          expires_at: data.expires_at || "",
        });
      } catch (err) {
        console.error("Failed to validate invite:", err);
        setInviteError("Failed to validate your invite. Please try again or contact support.");
      } finally {
        setValidating(false);
      }
    }

    validateInvite();
  }, [inviteId, inviteToken]);

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (password.length < 6) {
      errors.password = "Password must be at least 6 characters";
    }

    if (password !== confirmPassword) {
      errors.confirmPassword = "Passwords don't match";
    }

    if (!termsAccepted) {
      errors.terms = "You must accept the Terms of Service to continue";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm() || !inviteDetails || !inviteId || !inviteToken) {
      return;
    }

    setSubmitting(true);

    try {
      const { data, error } = await supabase.functions.invoke("accept-staff-invite", {
        body: {
          inviteId,
          token: inviteToken,
          password,
          termsAccepted: true,
          termsVersion: "2025-01",
        },
      });

      if (error || !data?.success) {
        const errorMsg = data?.error || error?.message || "Failed to complete setup";
        toast({
          title: "Setup Failed",
          description: errorMsg,
          variant: "destructive",
        });
        setSubmitting(false);
        return;
      }

      // Sign in the user with the new credentials
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: inviteDetails.invited_email,
        password,
      });

      if (signInError) {
        toast({
          title: "Account Created",
          description: "Your account was created but we couldn't sign you in automatically. Please sign in manually.",
        });
        navigate("/signin");
        return;
      }

      toast({
        title: "Welcome to ClearMarket!",
        description: `You've joined ${inviteDetails.vendor_code || "your vendor"} as ${inviteDetails.role}.`,
      });

      // Redirect to dashboard
      navigate("/dashboard");
    } catch (err) {
      console.error("Failed to accept invite:", err);
      toast({
        title: "Error",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Loading state
  if (validating) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-background">
        <Card className="w-full max-w-md p-8 shadow-lg">
          <div className="flex flex-col items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Validating your invite...</p>
          </div>
        </Card>
      </div>
    );
  }

  // Error state
  if (inviteError) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-background">
        <Card className="w-full max-w-md p-8 shadow-lg">
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
              <AlertCircle className="h-6 w-6 text-destructive" />
            </div>
            <h2 className="text-xl font-semibold mb-2 text-foreground">Invite Issue</h2>
            <p className="text-muted-foreground mb-6">{inviteError}</p>
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

  // Success state - show form
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-background">
      <Card className="w-full max-w-md p-8 shadow-lg">
        <div className="mb-8 text-center">
          <Link to="/" className="text-xl font-bold text-primary hover:underline">
            ClearMarket
          </Link>
          <h1 className="text-2xl font-bold mb-2 mt-4 text-foreground">
            Accept Your Invitation
          </h1>
          <p className="text-muted-foreground text-sm">
            Complete your account to join the team
          </p>
        </div>

        {/* Invite details card */}
        <div className="mb-6 p-4 rounded-lg border border-primary/30 bg-primary/5">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">
                You're joining {inviteDetails?.vendor_code || inviteDetails?.vendor_name || "a vendor team"}
              </p>
              <p className="text-xs text-muted-foreground">
                Role: <span className="capitalize font-medium text-foreground">{inviteDetails?.role}</span>
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Prefilled name (read-only) */}
          <div>
            <Label htmlFor="name" className="text-sm text-muted-foreground">Full Name</Label>
            <Input
              id="name"
              type="text"
              value={inviteDetails?.invited_name || ""}
              disabled
              className="bg-muted/50"
            />
          </div>

          {/* Prefilled email (read-only) */}
          <div>
            <Label htmlFor="email" className="text-sm text-muted-foreground">Email</Label>
            <Input
              id="email"
              type="email"
              value={inviteDetails?.invited_email || ""}
              disabled
              className="bg-muted/50"
            />
          </div>

          {/* Password */}
          <div>
            <Label htmlFor="password" className="text-sm text-muted-foreground">Create Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="Enter a secure password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={formErrors.password ? "border-destructive" : ""}
            />
            {formErrors.password && (
              <p className="text-sm text-destructive mt-1">{formErrors.password}</p>
            )}
          </div>

          {/* Confirm Password */}
          <div>
            <Label htmlFor="confirmPassword" className="text-sm text-muted-foreground">Confirm Password</Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="Confirm your password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={formErrors.confirmPassword ? "border-destructive" : ""}
            />
            {formErrors.confirmPassword && (
              <p className="text-sm text-destructive mt-1">{formErrors.confirmPassword}</p>
            )}
          </div>

          {/* Terms checkbox */}
          <div className="flex items-start space-x-3 pt-2">
            <Checkbox
              id="terms"
              checked={termsAccepted}
              onCheckedChange={(checked) => setTermsAccepted(checked === true)}
              className={formErrors.terms ? "border-destructive" : ""}
            />
            <div className="grid gap-1.5 leading-none">
              <Label
                htmlFor="terms"
                className="text-sm font-normal text-muted-foreground leading-relaxed cursor-pointer"
              >
                I agree to the{" "}
                <Link to="/terms" target="_blank" className="text-primary hover:underline">
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link to="/privacy" target="_blank" className="text-primary hover:underline">
                  Privacy Policy
                </Link>
              </Label>
              {formErrors.terms && (
                <p className="text-sm text-destructive">{formErrors.terms}</p>
              )}
            </div>
          </div>

          <Button
            type="submit"
            className="w-full mt-6"
            disabled={submitting}
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Setting up...
              </>
            ) : (
              "Finish Setup"
            )}
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

export default StaffAcceptInvite;
