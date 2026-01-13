import { useState, useEffect, ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Lock, AlertCircle, Loader2, Mail } from "lucide-react";
import { Link } from "react-router-dom";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const DEMO_ACCESS_CODE = "asktracy";
const SPAM_COOLDOWN_MS = 60000; // 60 seconds
const SPAM_KEY = "cm_demo_request_ts";

interface DemoAccessGateProps {
  children: ReactNode;
}

export function DemoAccessGate({ children }: DemoAccessGateProps) {
  const [accessCode, setAccessCode] = useState("");
  const [error, setError] = useState("");
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [contactModalOpen, setContactModalOpen] = useState(false);

  // Check if already unlocked from session
  useEffect(() => {
    const savedAccess = sessionStorage.getItem("demo_access");
    if (savedAccess === "granted") {
      setIsUnlocked(true);
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (accessCode.toLowerCase().trim() === DEMO_ACCESS_CODE) {
      sessionStorage.setItem("demo_access", "granted");
      setIsUnlocked(true);
    } else {
      setError("Invalid access code. Please try again.");
    }
  };

  if (isUnlocked) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/" className="text-xl font-bold text-primary">
            ClearMarket
          </Link>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link to="/signin">
              <Button variant="outline" size="sm">
                Sign In
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Access Code Form */}
      <main className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Lock className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>Demo Access</CardTitle>
            <p className="text-sm text-muted-foreground mt-2">
              Enter the access code to view the ClearMarket demo
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="accessCode">Access Code</Label>
                <Input
                  id="accessCode"
                  type="text"
                  placeholder="Enter code"
                  value={accessCode}
                  onChange={(e) => setAccessCode(e.target.value)}
                  autoFocus
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  {error}
                </div>
              )}

              <Button type="submit" className="w-full">
                Access Demo
              </Button>
            </form>

            <p className="text-xs text-center text-muted-foreground mt-4">
              Don't have a code?{" "}
              <button
                type="button"
                onClick={() => setContactModalOpen(true)}
                className="text-primary hover:underline"
              >
                Contact us
              </button>
            </p>
          </CardContent>
        </Card>
      </main>

      {/* Contact Modal */}
      <ContactRequestModal
        open={contactModalOpen}
        onOpenChange={setContactModalOpen}
      />
    </div>
  );
}

interface ContactRequestModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function ContactRequestModal({ open, onOpenChange }: ContactRequestModalProps) {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [company, setCompany] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [messageError, setMessageError] = useState("");

  const validateEmail = (value: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!value.trim()) {
      setEmailError("Email is required");
      return false;
    }
    if (!emailRegex.test(value)) {
      setEmailError("Please enter a valid email address");
      return false;
    }
    setEmailError("");
    return true;
  };

  const validateMessage = (value: string) => {
    if (!value.trim()) {
      setMessageError("Message is required");
      return false;
    }
    if (value.trim().length < 10) {
      setMessageError("Message must be at least 10 characters");
      return false;
    }
    setMessageError("");
    return true;
  };

  const checkSpamCooldown = (): boolean => {
    const lastSubmit = localStorage.getItem(SPAM_KEY);
    if (lastSubmit) {
      const elapsed = Date.now() - parseInt(lastSubmit, 10);
      if (elapsed < SPAM_COOLDOWN_MS) {
        const remaining = Math.ceil((SPAM_COOLDOWN_MS - elapsed) / 1000);
        toast({
          title: "Please wait",
          description: `You can submit another request in ${remaining} seconds.`,
          variant: "destructive",
        });
        return false;
      }
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const isEmailValid = validateEmail(email);
    const isMessageValid = validateMessage(message);

    if (!isEmailValid || !isMessageValid) return;
    if (!checkSpamCooldown()) return;

    setIsSubmitting(true);

    try {
      const { data, error } = await supabase.functions.invoke("send-demo-request", {
        body: {
          fromEmail: email.trim(),
          company: company.trim() || undefined,
          message: message.trim(),
          source: "demo_access",
        },
      });

      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || "Failed to send request");

      // Mark timestamp for spam protection
      localStorage.setItem(SPAM_KEY, Date.now().toString());

      toast({
        title: "Request sent!",
        description: "Check your email for a copy of your message.",
      });

      // Reset form and close modal
      setEmail("");
      setMessage("");
      setCompany("");
      onOpenChange(false);
    } catch (err: any) {
      console.error("Error sending demo request:", err);
      toast({
        title: "Something went wrong",
        description: err.message || "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setEmail("");
    setMessage("");
    setCompany("");
    setEmailError("");
    setMessageError("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
            <Mail className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-center">Request Demo Access</DialogTitle>
          <DialogDescription className="text-center">
            Send us a quick note and we'll reply with access details.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label htmlFor="contact-email">Your Email *</Label>
            <Input
              id="contact-email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (emailError) validateEmail(e.target.value);
              }}
              onBlur={() => validateEmail(email)}
              disabled={isSubmitting}
            />
            {emailError && (
              <p className="text-xs text-destructive">{emailError}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="contact-company">Company / Role (optional)</Label>
            <Input
              id="contact-company"
              type="text"
              placeholder="e.g. Acme Inspections, Field Rep"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="contact-message">Message *</Label>
            <Textarea
              id="contact-message"
              placeholder="Tell us a bit about yourself and why you're interested..."
              value={message}
              onChange={(e) => {
                setMessage(e.target.value);
                if (messageError) validateMessage(e.target.value);
              }}
              onBlur={() => validateMessage(message)}
              rows={4}
              disabled={isSubmitting}
            />
            {messageError && (
              <p className="text-xs text-destructive">{messageError}</p>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending…
                </>
              ) : (
                "Send Request"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
