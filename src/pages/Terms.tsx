import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

type OnboardingRole = "rep" | "vendor";

// Document type identifier for documents.document_type
const DOCUMENT_TYPE = "tos";

interface SitePage {
  id: string;
  title: string;
  content: string;
  effective_at: string | null;
  last_updated_at: string;
}

const Terms = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [scrolledToBottom, setScrolledToBottom] = useState(false);
  const [signature, setSignature] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const termsRef = useRef<HTMLDivElement>(null);
  
  // Database-driven terms content
  const [termsPage, setTermsPage] = useState<SitePage | null>(null);
  const [termsLoading, setTermsLoading] = useState(true);
  
  // Get role from URL param (passed from signup)
  const roleParam = searchParams.get("role") as OnboardingRole | null;
  const validRoleParam = roleParam === "rep" || roleParam === "vendor" ? roleParam : null;

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/signin");
    }
  }, [user, authLoading, navigate]);

  // Fetch terms from database
  useEffect(() => {
    async function loadTerms() {
      try {
        const { data, error } = await supabase
          .from("site_pages")
          .select("id, title, content, effective_at, last_updated_at")
          .eq("page_type", "tos" as "tos" | "privacy" | "support")
          .eq("is_published", true)
          .single();

        if (error) {
          console.error("Error loading terms:", error);
        } else if (data) {
          setTermsPage(data);
        }
      } catch (err) {
        console.error("Error loading terms:", err);
      } finally {
        setTermsLoading(false);
      }
    }
    loadTerms();
  }, []);

  const handleScroll = () => {
    if (termsRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = termsRef.current;
      // Consider scrolled to bottom if within 20px of the bottom
      if (scrollHeight - scrollTop - clientHeight < 20) {
        setScrolledToBottom(true);
      }
    }
  };

  // Derive version from effective_at date or last_updated_at
  const termsVersion = termsPage?.effective_at 
    ? format(new Date(termsPage.effective_at), "yyyy-MM") 
    : termsPage?.last_updated_at 
      ? format(new Date(termsPage.last_updated_at), "yyyy-MM")
      : "1.0";

  const handleAccept = async () => {
    if (!user || !signature.trim() || !confirmed) return;

    setLoading(true);

    // If we have a role param, set the role first via RPC
    console.log("[Terms] Role param:", roleParam, "Valid:", validRoleParam);
    
    if (validRoleParam) {
      // Check if role is already set
      const { data: profile, error: profileCheckError } = await supabase
        .from("profiles")
        .select("is_fieldrep, is_vendor_admin, active_role")
        .eq("id", user.id)
        .maybeSingle();

      console.log("[Terms] Profile check:", profile, "Error:", profileCheckError);

      const roleAlreadySet = 
        (validRoleParam === "rep" && profile?.is_fieldrep && profile?.active_role === "rep") ||
        (validRoleParam === "vendor" && profile?.is_vendor_admin && profile?.active_role === "vendor");

      console.log("[Terms] Role already set:", roleAlreadySet);

      if (!roleAlreadySet) {
        console.log("[Terms] Calling set_onboarding_role RPC with role:", validRoleParam);
        const { data: rpcResult, error: rpcError } = await supabase.rpc(
          "set_onboarding_role",
          { p_role: validRoleParam }
        );

        console.log("[Terms] RPC result:", rpcResult, "Error:", rpcError);

        const result = rpcResult as { success: boolean; error?: string } | null;

        if (rpcError || (result && !result.success)) {
          const errorMsg = rpcError?.message || result?.error || "Failed to set role";
          console.error("[Terms] RPC error setting role:", errorMsg);
          toast({
            title: "Role Setup Issue",
            description: "There was an issue setting your role. Please contact support if this persists.",
            variant: "destructive",
          });
          // Don't continue - this is critical
          setLoading(false);
          return;
        }
      }
    }

    // Update profile with terms acceptance
    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        has_signed_terms: true,
        terms_signed_at: new Date().toISOString(),
        terms_version: termsVersion
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

    // Create document record with consistent document_type
    const documentData = {
      title: `Terms & Conditions Agreement - ${termsVersion}`,
      signed_name: signature.trim(),
      signature_timestamp: new Date().toISOString(),
      metadata: { version: termsVersion, user_agent: navigator.userAgent, terms_page_id: termsPage?.id }
    };

    const { error: docError } = await supabase
      .from('documents')
      .insert({
        user_id: user.id,
        document_type: `${DOCUMENT_TYPE}_${termsVersion}`,
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

  if (authLoading || termsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  // Format effective date for display
  const effectiveDateDisplay = termsPage?.effective_at 
    ? format(new Date(termsPage.effective_at), "MMMM yyyy")
    : termsPage?.last_updated_at
      ? format(new Date(termsPage.last_updated_at), "MMMM yyyy")
      : "December 2025";

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <Card className="w-full max-w-3xl p-8 shadow-lg">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2 text-foreground">Terms of Service</h1>
          <p className="text-muted-foreground">Please read and accept our terms to continue</p>
        </div>

        {/* Terms Content - Scrollable */}
        <div 
          ref={termsRef}
          onScroll={handleScroll}
          className="bg-card-elevated border border-border rounded-lg p-6 h-96 overflow-y-auto mb-6 prose prose-invert max-w-none"
        >
          <h2 className="text-xl font-bold mb-4">{termsPage?.title || "ClearMarket Terms of Service"}</h2>
          <p className="mb-4 text-sm text-muted-foreground">Effective Date: {effectiveDateDisplay}</p>

          {termsPage?.content ? (
            <div className="whitespace-pre-wrap leading-relaxed text-foreground">
              {termsPage.content}
            </div>
          ) : (
            // Fallback content if no terms in database
            <>
              <h3 className="text-lg font-semibold mb-2">1. Agreement to Terms</h3>
              <p className="mb-4">
                By creating an account on ClearMarket, you agree to be bound by these Terms of Service. 
                This is a legally binding contract between you and ClearMarket.
              </p>

              <h3 className="text-lg font-semibold mb-2">2. Platform Purpose</h3>
              <p className="mb-4">
                ClearMarket is a professional networking platform connecting independent Field Representatives with Vendors 
                in the property inspection industry. It is NOT a dispatch platform. All business relationships and agreements 
                are between users directly.
              </p>

              <p className="text-sm text-muted-foreground mt-8">
                By signing below, you acknowledge that you have read, understood, and agree to these Terms of Service.
              </p>
            </>
          )}
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
              I confirm that I have read and agree to the Terms of Service
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
