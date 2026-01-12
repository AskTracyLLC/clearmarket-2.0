import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { signUp } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";
import { isBetaMode } from "@/components/BetaBadge";

const signupSchema = z.object({
  fullName: z.string().trim().min(1, "Full name is required").max(100, "Name too long"),
  email: z.string().trim().email("Invalid email address").max(255, "Email too long"),
  password: z.string().min(8, "Password must be at least 8 characters").max(100, "Password too long"),
  confirmPassword: z.string(),
  inviteCode: z.string().optional()
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

const SignUp = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
    inviteCode: ""
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const role = searchParams.get("role");
  const roleLabel = role === "rep" ? "Field Rep" : role === "vendor" ? "Vendor" : "User";
  const betaMode = isBetaMode();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    
    // Check invite code in beta mode
    if (betaMode && !formData.inviteCode.trim()) {
      setErrors({ inviteCode: "Invite code is required during beta" });
      toast({
        title: "Invite Code Required",
        description: "ClearMarket is currently in invite-only beta. Please enter a valid invite code.",
        variant: "destructive",
      });
      return;
    }
    
    // Validate form
    const result = signupSchema.safeParse(formData);
    if (!result.success) {
      const newErrors: Record<string, string> = {};
      result.error.errors.forEach(error => {
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
              userId: data.user.id
            }
          }
        );

        console.log("Invite validation response:", response);

        // Check for function invoke error OR unsuccessful result
        const hasError = response.error || (response.data && response.data.success === false);
        
        if (hasError && betaMode) {
          console.error("Invite validation failed:", response.error || response.data?.error);
          await supabase.auth.signOut({ scope: 'local' });
          setLoading(false);
          toast({
            title: "Invalid Invite Code",
            description: response.data?.error || response.error?.message || "We couldn't validate your invite code. Your account wasn't activated. Please check your code or contact support.",
            variant: "destructive",
          });
          return;
        }
      } catch (err) {
        console.error("Invite validation exception:", err);
        if (betaMode) {
          await supabase.auth.signOut({ scope: 'local' });
          setLoading(false);
          toast({
            title: "Validation Error",
            description: "We couldn't validate your invite code. Please try again or contact support.",
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
      navigate("/onboarding/role");
    } else {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <Card className="w-full max-w-md p-8 shadow-lg">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold mb-2 text-foreground">Create Account</h1>
          <p className="text-muted-foreground">Join ClearMarket as a {roleLabel}</p>
        </div>

        {role === "vendor" && (
          <div className="mb-6 p-3 rounded-md border border-border bg-muted/30">
            <p className="text-xs text-muted-foreground leading-relaxed">
              <span className="font-medium text-foreground/80">Also a Field Rep?</span>{" "}
              If you're a Field Rep who covers areas and coordinates work for other reps, please sign up as a Field Rep first. After signup, request Dual Role Access in{" "}
              <a href="/settings" className="text-primary hover:underline">Settings</a>{" "}
              to enable Vendor tools.
            </p>
          </div>
        )}

        {role === "rep" && (
          <div className="mb-6 p-3 rounded-md border border-border bg-muted/30">
            <p className="text-xs text-muted-foreground leading-relaxed">
              <span className="font-medium text-foreground/80">Need Vendor tools too?</span>{" "}
              If you're a Field Rep who covers areas and coordinates work for other reps, you can request Dual Role Access in{" "}
              <a href="/settings" className="text-primary hover:underline">Settings</a>{" "}
              after signup.
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="fullName">Full Name</Label>
            <Input
              id="fullName"
              type="text"
              value={formData.fullName}
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              className={errors.fullName ? "border-destructive" : ""}
              disabled={loading}
            />
            {errors.fullName && <p className="text-sm text-destructive mt-1">{errors.fullName}</p>}
          </div>

          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className={errors.email ? "border-destructive" : ""}
              disabled={loading}
            />
            {errors.email && <p className="text-sm text-destructive mt-1">{errors.email}</p>}
          </div>

          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className={errors.password ? "border-destructive" : ""}
              disabled={loading}
            />
            {errors.password && <p className="text-sm text-destructive mt-1">{errors.password}</p>}
          </div>

          <div>
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={formData.confirmPassword}
              onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
              className={errors.confirmPassword ? "border-destructive" : ""}
              disabled={loading}
            />
            {errors.confirmPassword && <p className="text-sm text-destructive mt-1">{errors.confirmPassword}</p>}
          </div>

          <div>
            <Label htmlFor="inviteCode">
              Invite Code {betaMode && <span className="text-destructive">*</span>}
            </Label>
            <Input
              id="inviteCode"
              type="text"
              placeholder={betaMode ? "Required during beta" : "Optional"}
              value={formData.inviteCode}
              onChange={(e) => setFormData({ ...formData, inviteCode: e.target.value })}
              className={errors.inviteCode ? "border-destructive" : ""}
              disabled={loading}
            />
            {errors.inviteCode && <p className="text-sm text-destructive mt-1">{errors.inviteCode}</p>}
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Creating account..." : "Create Account"}
          </Button>
        </form>

        {betaMode && (
          <p className="mt-4 text-xs text-muted-foreground text-center">
            Don't have an invite code yet? We're in a small beta. Join the waitlist at{" "}
            <a href="https://asktracyllc.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
              asktracyllc.com
            </a>{" "}
            or contact{" "}
            <a href="mailto:hello@useclearmarket.io" className="text-primary hover:underline">
              hello@useclearmarket.io
            </a>
          </p>
        )}

        <div className="mt-6 text-center">
          <p className="text-sm text-muted-foreground">
            Already have an account?{" "}
            <a href="/signin" className="text-primary hover:underline">
              Sign in
            </a>
          </p>
        </div>
      </Card>
    </div>
  );
};

export default SignUp;
