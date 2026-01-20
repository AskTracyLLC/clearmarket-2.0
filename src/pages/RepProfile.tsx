import { useEffect, useState, useRef } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { useMimic } from "@/hooks/useMimic";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { US_STATES, SYSTEMS_LIST } from "@/lib/constants";
import { InspectionTypeMultiSelect } from "@/components/InspectionTypeMultiSelect";
import { ArrowLeft, Save, AlertCircle, MapPin, DollarSign, Edit, Trash2, Upload, ExternalLink, ShieldCheck, Plus, Minus } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { CoverageAreaDialog, CoverageArea, CoverageMode } from "@/components/CoverageAreaDialog";
import { RepCoverageTable } from "@/components/RepCoverageTable";
import { isBackgroundCheckActive, maskBackgroundCheckId } from "@/lib/backgroundCheckUtils";
import { getBackgroundCheckSignedUrl } from "@/lib/storage";
import { ProfileSharePanel } from "@/components/ProfileSharePanel";

import { 
  fetchMyBackgroundCheck, 
  submitBackgroundCheck, 
  getBackgroundCheckStatusInfo,
  BackgroundCheck 
} from "@/lib/backgroundChecks";
import { checklist } from "@/lib/checklistTracking";

// Validation schema for rep profile (MVP)
const repProfileSchema = z.object({
  city: z.string().trim().min(1, "City is required").max(100, "City must be less than 100 characters"),
  state: z.string().min(1, "State is required"),
  zip_code: z.string().trim().min(5, "ZIP code must be at least 5 characters").max(10, "ZIP code must be less than 10 characters"),
  bio: z.string().trim().max(500, "Bio must be less than 500 characters").optional().nullable(),
  // MVP PLACEHOLDER: These arrays will be migrated to normalized tables in Phase 2
  systems_used: z.array(z.string()).min(1, "Please select at least one system"),
  systems_used_other: z.string().trim().max(100).optional().nullable(),
  open_to_new_systems: z.boolean(),
  inspection_types: z.array(z.string()).min(1, "Please select at least one inspection type"),
  inspection_types_other: z.string().trim().max(100).optional().nullable(),
  is_accepting_new_vendors: z.boolean(),
  willing_to_travel_out_of_state: z.boolean(),
  // Time Off / Availability fields
  unavailable_from: z.string().optional().nullable(),
  unavailable_to: z.string().optional().nullable(),
  unavailable_note: z.string().trim().max(200).optional().nullable(),
  // Background Check fields
  background_check_is_active: z.boolean(),
  background_check_provider: z.enum(["aspen_grove", "other"]).nullable(),
  background_check_provider_other_name: z.string().trim().max(100).optional().nullable(),
  background_check_id: z.string().trim().max(100).optional().nullable(),
  background_check_expires_on: z.string().optional().nullable(),
  background_check_screenshot_url: z.string().optional().nullable(),
  willing_to_obtain_background_check: z.boolean().optional().nullable(),
  // Access & Equipment fields
  has_hud_keys: z.boolean().optional().nullable(),
  hud_keys_details: z.string().trim().max(200).optional().nullable(),
  equipment_notes: z.string().trim().max(500).optional().nullable(),
}).refine((data) => {
  // HUD keys validation: if has_hud_keys is true, require details
  if (data.has_hud_keys && !data.hud_keys_details?.trim()) {
    return false;
  }
  return true;
}, {
  message: "Please specify which HUD keys you have",
  path: ["hud_keys_details"],
}).refine((data) => {
  if (!data.background_check_is_active) return true;
  
  // If active, require provider
  if (!data.background_check_provider) return false;
  
  // If active, require screenshot
  if (!data.background_check_screenshot_url) return false;
  
  // Provider-specific validations
  if (data.background_check_provider === "aspen_grove") {
    // AspenGrove requires ID
    if (!data.background_check_id) return false;
  }
  
  if (data.background_check_provider === "other") {
    // Other requires provider name and expiration
    if (!data.background_check_provider_other_name) return false;
    if (!data.background_check_expires_on) return false;
  }
  
  return true;
}, {
  message: "Please complete all required background check fields",
  path: ["background_check_is_active"],
}).refine((data) => {
  // Time-off date validation: if both dates set, to must be >= from
  if (data.unavailable_from && data.unavailable_to) {
    const from = new Date(data.unavailable_from);
    const to = new Date(data.unavailable_to);
    if (to < from) {
      return false;
    }
  }
  return true;
}, {
  message: "End date can't be before start date",
  path: ["unavailable_to"],
});

type RepProfileForm = z.infer<typeof repProfileSchema>;

