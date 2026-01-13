import { useState } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { signUp } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";

// Get beta mode from env - default to false for production
const BETA_MODE = import.meta.env.VITE_BETA_MODE === "true";

const isBetaMode = () => BETA_MODE;

const signupSchema = z
  .object({
    fullName: z.string().min(2, "Full name must be at least 2 characters"),
    email: z.string().email("Please enter a valid email address"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    confirmPassword: z.string(),
    inviteCode: BETA_MODE
      ? z.string().min(1, "Invite code is required for beta access")
      : z.string().optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Check invite code in beta mode
    if (betaMode && !formData.inviteCode.trim()) {
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
      // Validate and consume invite code
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

      setLoading(false);
      toast({
        title: "Account created!",
        description: "Redirecting to role selection...",
      });

      // Carry the role param forward to onboarding
      const roleParam = role ? `?role=${role}` : "";
      navigate(`/onboarding/role${roleParam}`);
    } else {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <Card className="w-full max-w-md p-8 shadow-lg">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold mb-2 text-foreground">
            Create Account
          </h1>
          <p className="text-muted-foreground">
            Join ClearMarket as a {roleLabel}
          </p>
        </div>

        {role === "vendor" && (
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

        {role === "rep" && (
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

          {betaMode && (
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

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Creating account..." : "Create Account"}
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

        {betaMode && (
          <div className="mt-4 text-center border-t border-border pt-4">
            <p className="text-xs text-muted-foreground">
              Want early access?{" "}
              <a
                href="mailto:hello@clearmarket.io?subject=Beta Access Request"
                className="text-primary hover:underline"
              >
                Join the waitlist
              </a>
            </p>
          </div>
        )}
      </Card>
    </div>
  );
};

export default SignUp;
