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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { US_STATES, SYSTEMS_LIST, INSPECTION_TYPES_LIST } from "@/lib/constants";
import { ArrowLeft, Save, AlertCircle, MapPin, DollarSign, Edit, Trash2, Upload, ExternalLink, ShieldCheck } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { CoverageAreaDialog } from "@/components/CoverageAreaDialog";
import { isBackgroundCheckActive, maskBackgroundCheckId } from "@/lib/backgroundCheckUtils";
import { getBackgroundCheckSignedUrl } from "@/lib/storage";

// Validation schema for rep profile (MVP)
const repProfileSchema = z.object({
  city: z.string().trim().min(1, "City is required").max(100, "City must be less than 100 characters"),
  state: z.string().min(1, "State is required"),
  zip_code: z.string().trim().min(5, "ZIP code must be at least 5 characters").max(10, "ZIP code must be less than 10 characters"),
  bio: z.string().trim().max(500, "Bio must be less than 500 characters").optional().nullable(),
  // MVP PLACEHOLDER: These arrays will be migrated to normalized tables in Phase 2
  systems_used: z.array(z.string()).min(1, "Please select at least one system"),
  systems_used_other: z.string().trim().max(100).optional().nullable(),
  inspection_types: z.array(z.string()).min(1, "Please select at least one inspection type"),
  inspection_types_other: z.string().trim().max(100).optional().nullable(),
  is_accepting_new_vendors: z.boolean(),
  willing_to_travel_out_of_state: z.boolean(),
  // Background Check fields
  background_check_is_active: z.boolean(),
  background_check_provider: z.enum(["aspen_grove", "other"]).nullable(),
  background_check_provider_other_name: z.string().trim().max(100).optional().nullable(),
  background_check_id: z.string().trim().max(100).optional().nullable(),
  background_check_expires_on: z.string().optional().nullable(),
  background_check_screenshot_url: z.string().optional().nullable(),
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
});

type RepProfileForm = z.infer<typeof repProfileSchema>;

