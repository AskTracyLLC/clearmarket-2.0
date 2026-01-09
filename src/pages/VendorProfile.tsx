import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { US_STATES } from "@/lib/constants";
import { 
  ArrowLeft, 
  Save, 
  AlertCircle, 
  Plus, 
  Minus, 
  ExternalLink, 
  ShieldCheck,
  Send,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Building2,
  User,
  Calendar,
  Globe,
  Linkedin,
  FileText
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { checklist } from "@/lib/checklistTracking";

// Validation schema for vendor profile
const vendorProfileSchema = z.object({
  // Verification fields
  vendor_public_code_requested: z.string()
    .trim()
    .min(1, "Vendor code is required")
    .max(6, "Max 6 characters")
    .regex(/^[A-Za-z0-9]+$/, "Only letters and numbers allowed")
    .transform(v => v.toUpperCase()),
  business_bio: z.string().trim().max(500, "Max 500 characters").optional().nullable(),
  business_established_year: z.coerce.number().min(1900).max(new Date().getFullYear()).optional().nullable(),
  website_url: z.string().trim().url("Must be a valid URL").optional().or(z.literal("")),
  linkedin_url: z.string().trim().url("Must be a valid URL").optional().or(z.literal("")),
  bbb_url: z.string().trim().url("Must be a valid URL").optional().or(z.literal("")),
  ein_provided: z.boolean().optional(),
  gl_insurance_note: z.string().trim().max(500).optional().nullable(),
  // POC fields
  poc_name: z.string().trim().min(1, "POC name is required").max(100),
  poc_title: z.string().trim().max(100).optional().nullable(),
  poc_email: z.string().trim().email("Valid email required"),
  poc_phone: z.string().trim().max(20).optional().nullable(),
  // Rep-facing company info
  company_name: z.string().trim().min(1, "Company name is required").max(100),
  company_description: z.string().trim().max(1000).optional().nullable(),
  website: z.string().trim().url("Must be a valid URL").optional().or(z.literal("")),
  city: z.string().trim().min(1, "City is required").max(100),
  state: z.string().min(1, "State is required"),
  // Availability
  is_accepting_new_reps: z.boolean(),
});

type VendorProfileForm = z.infer<typeof vendorProfileSchema>;

// Status badge component
function VerificationStatusBadge({ status }: { status: string | null }) {
  const config: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ReactNode }> = {
    draft: { label: "Draft", variant: "outline", icon: <FileText className="h-3 w-3" /> },
    pending: { label: "Pending Review", variant: "secondary", icon: <Clock className="h-3 w-3" /> },
    needs_review: { label: "Needs Review", variant: "outline", icon: <AlertTriangle className="h-3 w-3 text-yellow-500" /> },
    verified: { label: "Verified", variant: "default", icon: <CheckCircle2 className="h-3 w-3" /> },
    rejected: { label: "Rejected", variant: "destructive", icon: <XCircle className="h-3 w-3" /> },
    suspended: { label: "Suspended", variant: "destructive", icon: <XCircle className="h-3 w-3" /> },
  };
  
  const cfg = config[status || "draft"] || config.draft;
  
  return (
    <Badge variant={cfg.variant} className="gap-1">
      {cfg.icon}
      {cfg.label}
    </Badge>
  );
}

