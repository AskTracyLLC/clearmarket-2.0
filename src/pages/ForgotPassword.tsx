import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Mail, CheckCircle, HelpCircle } from "lucide-react";
import { z } from "zod";

const emailSchema = z.object({
  email: z.string().trim().email("Please enter a valid email address"),
});

const COOLDOWN_SECONDS = 60;

const ForgotPassword = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [cooldown, setCooldown] = useState(0);

  // Cooldown timer effect
  useEffect(() => {
    if (cooldown <= 0) return;
    
    const timer = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [cooldown]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const result = emailSchema.safeParse({ email });
    if (!result.success) {
      setError(result.error.errors[0]?.message || "Invalid email");
      return;
    }

    setLoading(true);

    try {
      const redirectTo = `${window.location.origin}/auth/update-password`;
      
      const { error: invokeError } = await supabase.functions.invoke('auth-send-recovery', {
        body: { email: email.trim(), redirectTo },
      });

      if (invokeError) {
        console.error("Edge function error:", invokeError);
        // Still show success to prevent user enumeration
      }

      // Always show success and start cooldown
      setSubmitted(true);
      setCooldown(COOLDOWN_SECONDS);
    } catch (err) {
      console.error("Request error:", err);
      // Still show success to prevent user enumeration
      setSubmitted(true);
      setCooldown(COOLDOWN_SECONDS);
    } finally {
      setLoading(false);
    }
  };

  const handleTryAnother = () => {
    setSubmitted(false);
    setEmail("");
    setError("");
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-background">
        <Card className="w-full max-w-md shadow-lg">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <CheckCircle className="h-6 w-6 text-primary" />
            </div>
            <CardTitle className="text-2xl font-bold text-foreground">Check your email</CardTitle>
            <CardDescription>
              If an account exists for <strong>{email}</strong>, you'll receive a password reset link shortly.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Helper tips */}
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <div className="flex items-start gap-2">
                <HelpCircle className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>• Check your spam or promotions folder</p>
                  <p>• Wait 1–2 minutes for the email to arrive</p>
                  <p>• Make sure you typed your email correctly</p>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Button 
                variant="outline" 
                onClick={handleTryAnother} 
                className="w-full"
                disabled={cooldown > 0}
              >
                {cooldown > 0 ? `Try another email (${cooldown}s)` : "Try another email"}
              </Button>
              <Link to="/signin">
                <Button variant="ghost" className="w-full">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Sign In
                </Button>
              </Link>
            </div>

            {/* Support link */}
            <div className="text-center pt-2 border-t">
              <p className="text-sm text-muted-foreground">
                Still having trouble?{" "}
                <a 
                  href="mailto:hello@useclearmarket.io" 
                  className="text-primary hover:underline"
                >
                  Contact support
                </a>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Mail className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold text-foreground">Reset your password</CardTitle>
          <CardDescription>
            Enter your email and we'll send you a reset link.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className={error ? "border-destructive" : ""}
                disabled={loading || cooldown > 0}
              />
              {error && <p className="text-sm text-destructive mt-1">{error}</p>}
            </div>

            <Button 
              type="submit" 
              className="w-full" 
              disabled={loading || cooldown > 0}
            >
              {loading ? "Sending..." : cooldown > 0 ? `Please wait (${cooldown}s)` : "Send reset link"}
            </Button>
          </form>

          <div className="mt-6 text-center space-y-3">
            <Link to="/signin" className="text-sm text-muted-foreground hover:text-primary inline-flex items-center">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to Sign In
            </Link>
            
            {/* Support link */}
            <div className="pt-3 border-t">
              <p className="text-sm text-muted-foreground">
                Need help?{" "}
                <a 
                  href="mailto:hello@useclearmarket.io" 
                  className="text-primary hover:underline"
                >
                  Contact support
                </a>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ForgotPassword;