const RepProfile = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const focusCoverage = searchParams.get("focus") === "coverage";
  const coverageSectionRef = useRef<HTMLDivElement>(null);
  const hasScrolledToCoverage = useRef(false);
  
  const { user, loading: authLoading } = useAuth();
  const { effectiveUserId } = useMimic();
  const { toast } = useToast();
  const [profile, setProfile] = useState<any>(null);
  const [repProfile, setRepProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [coverageAreas, setCoverageAreas] = useState<any[]>([]);
  const [coverageDialogOpen, setCoverageDialogOpen] = useState(false);
  const [editingCoverage, setEditingCoverage] = useState<any>(null);
  const [uploadingScreenshot, setUploadingScreenshot] = useState(false);
  const [backgroundCheckRecord, setBackgroundCheckRecord] = useState<BackgroundCheck | null>(null);
  const [submittingBackgroundCheck, setSubmittingBackgroundCheck] = useState(false);
  
  // Section collapse states - load from localStorage unless focus=coverage
  const [expandedSections, setExpandedSections] = useState(() => {
    // If focus=coverage, collapse all except coverage
    if (focusCoverage) {
      return {
        account: false,
        basic: false,
        systems: false,
        inspectionTypes: false,
        availability: false,
        backgroundCheck: false,
        accessEquipment: false,
        coverage: true,
      };
    }
    // Otherwise load from localStorage
    const saved = localStorage.getItem('repProfileExpandedSections');
    if (saved) {
      return JSON.parse(saved);
    }
    return {
      account: true,
      basic: true,
      systems: true,
      inspectionTypes: true,
      availability: true,
      backgroundCheck: true,
      accessEquipment: true,
      coverage: true,
    };
  });

  // Scroll to coverage section after page loads if focus=coverage
  useEffect(() => {
    if (focusCoverage && !loading && !hasScrolledToCoverage.current && coverageSectionRef.current) {
      hasScrolledToCoverage.current = true;
      // Small delay to ensure DOM is rendered
      setTimeout(() => {
        coverageSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    }
  }, [focusCoverage, loading]);

  // Save expanded sections to localStorage whenever they change (but not if focus=coverage)
  useEffect(() => {
    if (!focusCoverage) {
      localStorage.setItem('repProfileExpandedSections', JSON.stringify(expandedSections));
    }
  }, [expandedSections, focusCoverage]);

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<RepProfileForm>({
    resolver: zodResolver(repProfileSchema),
    defaultValues: {
      systems_used: [],
      open_to_new_systems: false,
      inspection_types: [],
      is_accepting_new_vendors: true,
      willing_to_travel_out_of_state: false,
      unavailable_from: null,
      unavailable_to: null,
      unavailable_note: null,
      background_check_is_active: false,
      background_check_provider: null,
      background_check_provider_other_name: null,
      background_check_id: null,
      background_check_expires_on: null,
      background_check_screenshot_url: null,
      has_hud_keys: null,
      hud_keys_details: null,
      equipment_notes: null,
    },
  });

  const selectedState = watch("state");
  const systemsUsed = watch("systems_used") || [];
  const inspectionTypes = watch("inspection_types") || [];
  const bioText = watch("bio") || "";
  const backgroundCheckActive = watch("background_check_is_active");
  const backgroundCheckProvider = watch("background_check_provider");
  const backgroundCheckScreenshot = watch("background_check_screenshot_url");
  const hasHudKeys = watch("has_hud_keys");
  const equipmentNotes = watch("equipment_notes") || "";

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/signin");
      return;
    }

    if (effectiveUserId) {
      loadProfile();
    }
  }, [effectiveUserId, authLoading, navigate]);

  const loadProfile = async () => {
    if (!effectiveUserId) return;

    try {
      // Load user profile using effectiveUserId (supports mimic mode)
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", effectiveUserId)
        .single();

      if (profileError) throw profileError;

      setProfile(profileData);

      // Check if user is a field rep or admin
      if (!profileData.is_fieldrep && !profileData.is_admin) {
        toast({
          title: "Access Denied",
          description: "This page is only accessible to Field Representatives.",
          variant: "destructive",
        });
        navigate("/dashboard");
        return;
      }

      // Load or create rep profile
      const { data: repData, error: repError } = await supabase
        .from("rep_profile")
        .select("*")
        .eq("user_id", effectiveUserId)
        .maybeSingle();

      if (repError && repError.code !== "PGRST116") throw repError;

      if (repData) {
        setRepProfile(repData);
        // Populate form with existing data
        setValue("city", repData.city || "");
        setValue("state", repData.state || "");
        setValue("zip_code", repData.zip_code || "");
        setValue("bio", repData.bio || "");
        
        // MVP fields - parse "Other: X" format back into checkbox + text field
        const systemsArray = repData.systems_used || [];
        const systemsForCheckboxes: string[] = [];
        let systemsOtherText = "";
        
        systemsArray.forEach((system: string) => {
          if (system.startsWith("Other: ")) {
            systemsForCheckboxes.push("Other");
            systemsOtherText = system.substring(7); // Remove "Other: " prefix
          } else {
            systemsForCheckboxes.push(system);
          }
        });
        
        const inspectionTypesArray = repData.inspection_types || [];
        const inspectionTypesForCheckboxes: string[] = [];
        let inspectionTypesOtherText = "";
        
        inspectionTypesArray.forEach((type: string) => {
          if (type.startsWith("Other: ")) {
            inspectionTypesForCheckboxes.push("Other");
            inspectionTypesOtherText = type.substring(7); // Remove "Other: " prefix
          } else {
            inspectionTypesForCheckboxes.push(type);
          }
        });
        
        setValue("systems_used", systemsForCheckboxes);
        setValue("systems_used_other", systemsOtherText);
        setValue("open_to_new_systems", repData.open_to_new_systems ?? false);
        setValue("inspection_types", inspectionTypesForCheckboxes);
        setValue("inspection_types_other", inspectionTypesOtherText);
        setValue("is_accepting_new_vendors", repData.is_accepting_new_vendors ?? true);
        setValue("willing_to_travel_out_of_state", repData.willing_to_travel_out_of_state ?? false);
        
        // Time-off fields
        setValue("unavailable_from", repData.unavailable_from || null);
        setValue("unavailable_to", repData.unavailable_to || null);
        setValue("unavailable_note", repData.unavailable_note || null);
        
        // Background check fields
        setValue("background_check_is_active", repData.background_check_is_active ?? false);
        setValue("background_check_provider", (repData.background_check_provider as "aspen_grove" | "other") || null);
        setValue("background_check_provider_other_name", repData.background_check_provider_other_name || null);
        setValue("background_check_id", repData.background_check_id || null);
        setValue("background_check_expires_on", repData.background_check_expires_on || null);
        setValue("background_check_screenshot_url", repData.background_check_screenshot_url || null);
        
        // Access & Equipment fields
        setValue("has_hud_keys", repData.has_hud_keys ?? null);
        setValue("hud_keys_details", repData.hud_keys_details || null);
        setValue("equipment_notes", repData.equipment_notes || null);
      } else {
        // Create new rep profile
        const { data: newRepProfile, error: createError } = await supabase
          .from("rep_profile")
          .insert({ user_id: effectiveUserId })
          .select()
          .single();

        if (createError) throw createError;
        setRepProfile(newRepProfile);
      }

      // Load coverage areas
      await loadCoverageAreas();
      
      // Load background check record from new table
      const bgCheck = await fetchMyBackgroundCheck(effectiveUserId);
      setBackgroundCheckRecord(bgCheck);
      
      // Pre-fill form from background_checks table if exists
      if (bgCheck) {
        setValue("background_check_is_active", true);
        setValue("background_check_provider", bgCheck.provider === "aspen_grove" ? "aspen_grove" : "other");
        if (bgCheck.provider !== "aspen_grove") {
          setValue("background_check_provider_other_name", bgCheck.provider);
        }
        setValue("background_check_id", bgCheck.check_id);
        setValue("background_check_expires_on", bgCheck.expiration_date);
        setValue("background_check_screenshot_url", bgCheck.screenshot_url);
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

  // Load coverage areas for this rep
  const loadCoverageAreas = async () => {
    if (!effectiveUserId) return;
    const { data, error } = await supabase
      .from("rep_coverage_areas")
      .select("*")
      .eq("user_id", effectiveUserId)
      .order("state_code", { ascending: true });

    if (error) {
      console.error("Error loading coverage areas:", error);
    } else {
      setCoverageAreas(data || []);
    }
  };

  const onSubmit = async (data: RepProfileForm) => {
    setSaving(true);

    // Prepare systems_used array
    let systemsUsed = data.systems_used.filter(s => s !== "Other");
    if (data.systems_used.includes("Other") && data.systems_used_other) {
      systemsUsed.push(`Other: ${data.systems_used_other}`);
    }

    // Prepare inspection_types array
    let inspectionTypes = data.inspection_types.filter(t => t !== "Other");
    if (data.inspection_types.includes("Other") && data.inspection_types_other) {
      inspectionTypes.push(`Other: ${data.inspection_types_other}`);
    }

    const updateData = {
      city: data.city,
      state: data.state,
      zip_code: data.zip_code,
      bio: data.bio || null,
      systems_used: systemsUsed,
      open_to_new_systems: data.open_to_new_systems,
      inspection_types: inspectionTypes,
      is_accepting_new_vendors: data.is_accepting_new_vendors,
      willing_to_travel_out_of_state: data.willing_to_travel_out_of_state,
      unavailable_from: data.unavailable_from || null,
      unavailable_to: data.unavailable_to || null,
      unavailable_note: data.unavailable_note || null,
      willing_to_obtain_background_check: data.willing_to_obtain_background_check ?? false,
      has_hud_keys: data.has_hud_keys ?? null,
      hud_keys_details: data.has_hud_keys ? (data.hud_keys_details || null) : null,
      equipment_notes: data.equipment_notes || null,
    };

    const { error } = await supabase
      .from("rep_profile")
      .update(updateData)
      .eq("user_id", effectiveUserId!);

    if (error) {
      console.error("Error updating profile:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to save profile. Please try again.",
      });
      setSaving(false);
      return;
    }

    // Note: Background check is submitted separately via "Send for Verification" button

    // Track profile completion for checklist
    if (effectiveUserId && data.city && data.state && data.zip_code && data.inspection_types.length > 0) {
      checklist.profileCompleted(effectiveUserId);
    }

    toast({
      title: "Profile Updated",
      description: "Your profile has been saved successfully.",
    });
    
    // Stay on profile page after save
    await loadProfile();
    setSaving(false);
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-2">Field Rep Profile</h1>
          <p className="text-muted-foreground">
            Complete your profile to appear in vendor searches
          </p>
        </div>

        {/* Share Profile Panel */}
        <div className="mb-6">
          <ProfileSharePanel roleType="rep" />
        </div>

        {/* Profile completion warning */}
        {(!watch("city") || !watch("state") || !watch("zip_code") || systemsUsed.length === 0 || inspectionTypes.length === 0) && (
          <Alert className="mb-6 border-secondary/50 bg-secondary/10">
            <AlertCircle className="h-4 w-4 text-secondary" />
            <AlertDescription className="text-foreground">
              To appear in future searches, please complete your location and select at least one Inspection Type and System Used.
            </AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit(onSubmit)}>
          <Card className="p-6 bg-card-elevated border border-border space-y-8">
            {/* Section: Account Information (Read-only) */}
            <div className="space-y-4 pb-6 border-b border-border">
              <button
                type="button"
                onClick={() => toggleSection('account')}
                className="w-full flex items-center justify-between hover:opacity-70 transition-opacity"
              >
                <h3 className="text-xl font-semibold text-foreground">Account Information</h3>
                {expandedSections.account ? (
                  <Minus className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <Plus className="h-5 w-5 text-muted-foreground" />
                )}
              </button>
              
              {expandedSections.account && (
                <>
                  <div>
                    <Label className="text-muted-foreground">Full Name</Label>
                <Input
                  value={profile?.full_name || ""}
                  disabled
                  className="bg-muted/50 cursor-not-allowed"
                />
              </div>

                  <div>
                    <Label className="text-muted-foreground">Email</Label>
                    <Input
                      value={profile?.email || ""}
                      disabled
                      className="bg-muted/50 cursor-not-allowed"
                    />
                  </div>
                </>
              )}
            </div>

            {/* Section A: Basic Info */}
            <div className="space-y-4 pb-6 border-b border-border">
              <button
                type="button"
                onClick={() => toggleSection('basic')}
                className="w-full flex items-center justify-between hover:opacity-70 transition-opacity"
              >
                <h3 className="text-xl font-semibold text-foreground">Basic Info</h3>
                {expandedSections.basic ? (
                  <Minus className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <Plus className="h-5 w-5 text-muted-foreground" />
                )}
              </button>

              {expandedSections.basic && (
                <>
                  <div>
                    <Label htmlFor="city">
                      City <span className="text-destructive">*</span>
                    </Label>
                <Input
                  id="city"
                  {...register("city")}
                  placeholder="Enter your city"
                  className={errors.city ? "border-destructive" : ""}
                />
                {errors.city && (
                  <p className="text-sm text-destructive mt-1">{errors.city.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="state">
                  State <span className="text-destructive">*</span>
                </Label>
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

              <div>
                <Label htmlFor="zip_code">
                  ZIP Code <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="zip_code"
                  {...register("zip_code")}
                  placeholder="Enter your ZIP code"
                  className={errors.zip_code ? "border-destructive" : ""}
                  maxLength={10}
                />
                {errors.zip_code && (
                  <p className="text-sm text-destructive mt-1">{errors.zip_code.message}</p>
                )}
              </div>

                  <div>
                    <Label htmlFor="bio">Short Bio <span className="text-muted-foreground text-sm">(Optional)</span></Label>
                    <Textarea
                      id="bio"
                      {...register("bio")}
                      placeholder="Tell vendors a bit about yourself and your experience..."
                      className={errors.bio ? "border-destructive" : ""}
                      rows={4}
                      maxLength={500}
                    />
                    {errors.bio && (
                      <p className="text-sm text-destructive mt-1">{errors.bio.message}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {bioText.length} / 500 characters
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* Link to Work Setup page for Systems, Inspection Types, Coverage */}
            <div className="p-4 bg-muted/30 rounded-lg border border-border">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-1">Work Setup + Coverage & Rates</h3>
                  <p className="text-sm text-muted-foreground">
                    Manage your systems, inspection types, and coverage areas on the dedicated Work Setup page.
                  </p>
                </div>
                <Link to="/work-setup">
                  <Button variant="outline" size="sm">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Open Work Setup
                  </Button>
                </Link>
              </div>
            </div>

        {/* Section D: Availability & Preferences */}
        <div className="space-y-4 pb-6 border-b border-border">
          <button
            type="button"
            onClick={() => toggleSection('availability')}
            className="w-full flex items-center justify-between hover:opacity-70 transition-opacity"
          >
            <div>
              <h3 className="text-xl font-semibold text-foreground mb-1">Availability & Preferences</h3>
              <p className="text-sm text-muted-foreground text-left">Help vendors understand your availability</p>
            </div>
            {expandedSections.availability ? (
              <Minus className="h-5 w-5 text-muted-foreground flex-shrink-0" />
            ) : (
              <Plus className="h-5 w-5 text-muted-foreground flex-shrink-0" />
            )}
          </button>

          {expandedSections.availability && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="is_accepting_new_vendors" className="text-foreground font-normal">
                    Accepting New Vendors
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Are you currently open to new vendor relationships?
                  </p>
                </div>
                <Switch
                  id="is_accepting_new_vendors"
                  checked={watch("is_accepting_new_vendors")}
                  onCheckedChange={(checked) => setValue("is_accepting_new_vendors", checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="willing_to_travel_out_of_state" className="text-foreground font-normal">
                    Willing to Travel Out of State
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Are you willing to travel outside your home state for work?
                  </p>
                </div>
                <Switch
                  id="willing_to_travel_out_of_state"
                  checked={watch("willing_to_travel_out_of_state")}
                  onCheckedChange={(checked) => setValue("willing_to_travel_out_of_state", checked)}
                />
              </div>

              {/* Time Off / Availability */}
              <Separator />
              <div className="space-y-4">
                <div>
                  <Label className="text-foreground font-medium text-base">Planned Time Off (optional)</Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    Let vendors know when you're temporarily unavailable
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="unavailable_from">Unavailable From</Label>
                    <Input
                      id="unavailable_from"
                      type="date"
                      {...register("unavailable_from")}
                      className="mt-2"
                    />
                  </div>

                  <div>
                    <Label htmlFor="unavailable_to">Unavailable To</Label>
                    <Input
                      id="unavailable_to"
                      type="date"
                      {...register("unavailable_to")}
                      className="mt-2"
                    />
                    {errors.unavailable_to && (
                      <p className="text-sm text-destructive mt-1">{errors.unavailable_to.message}</p>
                    )}
                  </div>
                </div>

                <div>
                  <Label htmlFor="unavailable_note">Note (optional)</Label>
                  <Textarea
                    id="unavailable_note"
                    {...register("unavailable_note")}
                    placeholder="e.g., On vacation, limited response"
                    className="mt-2 resize-none"
                    rows={2}
                    maxLength={200}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {watch("unavailable_note")?.length || 0} / 200 characters
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Section D2: Background Check (Optional) */}
        <div className="space-y-4 pb-6 border-b border-border">
          <button
            type="button"
                onClick={() => toggleSection('backgroundCheck')}
                className="w-full flex items-center justify-between hover:opacity-70 transition-opacity"
              >
                <div>
                  <h3 className="text-xl font-semibold text-foreground mb-1 flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5" />
                    Background Check (Optional but Recommended)
                  </h3>
                  <p className="text-sm text-muted-foreground text-left">
                    Some vendors require a background check to work with them. You can still use ClearMarket without one, 
                    but you may be excluded from those opportunities.
                  </p>
                </div>
                {expandedSections.backgroundCheck ? (
                  <Minus className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                ) : (
                  <Plus className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                )}
              </button>

          {expandedSections.backgroundCheck && (
            <>
              {/* Status indicator section */}
              <div className="mb-4 p-4 rounded-lg border border-border bg-muted/30">
                {(() => {
                  // Determine status and messaging
                  const isExpired = backgroundCheckRecord?.status === "approved" && backgroundCheckRecord?.expiration_date && 
                    new Date(backgroundCheckRecord.expiration_date) < new Date(new Date().toDateString());
                  
                  if (!backgroundCheckRecord) {
                    // No submission yet
                    return (
                      <div>
                        <p className="text-sm font-medium text-foreground">Status: Not sent for verification yet.</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          When you finish this section, click "Send for Verification" so we can review your background check.
                        </p>
                      </div>
                    );
                  }
                  
                  if (isExpired) {
                    // Expired
                    return (
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="warning">Expired</Badge>
                          <span className="text-sm font-medium text-foreground">Status: Expired.</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Update your expiration date and upload a current screenshot, then send it for verification again.
                        </p>
                      </div>
                    );
                  }
                  
                  switch (backgroundCheckRecord.status) {
                    case "pending":
                      return (
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="secondary">Under review</Badge>
                            <span className="text-sm font-medium text-foreground">Status: Under review.</span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            We'll verify your background check details before marking it as Approved and sharing this status with your network.
                          </p>
                        </div>
                      );
                    case "approved":
                      return (
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="success">Approved</Badge>
                            <span className="text-sm font-medium text-foreground">Status: Approved.</span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Your background check has been verified and is shared as Approved with your network.
                          </p>
                        </div>
                      );
                    case "rejected":
                      return (
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="destructive">Needs new screenshot</Badge>
                            <span className="text-sm font-medium text-foreground">Status: Needs a new screenshot.</span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            We couldn't verify the screenshot you sent. Please upload a clearer screenshot and send it for verification again.
                          </p>
                          {backgroundCheckRecord.review_notes && (
                            <div className="mt-3 p-3 bg-destructive/10 rounded-md border border-destructive/20">
                              <p className="text-xs font-medium text-destructive">Reviewer notes:</p>
                              <p className="text-xs text-foreground mt-1">{backgroundCheckRecord.review_notes}</p>
                            </div>
                          )}
                        </div>
                      );
                    default:
                      return null;
                  }
                })()}
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="background_check_is_active" className="text-foreground font-normal">
                    I have an active background check
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    {!backgroundCheckActive 
                      ? "Some Seeking Coverage posts may require a background check. Adding yours here can unlock more opportunities."
                      : "Fill in the details below to complete your background check profile."
                    }
                  </p>
                </div>
                <Switch
                  id="background_check_is_active"
                  checked={backgroundCheckActive}
                  onCheckedChange={(checked) => setValue("background_check_is_active", checked)}
                />
              </div>

              {backgroundCheckActive && (
                <div className="space-y-4 p-4 bg-muted/30 rounded-lg">
                  {/* Provider Selection */}
                  <div>
                    <Label htmlFor="background_check_provider">
                      Background Check Provider <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      value={backgroundCheckProvider || ""}
                      onValueChange={(value) => setValue("background_check_provider", value as "aspen_grove" | "other")}
                    >
                      <SelectTrigger className="mt-2">
                        <SelectValue placeholder="Select provider" />
                      </SelectTrigger>
                      <SelectContent className="bg-background border border-border z-50">
                        <SelectItem value="aspen_grove">AspenGrove (ABC# / Shield ID)</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    {errors.background_check_provider && (
                      <p className="text-sm text-destructive mt-1">{errors.background_check_provider.message}</p>
                    )}
                  </div>

                  {/* AspenGrove fields */}
                  {backgroundCheckProvider === "aspen_grove" && (
                    <>
                      <div>
                        <Label htmlFor="background_check_id">
                          AspenGrove / Shield ID (ABC#) <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="background_check_id"
                          {...register("background_check_id")}
                          placeholder="e.g., ABC12345"
                          className="mt-2"
                        />
                        {errors.background_check_id && (
                          <p className="text-sm text-destructive mt-1">{errors.background_check_id.message}</p>
                        )}
                      </div>

                      <div>
                        <Label htmlFor="background_check_expires_on">
                          Expiration Date <span className="text-muted-foreground">(optional)</span>
                        </Label>
                        <Input
                          id="background_check_expires_on"
                          type="date"
                          {...register("background_check_expires_on")}
                          className="mt-2"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          If provided and in the past, your check will be marked as expired.
                        </p>
                      </div>
                    </>
                  )}

                  {/* Other provider fields */}
                  {backgroundCheckProvider === "other" && (
                    <>
                      <div>
                        <Label htmlFor="background_check_provider_other_name">
                          Provider Name <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="background_check_provider_other_name"
                          {...register("background_check_provider_other_name")}
                          placeholder="e.g., GoodHire, Checkr"
                          className="mt-2"
                        />
                        {errors.background_check_provider_other_name && (
                          <p className="text-sm text-destructive mt-1">{errors.background_check_provider_other_name.message}</p>
                        )}
                      </div>

                      <div>
                        <Label htmlFor="background_check_id">
                          Check ID / Reference Number <span className="text-muted-foreground">(optional)</span>
                        </Label>
                        <Input
                          id="background_check_id"
                          {...register("background_check_id")}
                          placeholder="Enter ID if available"
                          className="mt-2"
                        />
                      </div>

                      <div>
                        <Label htmlFor="background_check_expires_on">
                          Expiration Date <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="background_check_expires_on"
                          type="date"
                          {...register("background_check_expires_on")}
                          className="mt-2"
                        />
                        {errors.background_check_expires_on && (
                          <p className="text-sm text-destructive mt-1">{errors.background_check_expires_on.message}</p>
                        )}
                      </div>
                    </>
                  )}

                  {/* Screenshot Upload */}
                  <div>
                    <Label>
                      Proof Screenshot <span className="text-destructive">*</span>
                    </Label>
                    <p className="text-sm text-muted-foreground mb-2">
                      Upload a screenshot of your background check status page showing verification.
                    </p>
                    
                    {backgroundCheckScreenshot ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 p-3 bg-muted rounded-lg border border-border">
                          <ShieldCheck className="h-5 w-5 text-primary" />
                          <span className="text-sm text-foreground flex-1">Screenshot uploaded</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={async () => {
                              // Get signed URL and open in new tab
                              const signedUrl = await getBackgroundCheckSignedUrl(backgroundCheckScreenshot);
                              if (signedUrl) {
                                window.open(signedUrl, '_blank');
                              } else {
                                toast({
                                  variant: "destructive",
                                  title: "Error",
                                  description: "Could not load screenshot preview.",
                                });
                              }
                            }}
                          >
                            View
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setValue("background_check_screenshot_url", null)}
                          >
                            Remove
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Input
                          type="file"
                          accept="image/*"
                          disabled={uploadingScreenshot}
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file || !user) return;

                            setUploadingScreenshot(true);
                            try {
                              // Upload to private bucket
                              const filePath = `${effectiveUserId}/${Date.now()}_${file.name}`;
                              const { error: uploadError } = await supabase.storage
                                .from("background-checks")
                                .upload(filePath, file);

                              if (uploadError) throw uploadError;

                              setValue("background_check_screenshot_url", filePath);
                              toast({
                                title: "Screenshot Uploaded",
                                description: "Your background check screenshot has been uploaded.",
                              });
                            } catch (error) {
                              console.error("Upload error:", error);
                              toast({
                                variant: "destructive",
                                title: "Upload Failed",
                                description: "Failed to upload screenshot. Please try again.",
                              });
                            } finally {
                              setUploadingScreenshot(false);
                            }
                          }}
                          className="flex-1"
                        />
                        {uploadingScreenshot && (
                          <span className="text-sm text-muted-foreground">Uploading...</span>
                        )}
                      </div>
                    )}
                    {errors.background_check_screenshot_url && (
                      <p className="text-sm text-destructive mt-1">{errors.background_check_screenshot_url.message}</p>
                    )}
                  </div>

                  {/* Send for Verification button */}
                  <div className="pt-4 border-t border-border">
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={submittingBackgroundCheck || !backgroundCheckProvider || !backgroundCheckScreenshot}
                      onClick={async () => {
                        // Validate required fields
                        if (!backgroundCheckProvider) {
                          toast({ variant: "destructive", title: "Missing provider", description: "Please select a background check provider." });
                          return;
                        }
                        if (!backgroundCheckScreenshot) {
                          toast({ variant: "destructive", title: "Missing screenshot", description: "Please upload a screenshot of your background check." });
                          return;
                        }
                        if (backgroundCheckProvider === "aspen_grove" && !watch("background_check_id")) {
                          toast({ variant: "destructive", title: "Missing ID", description: "Please enter your AspenGrove ID." });
                          return;
                        }
                        if (backgroundCheckProvider === "other" && !watch("background_check_provider_other_name")) {
                          toast({ variant: "destructive", title: "Missing provider name", description: "Please enter the provider name." });
                          return;
                        }
                        if (backgroundCheckProvider === "other" && !watch("background_check_expires_on")) {
                          toast({ variant: "destructive", title: "Missing expiration", description: "Please enter the expiration date." });
                          return;
                        }

                        setSubmittingBackgroundCheck(true);
                        try {
                          const providerName = backgroundCheckProvider === "aspen_grove" 
                            ? "aspen_grove" 
                            : watch("background_check_provider_other_name") || "other";
                          
                          await submitBackgroundCheck(
                            effectiveUserId!,
                            providerName,
                            watch("background_check_id") || "",
                            backgroundCheckScreenshot,
                            watch("background_check_expires_on") || null
                          );

                          // Reload background check record
                          const bgCheck = await fetchMyBackgroundCheck(effectiveUserId!);
                          setBackgroundCheckRecord(bgCheck);

                          toast({
                            title: "Background Check Sent",
                            description: "Your background check has been sent for verification. Status is now Under review.",
                          });
                        } catch (error) {
                          console.error("Error submitting background check:", error);
                          toast({
                            variant: "destructive",
                            title: "Error",
                            description: "Failed to submit background check. Please try again.",
                          });
                        } finally {
                          setSubmittingBackgroundCheck(false);
                        }
                      }}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      {submittingBackgroundCheck ? "Sending..." : "Send for Verification"}
                    </Button>
                    <p className="text-xs text-muted-foreground mt-2">
                      Clicking this button sends your background check details for review. You can update details and resubmit if needed.
                    </p>
                  </div>
                </div>
              )}

              {/* Willingness fallback */}
              {!backgroundCheckActive && (
                <div className="flex items-center space-x-3 pt-2">
                  <Checkbox
                    id="willing_to_obtain_background_check"
                    checked={watch("willing_to_obtain_background_check") ?? false}
                    onCheckedChange={(checked) => setValue("willing_to_obtain_background_check", !!checked)}
                  />
                  <div>
                    <Label htmlFor="willing_to_obtain_background_check" className="text-foreground font-normal cursor-pointer">
                      I'm willing to obtain a background check if required
                    </Label>
                    <p className="text-xs text-muted-foreground mt-1">
                      Some Seeking Coverage posts allow reps who are willing to get a background check, even if they don't have one yet.
                    </p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Section E: Access & Equipment */}
        <div className="space-y-4 pb-6 border-b border-border">
          <button
            type="button"
            onClick={() => toggleSection('accessEquipment')}
            className="w-full flex items-center justify-between hover:opacity-70 transition-opacity"
          >
            <div>
              <h3 className="text-xl font-semibold text-foreground mb-1">Access & Equipment</h3>
              <p className="text-sm text-muted-foreground text-left">Share details about your access capabilities and equipment</p>
            </div>
            {expandedSections.accessEquipment ? (
              <Minus className="h-5 w-5 text-muted-foreground flex-shrink-0" />
            ) : (
              <Plus className="h-5 w-5 text-muted-foreground flex-shrink-0" />
            )}
          </button>

          {expandedSections.accessEquipment && (
            <>
              {/* HUD Keys Toggle */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="has_hud_keys" className="text-foreground font-normal">
                    Do you have HUD keys?
                  </Label>
                </div>
                <Switch
                  id="has_hud_keys"
                  checked={hasHudKeys ?? false}
                  onCheckedChange={(checked) => {
                    setValue("has_hud_keys", checked);
                    if (!checked) {
                      setValue("hud_keys_details", null);
                    }
                  }}
                />
              </div>

              {/* HUD Keys Details (conditional) */}
              {hasHudKeys && (
                <div>
                  <Label htmlFor="hud_keys_details">
                    Which HUD keys do you have? <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="hud_keys_details"
                    {...register("hud_keys_details")}
                    placeholder="e.g. List number on the Key"
                    className={`mt-2 ${errors.hud_keys_details ? "border-destructive" : ""}`}
                    maxLength={200}
                  />
                  {errors.hud_keys_details && (
                    <p className="text-sm text-destructive mt-1">{errors.hud_keys_details.message}</p>
                  )}
                </div>
              )}

              {/* Other Equipment (optional) */}
              <div>
                <Label htmlFor="equipment_notes">
                  Other tools / equipment <span className="text-muted-foreground text-sm">(optional)</span>
                </Label>
                <Textarea
                  id="equipment_notes"
                  {...register("equipment_notes")}
                  placeholder="List any ladders, safety gear, seasonal tools, or other equipment you want vendors to know about..."
                  className={errors.equipment_notes ? "border-destructive" : ""}
                  rows={3}
                  maxLength={500}
                />
                {errors.equipment_notes && (
                  <p className="text-sm text-destructive mt-1">{errors.equipment_notes.message}</p>
                )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {equipmentNotes.length} / 500 characters
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* Save button */}
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

export default RepProfile;
