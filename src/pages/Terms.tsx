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
          className="bg-card-elevated border border-border rounded-lg p-6 h-96 overflow-y-auto mb-6 prose prose-invert max-w-none text-sm"
        >
          <h2 className="text-xl font-bold mb-2">ClearMarket Terms of Service</h2>
          <p className="mb-4 text-sm text-muted-foreground">Last Updated: December 2025</p>

          <p className="mb-4">
            Welcome to ClearMarket. By using our platform, you agree to these Terms of Service ("Terms").
          </p>
          <p className="mb-6">
            These Terms form a binding agreement between you ("you," "User") and Ask Tracy LLC d/b/a ClearMarket ("ClearMarket," "we," "us," or "our"). If you do not agree to these Terms, you may not access or use the platform.
          </p>

          <h3 className="text-lg font-semibold mt-6 mb-3">1. What ClearMarket Is (and Is Not)</h3>
          <p className="mb-3">ClearMarket is a networking and coverage-matching platform for:</p>
          <ul className="list-disc pl-6 mb-3 space-y-1">
            <li><strong>Field Reps</strong> – independent contractors who perform property inspections and related services; and</li>
            <li><strong>Vendors</strong> – companies or individuals who assign those inspections.</li>
          </ul>
          <p className="mb-3">ClearMarket helps Field Reps and Vendors:</p>
          <ul className="list-disc pl-6 mb-3 space-y-1">
            <li>Create profiles and list service areas, inspection types, systems used, and preferences</li>
            <li>Search for and discover each other based on coverage, work types, and other criteria</li>
            <li>Exchange contact details (when unlocked)</li>
            <li>Share verified reviews after confirmed work is completed</li>
            <li>Participate in a community board and access analytics or insights (including paid features)</li>
          </ul>
          <p className="mb-3">ClearMarket:</p>
          <ul className="list-disc pl-6 mb-3 space-y-1">
            <li>Does not dispatch work</li>
            <li>Does not hire or employ Field Reps</li>
            <li>Is not a party to any work agreement between Field Reps and Vendors</li>
            <li>Does not mediate or guarantee payment, job performance, or outcomes once contact is exchanged</li>
          </ul>
          <p className="mb-4">All work relationships formed through ClearMarket are strictly independent contractor relationships between Users.</p>

          <h3 className="text-lg font-semibold mt-6 mb-3">2. Acceptance of Terms</h3>
          <p className="mb-3">By accessing or using ClearMarket (including browsing, creating an account, or participating in the community), you:</p>
          <ul className="list-disc pl-6 mb-3 space-y-1">
            <li>Agree to be bound by these Terms and all policies referenced in them</li>
            <li>Confirm that you are legally able to enter into contracts</li>
            <li>Agree that your use of ClearMarket is at your own risk and subject to these Terms</li>
          </ul>
          <p className="mb-4">If you do not agree, you must stop using the platform.</p>

          <h3 className="text-lg font-semibold mt-6 mb-3">3. Eligibility & Verification</h3>
          <p className="mb-3">To use ClearMarket, you must:</p>
          <ul className="list-disc pl-6 mb-3 space-y-1">
            <li>Be at least 18 years old (or the age of majority in your jurisdiction)</li>
            <li>Use the platform for business or professional purposes</li>
            <li>Comply with all applicable laws, regulations, and licensing/insurance requirements that apply to your work</li>
          </ul>
          <p className="mb-3">ClearMarket may require additional verification (such as ID verification, phone or email confirmation, or proof of business activity) before you can unlock contact details, post reviews, or access certain paid or community features. We may refuse, limit, or revoke verification at our discretion.</p>
          <p className="mb-4">We may suspend or terminate access if we believe you are not eligible or have violated these Terms.</p>

          <h3 className="text-lg font-semibold mt-6 mb-3">4. User Accounts & Security</h3>
          <p className="mb-3">You may need an account to access certain features. You agree to:</p>
          <ul className="list-disc pl-6 mb-3 space-y-1">
            <li>Provide accurate and complete information</li>
            <li>Keep your login credentials confidential</li>
            <li>Not share your account with others</li>
            <li>Notify us immediately if you suspect unauthorized access</li>
          </ul>
          <p className="mb-4">You are responsible for all activity that occurs under your account, including actions by anyone using your login.</p>

          <h3 className="text-lg font-semibold mt-6 mb-3">5. Professional Conduct & Community Standards</h3>
          <p className="mb-3">When using ClearMarket (including profiles, messages, reviews, and the community board), you agree to conduct yourself professionally. This includes:</p>
          <ul className="list-disc pl-6 mb-3 space-y-1">
            <li>Honest representation of your qualifications, experience, coverage areas, systems used, and pricing</li>
            <li>Timely communication with other Users, especially after connecting about potential work</li>
            <li>Respectful interactions – no harassment, hate speech, threats, or abusive behavior</li>
            <li>Accurate reviews that reflect your actual experience with another User</li>
            <li>No doxxing or sharing sensitive borrower/property info (e.g., full borrower names, exact property addresses, loan numbers) on public parts of the platform</li>
          </ul>
          <p className="mb-3">You may not use ClearMarket to:</p>
          <ul className="list-disc pl-6 mb-3 space-y-1">
            <li>Spam, solicit, or harass other Users</li>
            <li>Post misleading, defamatory, or false information</li>
            <li>Circumvent platform controls (for example, scraping contact details at scale or bypassing credit/subscription features)</li>
          </ul>
          <p className="mb-4">We may remove content, limit features, or suspend accounts that violate these standards.</p>

          <h3 className="text-lg font-semibold mt-6 mb-3">6. Public Profiles, Privacy & Visibility</h3>
          <h4 className="text-base font-semibold mt-4 mb-2">6.1 Public Profile Content</h4>
          <p className="mb-3">By default, your public profile may display:</p>
          <ul className="list-disc pl-6 mb-3 space-y-1">
            <li>Your name or business name</li>
            <li>General service areas (e.g., states, counties, or regions)</li>
            <li>Inspection types and work categories</li>
            <li>Systems/platforms you use</li>
            <li>Limited non-sensitive business information you choose to share</li>
          </ul>
          <p className="mb-4">ClearMarket does not publicly display your specific pricing or per-job fees by default. Any pricing you choose to share is visible only in direct interactions (such as messages or files you exchange with other Users) unless you explicitly publish it yourself.</p>

          <h4 className="text-base font-semibold mt-4 mb-2">6.2 Disabling Public Visibility</h4>
          <p className="mb-3">You may choose to limit or disable the public visibility of your profile within the platform settings. If you do so:</p>
          <ul className="list-disc pl-6 mb-3 space-y-1">
            <li>Certain information may remain visible to Users you are already connected with or have already messaged</li>
            <li>We may retain and use your data internally and in anonymized/aggregated form as described in these Terms</li>
            <li>Some minimal information may be used for fraud prevention, security, or legal compliance</li>
          </ul>
          <p className="mb-4">Disabling public visibility does not retroactively remove information from prior communications with other Users.</p>

          <h3 className="text-lg font-semibold mt-6 mb-3">7. Use License</h3>
          <p className="mb-3">ClearMarket grants you a limited, revocable, non-transferable, non-exclusive license to:</p>
          <ul className="list-disc pl-6 mb-3 space-y-1">
            <li>Access and use the platform for your own business or professional purposes</li>
            <li>View and interact with content made available to you through the platform</li>
          </ul>
          <p className="mb-3">This license does NOT allow you to:</p>
          <ul className="list-disc pl-6 mb-3 space-y-1">
            <li>Copy, scrape, harvest, or systematically download profiles, analytics, or data for resale or external use</li>
            <li>Reverse-engineer, decompile, or otherwise attempt to access source code</li>
            <li>Use ClearMarket to build or train a competing product or service</li>
          </ul>
          <p className="mb-4">All rights not expressly granted are reserved by ClearMarket.</p>

          <h3 className="text-lg font-semibold mt-6 mb-3">8. Independent Contractor Status & Job Relationships</h3>
          <p className="mb-3">ClearMarket is not a party to any agreement between Field Reps and Vendors.</p>
          <p className="mb-3">By using ClearMarket, you acknowledge and agree that:</p>
          <ul className="list-disc pl-6 mb-3 space-y-1">
            <li>Field Reps are independent contractors, not employees, agents, or partners of ClearMarket</li>
            <li>Vendors are independent businesses, not partners or joint venturers of ClearMarket</li>
            <li>ClearMarket does not control, supervise, or guarantee:
              <ul className="list-disc pl-6 mt-1 space-y-1">
                <li>Whether a Vendor issues work</li>
                <li>Whether a Field Rep accepts or completes work</li>
                <li>The quality, timeliness, or outcome of any job</li>
                <li>Payment terms or amounts</li>
              </ul>
            </li>
          </ul>
          <p className="mb-4">Any non-disclosure agreements (NDAs), independent contractor agreements, or work agreements between Field Reps and Vendors are strictly between those parties. ClearMarket is not responsible for drafting, enforcing, or monitoring those agreements.</p>

          <h3 className="text-lg font-semibold mt-6 mb-3">9. Payments, Credits, Subscriptions & Refunds</h3>
          <p className="mb-3">ClearMarket may offer:</p>
          <ul className="list-disc pl-6 mb-3 space-y-1">
            <li>Credits used for actions like unlocking contact details, boosting posts, or modifying feedback visibility</li>
            <li>Subscription tiers for Vendors and Field Reps that unlock additional analytics and features (e.g., market pricing insights, coverage difficulty, trend reports)</li>
          </ul>
          <p className="mb-3">By purchasing credits, subscriptions, or other paid offerings, you agree:</p>
          <ul className="list-disc pl-6 mb-3 space-y-1">
            <li>To provide accurate payment information and authorize us (and our payment processors) to charge your card or payment method</li>
            <li>That fees are due at the time of purchase and may be recurring if you subscribe</li>
          </ul>

          <h4 className="text-base font-semibold mt-4 mb-2">9.1 Refund & Chargeback Policy</h4>
          <p className="mb-3">Our Refund & Chargeback Policy is incorporated into these Terms by reference and forms part of your agreement with ClearMarket. In general:</p>
          <ul className="list-disc pl-6 mb-3 space-y-1">
            <li>Most fees are non-refundable once access to a feature (e.g., contact unlock, boost) has been delivered</li>
            <li>Refunds may be considered only in limited cases such as:
              <ul className="list-disc pl-6 mt-1 space-y-1">
                <li>Outdated or invalid contact info</li>
                <li>Duplicate charges</li>
                <li>Failed boosts or features not delivered as described</li>
              </ul>
            </li>
            <li>Refund requests must be submitted within the time window defined in the Refund & Chargeback Policy and include supporting details</li>
            <li>Filing chargebacks without first contacting ClearMarket support may result in suspension or permanent removal of your account</li>
          </ul>
          <p className="mb-4">Please review the full Refund & Chargeback Policy posted on our site for details.</p>

          <h4 className="text-base font-semibold mt-4 mb-2">9.2 New or Modified Features and Pricing</h4>
          <p className="mb-4">ClearMarket may introduce new features (free or paid), modify existing features, or change pricing over time. Any new or modified feature you choose to use will also be subject to these Terms and any additional terms presented at the time of purchase or use.</p>

          <h3 className="text-lg font-semibold mt-6 mb-3">10. Verified Reviews, Ratings & Analytics</h3>
          <p className="mb-3">ClearMarket allows Users to leave verified reviews about each other after confirming they have worked together, including ratings for on-time performance, quality of work, and communication. Reviews may contribute to Trust Scores, Community Scores, and other metrics on the platform.</p>
          <p className="mb-3">By using these features, you agree that:</p>
          <ul className="list-disc pl-6 mb-3 space-y-1">
            <li>You will only post reviews when you have actually worked with the other User</li>
            <li>Your reviews will be truthful, fair, and based on your real experience</li>
            <li>You understand that certain actions (e.g., marking a review as "feedback only," hiding or unhiding scores, or boosting visibility) may involve paid features</li>
          </ul>
          <p className="mb-3">ClearMarket may:</p>
          <ul className="list-disc pl-6 mb-3 space-y-1">
            <li>Display, sort, or summarize reviews and ratings</li>
            <li>Use review data to power analytics, Trust Meters, Community Scores, scorecards, and search rankings</li>
            <li>Remove or limit visibility of reviews we reasonably believe to be abusive, fraudulent, or in violation of these Terms</li>
          </ul>
          <p className="mb-4">You understand and agree that ClearMarket does not owe you a particular score or review outcome and does not guarantee that reviews will be error-free or free of bias.</p>

          <h3 className="text-lg font-semibold mt-6 mb-3">11. Community Board & User-Generated Content</h3>
          <p className="mb-3">The ClearMarket community board and any similar features (e.g., comments, posts, pinging "Under Review" posts) are intended to:</p>
          <ul className="list-disc pl-6 mb-3 space-y-1">
            <li>Share knowledge and support</li>
            <li>Discuss coverage, workflow, and industry topics</li>
            <li>Allow Users to mark posts as helpful, not helpful, or report them</li>
          </ul>
          <p className="mb-3">By posting content, you grant ClearMarket a worldwide, non-exclusive, royalty-free license (with the right to sublicense) to:</p>
          <ul className="list-disc pl-6 mb-3 space-y-1">
            <li>Host, store, display, and distribute your content</li>
            <li>Use your content in anonymized or aggregated form to improve the platform and generate analytics</li>
          </ul>
          <p className="mb-3">You may not post:</p>
          <ul className="list-disc pl-6 mb-3 space-y-1">
            <li>Borrower or property-identifying information (e.g., full borrower names, specific property addresses, loan IDs)</li>
            <li>Confidential client materials that you do not have the right to share</li>
            <li>Content that is illegal, defamatory, harassing, or otherwise harmful</li>
          </ul>
          <p className="mb-4">ClearMarket may hide, grey out, or remove content that receives repeated flags or appears to violate these Terms. We may also restrict posting privileges for Users who repeatedly violate community standards. Community-related actions (such as flags or helpful votes) may influence Community Scores or other metrics.</p>

          <h3 className="text-lg font-semibold mt-6 mb-3">12. Confidential Information</h3>
          <h4 className="text-base font-semibold mt-4 mb-2">12.1 Your Confidentiality Obligations</h4>
          <p className="mb-3">ClearMarket may include non-public information such as private messages, vendor/rep pricing and negotiations, internal workflows, moderation outcomes, verification details, and other content that is not intended for public distribution ("Confidential Information"). You agree not to copy, publish, disclose, or share ClearMarket Confidential Information outside the platform.</p>
          <p className="mb-3">The only exceptions are when:</p>
          <ul className="list-disc pl-6 mb-3 space-y-1">
            <li>ClearMarket provides an explicit sharing or export feature intended for that purpose (for example, a ClearMarket-generated link, report export, or "Share" function); or</li>
            <li>You have clear written permission from the rightful owner of the information.</li>
          </ul>
          <p className="mb-3">Confidentiality obligations are part of these Terms of Service; ClearMarket is not requiring a separate NDA for platform use.</p>
          <p className="mb-3">You agree that:</p>
          <ul className="list-disc pl-6 mb-4 space-y-1">
            <li>You will use Confidential Information solely for the purpose of exploring, managing, or performing work relationships formed via ClearMarket.</li>
            <li>You will take reasonable steps to protect this information from unauthorized use or disclosure (for example, not posting screenshots of internal pricing dashboards or another User's profile data in public forums).</li>
          </ul>

          <h4 className="text-base font-semibold mt-4 mb-2">12.2 ClearMarket's Use of Aggregated Data</h4>
          <p className="mb-3">ClearMarket may:</p>
          <ul className="list-disc pl-6 mb-3 space-y-1">
            <li>Collect and aggregate pricing, coverage, review, and performance data from Users; and</li>
            <li>Use that aggregated and/or anonymized data to provide analytics, benchmarks, and market insights to other Users.</li>
          </ul>
          <p className="mb-3">We will not disclose your personally identifiable, account-level pricing or contact information to other Users except:</p>
          <ul className="list-disc pl-6 mb-4 space-y-1">
            <li>As part of normal platform operations (e.g., when you choose to unlock contact details or share your profile); or</li>
            <li>When required by law, subpoena, or court order.</li>
          </ul>

          <h4 className="text-base font-semibold mt-4 mb-2">12.3 Additional Confidentiality Agreements Between Users</h4>
          <p className="mb-3">If Vendors and Field Reps wish to enter a separate confidentiality agreement for specific jobs or relationships:</p>
          <ul className="list-disc pl-6 mb-3 space-y-1">
            <li>That agreement is between those parties only</li>
            <li>It may impose additional or stricter confidentiality obligations than these Terms</li>
            <li>ClearMarket is not a party to that agreement and is not responsible for enforcing or monitoring compliance</li>
          </ul>
          <p className="mb-4">You are responsible for understanding, negotiating, and complying with any confidentiality agreement you sign with another User.</p>

          <h3 className="text-lg font-semibold mt-6 mb-3">13. Prohibited Uses</h3>
          <p className="mb-3">In addition to the other restrictions in these Terms, you agree not to:</p>
          <ul className="list-disc pl-6 mb-3 space-y-1">
            <li>Use ClearMarket to violate any law, regulation, or third-party rights</li>
            <li>Interfere with or damage the platform or its infrastructure</li>
            <li>Introduce malware, bots, or automated scraping or data-harvesting tools</li>
            <li>Attempt to access data you are not authorized to view</li>
            <li>Create fake accounts or misrepresent your identity, qualifications, or affiliations</li>
            <li>Use ClearMarket to solicit or promote illegal activities</li>
          </ul>
          <p className="mb-4">We may investigate and take appropriate action (including account suspension, termination, or contacting law enforcement) if we believe your use violates these provisions.</p>

          <h3 className="text-lg font-semibold mt-6 mb-3">14. Disclaimers</h3>
          <p className="mb-3">ClearMarket is provided on an "as-is" and "as-available" basis.</p>
          <p className="mb-3">To the fullest extent permitted by law, ClearMarket disclaims all warranties, express or implied, including but not limited to:</p>
          <ul className="list-disc pl-6 mb-3 space-y-1">
            <li>Implied warranties of merchantability, fitness for a particular purpose, and non-infringement</li>
            <li>Any warranty that the platform will be uninterrupted, secure, or error-free</li>
            <li>Any warranty regarding the accuracy, completeness, or reliability of analytics, pricing insights, reviews, or content posted by Users</li>
          </ul>
          <p className="mb-3">ClearMarket does not:</p>
          <ul className="list-disc pl-6 mb-3 space-y-1">
            <li>Guarantee that you will find work, find coverage, or reach agreement on any specific rate</li>
            <li>Guarantee the performance, quality, or reliability of any User</li>
            <li>Provide legal, tax, employment, or financial advice</li>
          </ul>
          <p className="mb-4">You are solely responsible for your business decisions, contracts, NDAs, and compliance with all applicable laws.</p>

          <h3 className="text-lg font-semibold mt-6 mb-3">15. Limitation of Liability</h3>
          <p className="mb-3">To the maximum extent permitted by law:</p>
          <ul className="list-disc pl-6 mb-3 space-y-1">
            <li>ClearMarket will not be liable for any indirect, incidental, consequential, special, or punitive damages, including loss of profits, revenue, data, or goodwill, arising out of or related to your use of the platform.</li>
            <li>ClearMarket's total cumulative liability for any claims arising out of or related to these Terms or the platform will not exceed the greater of:
              <ul className="list-disc pl-6 mt-1 space-y-1">
                <li>The amounts you paid to ClearMarket in the three (3) months immediately preceding the claim; or</li>
                <li>One hundred U.S. dollars (USD $100).</li>
              </ul>
            </li>
          </ul>
          <p className="mb-4">Some jurisdictions do not allow certain limitations, so some of the above may not apply to you. In those cases, ClearMarket's liability will be limited to the greatest extent permitted by law.</p>

          <h3 className="text-lg font-semibold mt-6 mb-3">16. Indemnification</h3>
          <p className="mb-3">You agree to indemnify, defend, and hold harmless ClearMarket, its owners, officers, employees, agents, and affiliates from and against any claims, damages, losses, liabilities, costs, and expenses (including reasonable attorneys' fees) arising out of or related to:</p>
          <ul className="list-disc pl-6 mb-4 space-y-1">
            <li>Your use of the platform</li>
            <li>Your violation of these Terms</li>
            <li>Your violation of any law or third-party right</li>
            <li>Any dispute between you and another User (including disputes about work quality, timeliness, payment, pricing, or NDAs)</li>
          </ul>

          <h3 className="text-lg font-semibold mt-6 mb-3">17. Third-Party Services</h3>
          <p className="mb-4">ClearMarket may integrate with or link to third-party services (such as payment processors, communication tools, or other platforms). Your use of those services is subject to the terms and privacy policies of the respective third parties, and we are not responsible for their actions, content, or services.</p>

          <h3 className="text-lg font-semibold mt-6 mb-3">18. Suspension & Termination</h3>
          <p className="mb-3">We may, at our sole discretion, suspend or terminate your access to some or all of the platform if we believe:</p>
          <ul className="list-disc pl-6 mb-3 space-y-1">
            <li>You have violated these Terms or other posted policies</li>
            <li>You have engaged in fraud, abuse, or malicious behavior</li>
            <li>Your use creates risk or harm for other Users or for ClearMarket</li>
          </ul>
          <p className="mb-4">You may stop using ClearMarket at any time. Certain provisions (including but not limited to confidentiality, payment obligations, limitations of liability, indemnification, and dispute sections) will survive termination.</p>

          <h3 className="text-lg font-semibold mt-6 mb-3">19. Changes to the Platform and These Terms</h3>
          <p className="mb-3">We may update or modify ClearMarket's features, pricing, or policies from time to time.</p>
          <p className="mb-3">We may also update these Terms. When we do, we will adjust the "Last Updated" date and may provide additional notice (e.g., via email or in-app notice). Your continued use of ClearMarket after changes become effective constitutes your acceptance of the updated Terms.</p>
          <p className="mb-4">If you do not agree to the updated Terms, you must stop using the platform.</p>

          <h3 className="text-lg font-semibold mt-6 mb-3">20. Governing Law & Dispute Resolution</h3>
          <p className="mb-3">These Terms are governed by the laws of the State of Illinois, USA, without regard to its conflict of laws principles, unless the laws of your jurisdiction require otherwise.</p>
          <p className="mb-4">Any dispute arising out of or relating to these Terms or your use of ClearMarket will be resolved in the state or federal courts located in Illinois, and you consent to the personal jurisdiction of those courts, unless otherwise required by applicable law.</p>

          <h3 className="text-lg font-semibold mt-6 mb-3">21. Contact Information</h3>
          <p className="mb-3">If you have questions about these Terms, the platform, or your account, you can contact us at:</p>
          <p className="mb-4">
            Email: <a href="mailto:hello@useclearmarket.io" className="text-primary hover:underline">hello@useclearmarket.io</a>
          </p>

          <p className="text-sm text-muted-foreground mt-8 border-t border-border pt-4">
            By signing below, you acknowledge that you have read, understood, and agree to these Terms of Service.
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