const RepProfile = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState<any>(null);
  const [repProfile, setRepProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [coverageAreas, setCoverageAreas] = useState<any[]>([]);
  const [coverageDialogOpen, setCoverageDialogOpen] = useState(false);
  const [editingCoverage, setEditingCoverage] = useState<any>(null);
  const [uploadingScreenshot, setUploadingScreenshot] = useState(false);

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
      inspection_types: [],
      is_accepting_new_vendors: true,
      willing_to_travel_out_of_state: false,
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

    if (user) {
      loadProfile();
    }
  }, [user, authLoading, navigate]);

  const loadProfile = async () => {
    if (!user) return;

    try {
      // Load user profile
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (profileError) throw profileError;

      setProfile(profileData);

      // Check if user is a field rep
      if (!profileData.is_fieldrep) {
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
        .eq("user_id", user.id)
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
        setValue("inspection_types", inspectionTypesForCheckboxes);
        setValue("inspection_types_other", inspectionTypesOtherText);
        setValue("is_accepting_new_vendors", repData.is_accepting_new_vendors ?? true);
        setValue("willing_to_travel_out_of_state", repData.willing_to_travel_out_of_state ?? false);
        
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
          .insert({ user_id: user.id })
          .select()
          .single();

        if (createError) throw createError;
        setRepProfile(newRepProfile);
      }

      // Load coverage areas
      await loadCoverageAreas();
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
    if (!user) return;
    const { data, error } = await supabase
      .from("rep_coverage_areas")
      .select("*")
      .eq("user_id", user.id)
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
      inspection_types: inspectionTypes,
      is_accepting_new_vendors: data.is_accepting_new_vendors,
      willing_to_travel_out_of_state: data.willing_to_travel_out_of_state,
      background_check_is_active: data.background_check_is_active,
      background_check_provider: data.background_check_is_active ? data.background_check_provider : null,
      background_check_provider_other_name: data.background_check_is_active ? (data.background_check_provider_other_name || null) : null,
      background_check_id: data.background_check_is_active ? (data.background_check_id || null) : null,
      background_check_expires_on: data.background_check_is_active ? (data.background_check_expires_on || null) : null,
      background_check_screenshot_url: data.background_check_is_active ? (data.background_check_screenshot_url || null) : null,
      has_hud_keys: data.has_hud_keys ?? null,
      hud_keys_details: data.has_hud_keys ? (data.hud_keys_details || null) : null,
      equipment_notes: data.equipment_notes || null,
    };

    const { error } = await supabase
      .from("rep_profile")
      .update(updateData)
      .eq("user_id", user!.id);

    if (error) {
      console.error("Error updating profile:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to save profile. Please try again.",
      });
    } else {
      toast({
        title: "Profile Updated",
        description: "Your profile has been saved successfully.",
      });
      // Stay on profile page after save
      await loadProfile();
    }

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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link to="/dashboard">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-12 max-w-3xl">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-2">Field Rep Profile</h1>
          <p className="text-muted-foreground">
            Complete your profile to appear in vendor searches
          </p>
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
              <h3 className="text-xl font-semibold text-foreground">Account Information</h3>
              
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
            </div>

            {/* Section A: Basic Info */}
            <div className="space-y-4 pb-6 border-b border-border">
              <h3 className="text-xl font-semibold text-foreground">Basic Info</h3>

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
            </div>

            {/* Section B: Systems I Use (MVP) */}
            <div className="space-y-4 pb-6 border-b border-border">
              <div>
                <h3 className="text-xl font-semibold text-foreground mb-1">Systems I Use</h3>
                <p className="text-sm text-muted-foreground">Select the inspection systems you currently use</p>
              </div>
              
              <div className="space-y-3">
                {SYSTEMS_LIST.map((system) => (
                  <div key={system} className="flex items-center space-x-3">
                    <Checkbox
                      id={`system-${system}`}
                      checked={systemsUsed.includes(system)}
                      onCheckedChange={(checked) => {
                        const current = systemsUsed;
                        if (checked) {
                          setValue("systems_used", [...current, system]);
                        } else {
                          setValue("systems_used", current.filter((s) => s !== system));
                        }
                      }}
                    />
                    <Label htmlFor={`system-${system}`} className="text-foreground font-normal cursor-pointer">
                      {system}
                    </Label>
                  </div>
                ))}
              </div>

              {/* Other system free text */}
              {systemsUsed.includes("Other") && (
                <div className="ml-7">
                  <Label htmlFor="systems_used_other" className="text-sm">
                    Please specify other system
                  </Label>
                  <Input
                    id="systems_used_other"
                    {...register("systems_used_other")}
                    placeholder="Enter system name"
                    className="mt-1"
                    maxLength={100}
                  />
                </div>
              )}

              {errors.systems_used && (
                <p className="text-sm text-destructive">{errors.systems_used.message}</p>
              )}
            </div>

            {/* Section C: Inspection Types I Perform (MVP) */}
            <div className="space-y-4 pb-6 border-b border-border">
              <div>
                <h3 className="text-xl font-semibold text-foreground mb-1">Inspection Types I Perform</h3>
                <p className="text-sm text-muted-foreground">Select the types of inspections you do</p>
              </div>

              <div className="space-y-3">
                {INSPECTION_TYPES_LIST.map((type) => (
                  <div key={type} className="flex items-center space-x-3">
                    <Checkbox
                      id={`inspection-${type}`}
                      checked={inspectionTypes.includes(type)}
                      onCheckedChange={(checked) => {
                        const current = inspectionTypes;
                        if (checked) {
                          setValue("inspection_types", [...current, type]);
                        } else {
                          setValue("inspection_types", current.filter((t) => t !== type));
                        }
                      }}
                    />
                    <Label htmlFor={`inspection-${type}`} className="text-foreground font-normal cursor-pointer">
                      {type}
                    </Label>
                  </div>
                ))}
              </div>

              {/* Other inspection type free text */}
              {inspectionTypes.includes("Other") && (
                <div className="ml-7">
                  <Label htmlFor="inspection_types_other" className="text-sm">
                    Please specify other inspection type
                  </Label>
                  <Input
                    id="inspection_types_other"
                    {...register("inspection_types_other")}
                    placeholder="Enter inspection type"
                    className="mt-1"
                    maxLength={100}
                  />
                </div>
              )}

              {errors.inspection_types && (
                <p className="text-sm text-destructive">{errors.inspection_types.message}</p>
              )}
            </div>

            {/* Section D: Availability & Preferences */}
            <div className="space-y-4 pb-6 border-b border-border">
              <div>
                <h3 className="text-xl font-semibold text-foreground mb-1">Availability & Preferences</h3>
                <p className="text-sm text-muted-foreground">Help vendors understand your availability</p>
              </div>

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
              </div>
            </div>

            {/* Section D2: Background Check (Optional) */}
            <div className="space-y-4 pb-6 border-b border-border">
              <div>
                <h3 className="text-xl font-semibold text-foreground mb-1 flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5" />
                  Background Check (Optional but Recommended)
                </h3>
                <p className="text-sm text-muted-foreground">
                  Some vendors require a background check to work with them. You can still use ClearMarket without one, 
                  but you may be excluded from those opportunities.
                </p>
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
                          Background Check Provider Name <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="background_check_provider_other_name"
                          {...register("background_check_provider_other_name")}
                          placeholder="e.g., Sterling, Checkr"
                          className="mt-2"
                        />
                        {errors.background_check_provider_other_name && (
                          <p className="text-sm text-destructive mt-1">{errors.background_check_provider_other_name.message}</p>
                        )}
                      </div>

                      <div>
                        <Label htmlFor="background_check_id">
                          Background Check Reference / ID <span className="text-muted-foreground">(optional)</span>
                        </Label>
                        <Input
                          id="background_check_id"
                          {...register("background_check_id")}
                          placeholder="e.g., REF-12345"
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
                          min={new Date().toISOString().split('T')[0]}
                          {...register("background_check_expires_on")}
                          className="mt-2"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Must be today or a future date.
                        </p>
                        {errors.background_check_expires_on && (
                          <p className="text-sm text-destructive mt-1">{errors.background_check_expires_on.message}</p>
                        )}
                      </div>
                    </>
                  )}

                  {/* Screenshot Upload */}
                  {backgroundCheckProvider && (
                    <div>
                      <Label>
                        Upload Screenshot of Background Check <span className="text-destructive">*</span>
                      </Label>
                      <p className="text-xs text-muted-foreground mt-1 mb-2">
                        Upload a screenshot showing your valid, passed background check.
                      </p>
                      
                      {backgroundCheckScreenshot ? (
                        <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                          <ShieldCheck className="h-5 w-5 text-green-500" />
                          <div className="flex-1">
                            <p className="text-sm font-medium text-foreground">Screenshot uploaded</p>
                          <Button
                            type="button"
                            variant="link"
                            size="sm"
                            className="h-auto p-0 text-primary"
                            onClick={async () => {
                              try {
                                const signedUrl = await getBackgroundCheckSignedUrl(backgroundCheckScreenshot, 60);
                                
                                if (signedUrl) {
                                  window.open(signedUrl, '_blank');
                                } else {
                                  toast({ title: "Error", description: "Could not generate preview link", variant: "destructive" });
                                }
                              } catch (error) {
                                console.error('Error viewing screenshot:', error);
                                toast({ title: "Error", description: "Failed to open screenshot", variant: "destructive" });
                              }
                            }}
                            >
                              <ExternalLink className="h-3 w-3 mr-1" />
                              View Screenshot
                            </Button>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setValue("background_check_screenshot_url", null)}
                          >
                            Remove
                          </Button>
                        </div>
                      ) : (
                        <div>
                          <Input
                            type="file"
                            accept="image/png,image/jpeg,image/jpg,image/webp"
                            disabled={uploadingScreenshot}
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;

                              // Validate file size (max 5MB)
                              if (file.size > 5 * 1024 * 1024) {
                                toast({
                                  title: "File too large",
                                  description: "Please upload an image smaller than 5MB.",
                                  variant: "destructive",
                                });
                                return;
                              }

                              setUploadingScreenshot(true);
                              try {
                                // Upload to Supabase Storage
                                const fileExt = file.name.split('.').pop();
                                const fileName = `${user!.id}/${Date.now()}.${fileExt}`;
                                
                                const { data, error } = await supabase.storage
                                  .from('background-checks')
                                  .upload(fileName, file);

                                if (error) throw error;

                                // Get public URL
                                const { data: { publicUrl } } = supabase.storage
                                  .from('background-checks')
                                  .getPublicUrl(data.path);

                                setValue("background_check_screenshot_url", publicUrl);
                                toast({
                                  title: "Screenshot Uploaded",
                                  description: "Your background check screenshot has been uploaded successfully.",
                                });
                              } catch (error: any) {
                                console.error("Upload error:", error);
                                toast({
                                  title: "Upload Failed",
                                  description: "Failed to upload screenshot. Please try again.",
                                  variant: "destructive",
                                });
                              } finally {
                                setUploadingScreenshot(false);
                              }
                            }}
                          />
                          {uploadingScreenshot && (
                            <p className="text-sm text-muted-foreground mt-2">Uploading...</p>
                          )}
                        </div>
                      )}
                      {errors.background_check_screenshot_url && (
                        <p className="text-sm text-destructive mt-1">{errors.background_check_screenshot_url.message}</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Section D2: Access & Equipment (Optional) */}
            <div className="space-y-4 pb-6 border-b border-border">
              <div>
                <h3 className="text-xl font-semibold text-foreground mb-1">Access & Equipment</h3>
                <p className="text-sm text-muted-foreground">
                  Share what kind of property access you have and any tools or equipment you want vendors to know about.
                </p>
              </div>

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
            </div>

            {/* Section E: Coverage & Pricing (MVP) */}
            <div className="space-y-4 pb-6 border-b border-border">
              <div>
                <h3 className="text-xl font-semibold text-foreground mb-1 flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Coverage & Pricing (MVP)
                </h3>
                <p className="text-sm text-muted-foreground">
                  Add the states and counties you're willing to cover, and your typical pricing. 
                  This is MVP data that future matching and Seeking Coverage will use.
                </p>
              </div>

              {/* Warning for incomplete pricing */}
              {coverageAreas.length > 0 && coverageAreas.some(c => c.base_price === null || c.base_price === undefined) && (
                <Alert className="border-orange-500/50 bg-orange-500/10">
                  <AlertCircle className="h-4 w-4 text-orange-500" />
                  <AlertDescription className="text-foreground">
                    <strong>Set a Base Rate for each county</strong> if you want to be matched to Seeking Coverage posts there. 
                    Posts that don't meet your pricing requirements won't be shown on Find Work.
                  </AlertDescription>
                </Alert>
              )}

              {coverageAreas.length === 0 ? (
                <div className="text-center py-8 border border-dashed border-border rounded-lg bg-muted/30">
                  <MapPin className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-sm text-muted-foreground mb-4">
                    No coverage areas added yet. Vendors won't see you in searches until you add at least one state.
                  </p>
                  <Button
                    type="button"
                    onClick={() => {
                      setEditingCoverage(null);
                      setCoverageDialogOpen(true);
                    }}
                  >
                    Add Coverage Area
                  </Button>
                </div>
              ) : (
                <>
                  <div className="space-y-3">
                    {coverageAreas.map((coverage) => (
                      <Card key={coverage.id} className="p-4 bg-muted/30 border-border">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h4 className="font-semibold text-foreground">
                                {coverage.state_code} - {coverage.state_name}
                              </h4>
                              {coverage.covers_entire_state && (
                                <Badge variant="secondary">Entire State</Badge>
                              )}
                              {(!coverage.base_price && coverage.base_price !== 0) && (
                                <Badge variant="destructive" className="text-xs">Missing Base Rate</Badge>
                              )}
                            </div>
                            
                            <p className="text-sm text-muted-foreground mb-2">
                              {coverage.covers_entire_state 
                                ? "All counties" 
                                : coverage.county_name || "No specific county"}
                              {!coverage.covers_entire_state && coverage.covers_entire_county && coverage.county_name && (
                                <Badge variant="secondary" className="ml-2">Entire County</Badge>
                              )}
                            </p>

                            {(coverage.base_price || coverage.rush_price) && (
                              <div className="flex items-center gap-4 text-sm mb-2">
                                {coverage.base_price && (
                                  <span className="flex items-center gap-1 text-foreground">
                                    <DollarSign className="h-3 w-3" />
                                    Base: ${parseFloat(coverage.base_price).toFixed(2)}
                                  </span>
                                )}
                                {coverage.rush_price && (
                                  <span className="flex items-center gap-1 text-foreground">
                                    <DollarSign className="h-3 w-3" />
                                    Rush: ${parseFloat(coverage.rush_price).toFixed(2)}
                                  </span>
                                )}
                              </div>
                            )}

                            {coverage.region_note && (
                              <p className="text-xs text-muted-foreground italic mb-2">
                                {coverage.region_note}
                              </p>
                            )}

                            {coverage.inspection_types && coverage.inspection_types.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {coverage.inspection_types.map((type: string, idx: number) => (
                                  <Badge key={idx} variant="outline" className="text-xs">
                                    {type}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-2 ml-4">
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setEditingCoverage(coverage);
                                setCoverageDialogOpen(true);
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={async () => {
                                const { error } = await supabase
                                  .from("rep_coverage_areas")
                                  .delete()
                                  .eq("id", coverage.id);

                                if (error) {
                                  toast({
                                    variant: "destructive",
                                    title: "Error",
                                    description: "Failed to delete coverage area.",
                                  });
                                } else {
                                  toast({
                                    title: "Coverage Area Deleted",
                                    description: "Coverage area removed successfully.",
                                  });
                                  loadCoverageAreas();
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                  
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setEditingCoverage(null);
                      setCoverageDialogOpen(true);
                    }}
                  >
                    Add Another Coverage Area
                  </Button>
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

        {/* Coverage Area Dialog */}
        <CoverageAreaDialog
          open={coverageDialogOpen}
          onOpenChange={setCoverageDialogOpen}
          editData={editingCoverage}
          onSave={async (data) => {
            const payload: any = {
              user_id: user!.id,
              state_code: data.state_code,
              state_name: data.state_name,
              county_name: data.county_name || null,
              county_id: data.county_id || null,
              covers_entire_state: data.covers_entire_state,
              covers_entire_county: data.covers_entire_county,
              base_price: data.base_price ? parseFloat(data.base_price) : null,
              rush_price: data.rush_price ? parseFloat(data.rush_price) : null,
              region_note: data.region_note || null,
              inspection_types: data.inspection_types.length > 0 ? data.inspection_types : null,
            };

            if (data.id) {
              // Update existing
              const { error } = await supabase
                .from("rep_coverage_areas")
                .update(payload)
                .eq("id", data.id);

              if (error) {
                toast({
                  variant: "destructive",
                  title: "Error",
                  description: "Failed to update coverage area.",
                });
              } else {
                toast({
                  title: "Coverage Area Updated",
                  description: "Your coverage area has been updated successfully.",
                });
                await loadCoverageAreas();
              }
            } else {
              // Insert new
              const { error } = await supabase
                .from("rep_coverage_areas")
                .insert([payload]);

              if (error) {
                toast({
                  variant: "destructive",
                  title: "Error",
                  description: "Failed to add coverage area.",
                });
              } else {
                toast({
                  title: "Coverage Area Added",
                  description: "Your coverage area has been added successfully.",
                });
                await loadCoverageAreas();
              }
            }
          }}
        />
      </div>
    </div>
  );
};

export default RepProfile;
