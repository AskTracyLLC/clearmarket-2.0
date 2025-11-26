import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const TERMS_VERSION = "1.0";

const Terms = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [scrolledToBottom, setScrolledToBottom] = useState(false);
  const [signature, setSignature] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const termsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/signin");
    }
  }, [user, authLoading, navigate]);

  const handleScroll = () => {
    if (termsRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = termsRef.current;
      // Consider scrolled to bottom if within 20px of the bottom
      if (scrollHeight - scrollTop - clientHeight < 20) {
        setScrolledToBottom(true);
      }
    }
  };

  const handleAccept = async () => {
    if (!user || !signature.trim() || !confirmed) return;

    setLoading(true);

    // Update profile with terms acceptance
    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        has_signed_terms: true,
        terms_signed_at: new Date().toISOString(),
        terms_version: TERMS_VERSION
      })
      .eq('id', user.id);

    if (profileError) {
      setLoading(false);
      toast({
        title: "Error",
        description: profileError.message,
        variant: "destructive",
      });
      return;
    }

    // Create document record
    const documentData = {
      title: `Terms & Conditions Agreement - ${TERMS_VERSION}`,
      signed_name: signature.trim(),
      signature_timestamp: new Date().toISOString(),
      metadata: { version: TERMS_VERSION, user_agent: navigator.userAgent }
    };

    const { error: docError } = await supabase
      .from('documents')
      .insert({
        user_id: user.id,
        document_type: 'nda_tos',
        title: documentData.title,
        signed_name: documentData.signed_name,
        signature_timestamp: documentData.signature_timestamp,
        metadata: documentData.metadata
      });

    setLoading(false);

    if (docError) {
      toast({
        title: "Warning",
        description: "Terms accepted but document record failed to save.",
        variant: "destructive",
      });
    }

    toast({
      title: "Terms accepted",
      description: "Welcome to ClearMarket!",
    });

    navigate("/dashboard");
  };

  const canAccept = scrolledToBottom && signature.trim().length > 0 && confirmed;

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <Card className="w-full max-w-3xl p-8 shadow-lg">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2 text-foreground">Terms of Service & NDA</h1>
          <p className="text-muted-foreground">Please read and accept our terms to continue</p>
        </div>

        {/* Terms Content - Scrollable */}
        <div 
          ref={termsRef}
          onScroll={handleScroll}
          className="bg-card-elevated border border-border rounded-lg p-6 h-96 overflow-y-auto mb-6 prose prose-invert max-w-none"
        >
          <h2 className="text-xl font-bold mb-4">ClearMarket Terms of Service and Non-Disclosure Agreement</h2>
          <p className="mb-4 text-sm text-muted-foreground">Version {TERMS_VERSION} | Effective Date: January 2025</p>

          <h3 className="text-lg font-semibold mb-2">1. Agreement to Terms</h3>
          <p className="mb-4">
            By creating an account on ClearMarket, you agree to be bound by these Terms of Service and Non-Disclosure Agreement. 
            This is a legally binding contract between you and ClearMarket.
          </p>

          <h3 className="text-lg font-semibold mb-2">2. Platform Purpose</h3>
          <p className="mb-4">
            ClearMarket is a professional networking platform connecting independent Field Representatives with Vendors 
            in the property inspection industry. It is NOT a dispatch platform. All business relationships and agreements 
            are between users directly.
          </p>

          <h3 className="text-lg font-semibold mb-2">3. User Responsibilities</h3>
          <p className="mb-4">
            You agree to provide accurate information, maintain the security of your account, conduct yourself professionally, 
            and comply with all applicable laws and regulations.
          </p>

          <h3 className="text-lg font-semibold mb-2">4. Confidentiality and Non-Disclosure</h3>
          <p className="mb-4">
            You agree to keep all information obtained through ClearMarket confidential, including but not limited to: 
            contact information of other users, business practices, pricing information, and any proprietary methods or systems.
          </p>

          <h3 className="text-lg font-semibold mb-2">5. Prohibited Activities</h3>
          <p className="mb-4">
            You may NOT: share contact information obtained through ClearMarket with third parties, use the platform 
            for spam or harassment, misrepresent your qualifications or business, or violate any applicable laws.
          </p>

          <h3 className="text-lg font-semibold mb-2">6. Credit System</h3>
          <p className="mb-4">
            Vendors may purchase credits to unlock Field Rep contact information. Credits are non-refundable once used. 
            ClearMarket reserves the right to modify credit pricing and policies.
          </p>

          <h3 className="text-lg font-semibold mb-2">7. Limitation of Liability</h3>
          <p className="mb-4">
            ClearMarket is a platform only. We do not guarantee work opportunities, verify credentials beyond basic information, 
            or assume liability for business relationships between users. Use the platform at your own risk.
          </p>

          <h3 className="text-lg font-semibold mb-2">8. Termination</h3>
          <p className="mb-4">
            We may suspend or terminate your account for violations of these terms. You may close your account at any time.
          </p>

          <h3 className="text-lg font-semibold mb-2">9. Changes to Terms</h3>
          <p className="mb-4">
            We reserve the right to modify these terms. Continued use after changes constitutes acceptance of new terms.
          </p>

          <h3 className="text-lg font-semibold mb-2">10. Governing Law</h3>
          <p className="mb-4">
            These terms are governed by the laws of the United States. Any disputes shall be resolved through binding arbitration.
          </p>

          <p className="text-sm text-muted-foreground mt-8">
            By signing below, you acknowledge that you have read, understood, and agree to these Terms of Service and 
            Non-Disclosure Agreement.
          </p>
        </div>

        {!scrolledToBottom && (
          <p className="text-sm text-muted-foreground mb-4 text-center">
            Please scroll to the bottom to continue
          </p>
        )}

        {/* Signature Section */}
        <div className="space-y-4">
          <div>
            <Label htmlFor="signature">Your Full Legal Name (Electronic Signature)</Label>
            <Input
              id="signature"
              type="text"
              placeholder="Type your full legal name"
              value={signature}
              onChange={(e) => setSignature(e.target.value)}
              disabled={!scrolledToBottom || loading}
              className="mt-2"
            />
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox 
              id="confirm"
              checked={confirmed}
              onCheckedChange={(checked) => setConfirmed(checked as boolean)}
              disabled={!scrolledToBottom || loading}
            />
            <Label 
              htmlFor="confirm" 
              className="text-sm cursor-pointer"
            >
              I confirm that I have read and agree to the Terms of Service and NDA
            </Label>
          </div>

          <Button 
            onClick={handleAccept}
            disabled={!canAccept || loading}
            className="w-full"
            size="lg"
          >
            {loading ? "Processing..." : "Accept and Continue"}
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default Terms;