const VendorProfile = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState<any>(null);
  const [vendorProfile, setVendorProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [codeAvailable, setCodeAvailable] = useState<boolean | null>(null);
  const [codeCheckMessage, setCodeCheckMessage] = useState<string>("");
  
  const [expandedSections, setExpandedSections] = useState(() => {
    const saved = localStorage.getItem('vendorProfileExpandedSections');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // ignore
      }
    }
    return {
      verification: true,
      poc: true,
      company: true,
      location: true,
    };
  });

  useEffect(() => {
    localStorage.setItem('vendorProfileExpandedSections', JSON.stringify(expandedSections));
  }, [expandedSections]);

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev: typeof expandedSections) => ({ ...prev, [section]: !prev[section] }));
  };

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<VendorProfileForm>({
    resolver: zodResolver(vendorProfileSchema),
    defaultValues: {
      is_accepting_new_reps: true,
      ein_provided: false,
    },
  });

  const watchedCode = watch("vendor_public_code_requested");
  const selectedState = watch("state");
  const verificationStatus = vendorProfile?.vendor_verification_status || "draft";

  // Check code availability when it changes
  useEffect(() => {
    const checkCode = async () => {
      if (!watchedCode || watchedCode.length < 1) {
        setCodeAvailable(null);
        setCodeCheckMessage("");
        return;
      }
      
      try {
        const { data, error } = await supabase.rpc("check_vendor_code_available", {
          p_code: watchedCode,
        });
        
        if (error) throw error;
        
        const result = data as { available?: boolean; reason?: string } | null;
        
        if (result?.available) {
          setCodeAvailable(true);
          setCodeCheckMessage("Code is available!");
        } else {
          setCodeAvailable(false);
          setCodeCheckMessage(result?.reason || "Code is not available");
        }
      } catch (err) {
        console.error("Error checking code:", err);
        setCodeAvailable(null);
        setCodeCheckMessage("");
      }
    };

    const timer = setTimeout(checkCode, 500);
    return () => clearTimeout(timer);
  }, [watchedCode]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/signin");
      return;
    }
    if (user) {
      loadProfile();
    }
  }, [user, authLoading, navigate]);

  const loadProfile = async () => {
    if (!user) return;

    try {
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (profileError) throw profileError;
      setProfile(profileData);

      if (!profileData.is_vendor_admin && !profileData.is_admin) {
        toast({
          title: "Access Denied",
          description: "This page is only accessible to Vendors.",
          variant: "destructive",
        });
        navigate("/dashboard");
        return;
      }

      const { data: vendorData, error: vendorError } = await supabase
        .from("vendor_profile")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (vendorError && vendorError.code !== "PGRST116") throw vendorError;

      if (vendorData) {
        setVendorProfile(vendorData);
        // Populate form
        setValue("vendor_public_code_requested", vendorData.vendor_public_code_requested || vendorData.vendor_public_code || "");
        setValue("business_bio", vendorData.business_bio || "");
        setValue("business_established_year", vendorData.business_established_year || undefined);
        setValue("website_url", vendorData.website_url || "");
        setValue("linkedin_url", vendorData.linkedin_url || "");
        setValue("bbb_url", vendorData.bbb_url || "");
        setValue("ein_provided", vendorData.ein_provided || false);
        setValue("gl_insurance_note", vendorData.gl_insurance_note || "");
        setValue("poc_name", vendorData.poc_name || profileData.full_name || "");
        setValue("poc_title", vendorData.poc_title || "");
        setValue("poc_email", vendorData.poc_email || profileData.email || "");
        setValue("poc_phone", vendorData.poc_phone || "");
        setValue("company_name", vendorData.company_name || "");
        setValue("company_description", vendorData.company_description || "");
        setValue("website", vendorData.website || "");
        setValue("city", vendorData.city || "");
        setValue("state", vendorData.state || "");
        setValue("is_accepting_new_reps", vendorData.is_accepting_new_reps ?? true);
      } else {
        // Create new vendor profile
        const { data: newVendorProfile, error: createError } = await supabase
          .from("vendor_profile")
          .insert({ user_id: user.id, company_name: "" })
          .select()
          .single();

        if (createError) throw createError;
        setVendorProfile(newVendorProfile);
        
        // Pre-fill POC from user profile
        setValue("poc_name", profileData.full_name || "");
        setValue("poc_email", profileData.email || "");
      }
    } catch (error: any) {
      console.error("Error loading profile:", error);
      toast({
        title: "Error",
        description: "Failed to load profile information.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data: VendorProfileForm) => {
    if (!user || !vendorProfile) return;

    setSaving(true);

    try {
      const { error } = await supabase
        .from("vendor_profile")
        .update({
          vendor_public_code_requested: data.vendor_public_code_requested,
          business_bio: data.business_bio || null,
          business_established_year: data.business_established_year || null,
          website_url: data.website_url || null,
          linkedin_url: data.linkedin_url || null,
          bbb_url: data.bbb_url || null,
          ein_provided: data.ein_provided || false,
          gl_insurance_note: data.gl_insurance_note || null,
          poc_name: data.poc_name,
          poc_title: data.poc_title || null,
          poc_email: data.poc_email,
          poc_phone: data.poc_phone || null,
          company_name: data.company_name,
          company_description: data.company_description || null,
          website: data.website || null,
          city: data.city,
          state: data.state,
          is_accepting_new_reps: data.is_accepting_new_reps,
        })
        .eq("id", vendorProfile.id);

      if (error) throw error;

      if (data.company_name && data.city && data.state) {
        checklist.vendorProfileCompleted(user.id);
      }

      toast({
        title: "Saved",
        description: "Your profile has been saved.",
      });
      
      // Reload to get updated data
      loadProfile();
    } catch (error: any) {
      console.error("Error saving profile:", error);
      toast({
        title: "Error",
        description: "Failed to save profile. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitForVerification = async () => {
    if (!user || !vendorProfile) return;
    
    // Validate required fields before submitting
    const formData = watch();
    if (!formData.vendor_public_code_requested || !formData.poc_name || !formData.poc_email || !formData.company_name || !formData.city || !formData.state) {
      toast({
        title: "Missing Required Fields",
        description: "Please complete all required fields before submitting for verification.",
        variant: "destructive",
      });
      return;
    }
    
    if (codeAvailable === false) {
      toast({
        title: "Invalid Code",
        description: "Please choose an available vendor code.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);

    try {
      // First save the current form data
      await handleSubmit(onSubmit)();
      
      // Then call the edge function to submit for verification
      const { data, error } = await supabase.functions.invoke("vendor-verification-submit", {
        body: { vendorProfileId: vendorProfile.id },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: "Submitted for Verification",
        description: "Your verification request has been submitted. Check your messages for updates.",
      });

      // Navigate to the conversation thread
      if (data?.conversationId) {
        navigate(`/messages/${data.conversationId}`);
      } else {
        navigate("/messages");
      }
    } catch (error: any) {
      console.error("Error submitting verification:", error);
      toast({
        title: "Submission Failed",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const isPendingOrReview = verificationStatus === "pending" || verificationStatus === "needs_review";
  const isVerified = verificationStatus === "verified";
  const canSubmit = verificationStatus === "draft" || verificationStatus === "needs_review" || verificationStatus === "rejected";

  return (
    <div className="container mx-auto px-4 py-12 max-w-3xl">
      <div className="mb-6 flex items-center gap-4">
        <Link to="/dashboard">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-4xl font-bold text-foreground mb-2">Vendor Profile</h1>
        <p className="text-muted-foreground">Complete your profile to connect with field reps</p>
      </div>

      {/* Pending/Review Banner */}
      {isPendingOrReview && (
        <Alert className="mb-6 border-blue-500/50 bg-blue-500/10">
          <Clock className="h-4 w-4 text-blue-500" />
          <AlertDescription className="text-foreground">
            <strong>Verification {verificationStatus === "pending" ? "pending" : "needs additional info"}.</strong>
            <br />
            <span className="text-muted-foreground">
              While you wait, you can complete setup below: Work Setup + Coverage & Rates, Office Availability, Pay Schedule.
            </span>
          </AlertDescription>
        </Alert>
      )}

      {/* Verified Banner */}
      {isVerified && vendorProfile?.vendor_public_code && (
        <Card className="p-4 mb-6 bg-green-500/10 border-green-500/30">
          <div className="flex items-center gap-4">
            <ShieldCheck className="h-8 w-8 text-green-500" />
            <div>
              <p className="text-sm text-muted-foreground">Your Verified Vendor Code</p>
              <p className="text-2xl font-bold font-mono">{vendorProfile.vendor_public_code}</p>
            </div>
            <VerificationStatusBadge status={verificationStatus} />
          </div>
        </Card>
      )}

      <form onSubmit={handleSubmit(onSubmit)}>
        <Card className="p-6 bg-card-elevated border border-border space-y-8">
          
          {/* SECTION 1: Vendor Verification (FIRST) */}
          <div className="space-y-4 pb-6 border-b border-border">
            <button
              type="button"
              onClick={() => toggleSection('verification')}
              className="flex items-center justify-between w-full text-left"
            >
              <div className="flex items-center gap-3">
                <ShieldCheck className="h-5 w-5 text-primary" />
                <div>
                  <h3 className="text-xl font-semibold text-foreground">Vendor Verification</h3>
                  <p className="text-sm text-muted-foreground">
                    Lightweight verification helps reduce fakes/scrapers, prevent impersonation, and unlock higher-risk features.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <VerificationStatusBadge status={verificationStatus} />
                {expandedSections.verification ? (
                  <Minus className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <Plus className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
            </button>

            {expandedSections.verification && (
              <div className="space-y-4 pt-4">
                {/* Vendor Code */}
                <div>
                  <Label htmlFor="vendor_public_code_requested">
                    Requested Vendor Code <span className="text-destructive">*</span>
                  </Label>
                  <div className="flex gap-2 items-center">
                    <Input
                      id="vendor_public_code_requested"
                      {...register("vendor_public_code_requested")}
                      placeholder="e.g., MBFS"
                      className={`max-w-[150px] font-mono uppercase ${errors.vendor_public_code_requested ? "border-destructive" : ""}`}
                      maxLength={6}
                      disabled={isVerified}
                    />
                    {codeAvailable === true && (
                      <span className="text-green-500 text-sm flex items-center gap-1">
                        <CheckCircle2 className="h-4 w-4" /> {codeCheckMessage}
                      </span>
                    )}
                    {codeAvailable === false && (
                      <span className="text-destructive text-sm flex items-center gap-1">
                        <XCircle className="h-4 w-4" /> {codeCheckMessage}
                      </span>
                    )}
                  </div>
                  {errors.vendor_public_code_requested && (
                    <p className="text-sm text-destructive mt-1">{errors.vendor_public_code_requested.message}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    1-6 characters, letters and numbers only. This will be your unique identifier (e.g., MBFS_TM for staff).
                  </p>
                </div>

                {/* Business Bio */}
                <div>
                  <Label htmlFor="business_bio">Business Bio</Label>
                  <Textarea
                    id="business_bio"
                    {...register("business_bio")}
                    placeholder="Brief description of your business..."
                    rows={3}
                    maxLength={500}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {(watch("business_bio") || "").length} / 500 characters
                  </p>
                </div>

                {/* Established Year */}
                <div>
                  <Label htmlFor="business_established_year">
                    <Calendar className="h-4 w-4 inline mr-1" />
                    Established Year <span className="text-muted-foreground text-sm">(Optional)</span>
                  </Label>
                  <Input
                    id="business_established_year"
                    type="number"
                    {...register("business_established_year")}
                    placeholder="e.g., 2015"
                    className="max-w-[150px]"
                    min={1900}
                    max={new Date().getFullYear()}
                  />
                </div>

                {/* Website URL */}
                <div>
                  <Label htmlFor="website_url">
                    <Globe className="h-4 w-4 inline mr-1" />
                    Website URL <span className="text-muted-foreground text-sm">(Optional)</span>
                  </Label>
                  <Input
                    id="website_url"
                    {...register("website_url")}
                    placeholder="https://yourcompany.com"
                    type="url"
                  />
                </div>

                {/* LinkedIn URL */}
                <div>
                  <Label htmlFor="linkedin_url">
                    <Linkedin className="h-4 w-4 inline mr-1" />
                    LinkedIn URL <span className="text-muted-foreground text-sm">(Optional)</span>
                  </Label>
                  <Input
                    id="linkedin_url"
                    {...register("linkedin_url")}
                    placeholder="https://linkedin.com/company/..."
                    type="url"
                  />
                </div>

                {/* BBB URL */}
                <div>
                  <Label htmlFor="bbb_url">
                    BBB URL <span className="text-muted-foreground text-sm">(Optional)</span>
                  </Label>
                  <Input
                    id="bbb_url"
                    {...register("bbb_url")}
                    placeholder="https://bbb.org/..."
                    type="url"
                  />
                </div>

                {/* EIN Provided */}
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="ein_provided" className="text-foreground font-normal">
                      EIN Provided
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Check if you have an Employer Identification Number (not stored, just confirmed)
                    </p>
                  </div>
                  <Switch
                    id="ein_provided"
                    checked={watch("ein_provided")}
                    onCheckedChange={(checked) => setValue("ein_provided", checked)}
                  />
                </div>

                {/* GL/COI Note */}
                <div>
                  <Label htmlFor="gl_insurance_note">
                    GL / COI Note <span className="text-muted-foreground text-sm">(Optional)</span>
                  </Label>
                  <Textarea
                    id="gl_insurance_note"
                    {...register("gl_insurance_note")}
                    placeholder="Details about your general liability insurance or certificate of insurance..."
                    rows={2}
                    maxLength={500}
                  />
                </div>

                {/* Submit for Verification Button */}
                {canSubmit && (
                  <div className="pt-4">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={handleSubmitForVerification}
                      disabled={submitting || codeAvailable === false}
                      className="gap-2"
                    >
                      <Send className="h-4 w-4" />
                      {submitting ? "Submitting..." : "Submit for Verification"}
                    </Button>
                    <p className="text-xs text-muted-foreground mt-2">
                      This will save your profile and open a message thread with ClearMarket Admin for review.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* SECTION 2: Point of Contact */}
          <div className="space-y-4 pb-6 border-b border-border">
            <button
              type="button"
              onClick={() => toggleSection('poc')}
              className="flex items-center justify-between w-full text-left"
            >
              <div className="flex items-center gap-3">
                <User className="h-5 w-5 text-muted-foreground" />
                <div>
                  <h3 className="text-xl font-semibold text-foreground">ClearMarket Account Information (Point of Contact)</h3>
                  <p className="text-sm text-muted-foreground">This may differ from your rep-facing company info.</p>
                </div>
              </div>
              {expandedSections.poc ? (
                <Minus className="h-5 w-5 text-muted-foreground" />
              ) : (
                <Plus className="h-5 w-5 text-muted-foreground" />
              )}
            </button>

            {expandedSections.poc && (
              <div className="space-y-4 pt-4">
                <div>
                  <Label htmlFor="poc_name">POC Name <span className="text-destructive">*</span></Label>
                  <Input
                    id="poc_name"
                    {...register("poc_name")}
                    placeholder="Your full name"
                    className={errors.poc_name ? "border-destructive" : ""}
                  />
                  {errors.poc_name && (
                    <p className="text-sm text-destructive mt-1">{errors.poc_name.message}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="poc_title">POC Title <span className="text-muted-foreground text-sm">(Optional)</span></Label>
                  <Input
                    id="poc_title"
                    {...register("poc_title")}
                    placeholder="e.g., Operations Manager"
                  />
                </div>

                <div>
                  <Label htmlFor="poc_email">POC Email <span className="text-destructive">*</span></Label>
                  <Input
                    id="poc_email"
                    type="email"
                    {...register("poc_email")}
                    placeholder="contact@company.com"
                    className={errors.poc_email ? "border-destructive" : ""}
                  />
                  {errors.poc_email && (
                    <p className="text-sm text-destructive mt-1">{errors.poc_email.message}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="poc_phone">POC Phone <span className="text-muted-foreground text-sm">(Optional)</span></Label>
                  <Input
                    id="poc_phone"
                    {...register("poc_phone")}
                    placeholder="(555) 555-5555"
                  />
                </div>
              </div>
            )}
          </div>

          {/* SECTION 3: Rep-Facing Company Info */}
          <div className="space-y-4 pb-6 border-b border-border">
            <button
              type="button"
              onClick={() => toggleSection('company')}
              className="flex items-center justify-between w-full text-left"
            >
              <div className="flex items-center gap-3">
                <Building2 className="h-5 w-5 text-muted-foreground" />
                <h3 className="text-xl font-semibold text-foreground">Company Info (Rep-Facing)</h3>
              </div>
              {expandedSections.company ? (
                <Minus className="h-5 w-5 text-muted-foreground" />
              ) : (
                <Plus className="h-5 w-5 text-muted-foreground" />
              )}
            </button>

            {expandedSections.company && (
              <div className="space-y-4 pt-4">
                <div>
                  <Label htmlFor="company_name">Company Name <span className="text-destructive">*</span></Label>
                  <Input
                    id="company_name"
                    {...register("company_name")}
                    placeholder="Your Company Name"
                    className={errors.company_name ? "border-destructive" : ""}
                  />
                  {errors.company_name && (
                    <p className="text-sm text-destructive mt-1">{errors.company_name.message}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="website">Company Website <span className="text-muted-foreground text-sm">(Optional)</span></Label>
                  <Input
                    id="website"
                    {...register("website")}
                    placeholder="https://yourcompany.com"
                    type="url"
                  />
                </div>

                <div>
                  <Label htmlFor="company_description">Company Description <span className="text-muted-foreground text-sm">(Optional)</span></Label>
                  <Textarea
                    id="company_description"
                    {...register("company_description")}
                    placeholder="Tell reps about your company..."
                    rows={4}
                    maxLength={1000}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {(watch("company_description") || "").length} / 1000 characters
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* SECTION 4: Location */}
          <div className="space-y-4 pb-6 border-b border-border">
            <button
              type="button"
              onClick={() => toggleSection('location')}
              className="flex items-center justify-between w-full text-left"
            >
              <h3 className="text-xl font-semibold text-foreground">Location</h3>
              {expandedSections.location ? (
                <Minus className="h-5 w-5 text-muted-foreground" />
              ) : (
                <Plus className="h-5 w-5 text-muted-foreground" />
              )}
            </button>

            {expandedSections.location && (
              <div className="space-y-4 pt-4">
                <div>
                  <Label htmlFor="city">City <span className="text-destructive">*</span></Label>
                  <Input
                    id="city"
                    {...register("city")}
                    placeholder="Your city"
                    className={errors.city ? "border-destructive" : ""}
                  />
                  {errors.city && (
                    <p className="text-sm text-destructive mt-1">{errors.city.message}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="state">State <span className="text-destructive">*</span></Label>
                  <Select value={selectedState} onValueChange={(value) => setValue("state", value)}>
                    <SelectTrigger className={errors.state ? "border-destructive" : ""}>
                      <SelectValue placeholder="Select a state" />
                    </SelectTrigger>
                    <SelectContent className="bg-background border border-border z-50">
                      {US_STATES.map((state) => (
                        <SelectItem key={state.value} value={state.value}>
                          {state.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.state && (
                    <p className="text-sm text-destructive mt-1">{errors.state.message}</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Link Cards */}
          <div className="space-y-4">
            {/* Work Setup */}
            <div className="p-4 bg-muted/30 rounded-lg border border-border">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-1">Work Setup + Coverage & Rates</h3>
                  <p className="text-sm text-muted-foreground">
                    Manage your systems, inspection types, and coverage areas.
                  </p>
                </div>
                <Link to="/work-setup">
                  <Button variant="outline" size="sm">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Open
                  </Button>
                </Link>
              </div>
            </div>

            {/* Office Availability */}
            <div className="p-4 bg-muted/30 rounded-lg border border-border">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-1">Office Availability</h3>
                  <p className="text-sm text-muted-foreground">
                    Set your office hours and rep recruitment status.
                  </p>
                </div>
                <Link to="/vendor/availability">
                  <Button variant="outline" size="sm">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Open
                  </Button>
                </Link>
              </div>
            </div>

            {/* Pay Schedule (Coming Soon placeholder) */}
            <div className="p-4 bg-muted/30 rounded-lg border border-border opacity-60">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-1 flex items-center gap-2">
                    Pay Schedule
                    <Badge variant="outline" className="text-xs">Coming Soon</Badge>
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Define your payment terms and schedule for field reps.
                  </p>
                </div>
                <Button variant="outline" size="sm" disabled>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Open
                </Button>
              </div>
            </div>
          </div>

          {/* Availability Toggle */}
          <div className="flex items-center justify-between pt-4">
            <div className="space-y-0.5">
              <Label htmlFor="is_accepting_new_reps" className="text-foreground font-normal">
                Accepting New Reps
              </Label>
              <p className="text-sm text-muted-foreground">
                Are you currently looking to add new field representatives?
              </p>
            </div>
            <Switch
              id="is_accepting_new_reps"
              checked={watch("is_accepting_new_reps")}
              onCheckedChange={(checked) => setValue("is_accepting_new_reps", checked)}
            />
          </div>

          {/* Save Button */}
          <div className="flex justify-end pt-4 border-t border-border">
            <Button type="submit" disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </Card>
      </form>
    </div>
  );
};

export default VendorProfile;
