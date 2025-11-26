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
import { ArrowLeft, Save, AlertCircle } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";

// Validation schema for vendor profile (MVP)
const vendorProfileSchema = z.object({
  company_name: z.string().trim().min(1, "Company name is required").max(100, "Company name must be less than 100 characters"),
  city: z.string().trim().min(1, "City is required").max(100, "City must be less than 100 characters"),
  state: z.string().min(1, "State is required"),
  company_description: z.string().trim().max(1000, "Description must be less than 1000 characters").optional().nullable(),
  website: z.string().trim().url("Must be a valid URL").max(255, "Website URL must be less than 255 characters").optional().or(z.literal("")),
  // MVP PLACEHOLDER: These arrays will be migrated to normalized tables in Phase 2
  systems_used: z.array(z.string()).min(1, "Please select at least one system"),
  systems_used_other: z.string().trim().max(100).optional().nullable(),
  primary_inspection_types: z.array(z.string()).min(1, "Please select at least one inspection type"),
  primary_inspection_types_other: z.string().trim().max(100).optional().nullable(),
  is_accepting_new_reps: z.boolean(),
});

type VendorProfileForm = z.infer<typeof vendorProfileSchema>;

const VendorProfile = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState<any>(null);
  const [vendorProfile, setVendorProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<VendorProfileForm>({
    resolver: zodResolver(vendorProfileSchema),
    defaultValues: {
      systems_used: [],
      primary_inspection_types: [],
      is_accepting_new_reps: true,
    },
  });

  const selectedState = watch("state");
  const systemsUsed = watch("systems_used") || [];
  const inspectionTypes = watch("primary_inspection_types") || [];
  const descriptionText = watch("company_description") || "";

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

      // Check if user is a vendor
      if (!profileData.is_vendor_admin) {
        toast({
          title: "Access Denied",
          description: "This page is only accessible to Vendors.",
          variant: "destructive",
        });
        navigate("/dashboard");
        return;
      }

      // Load or create vendor profile
      const { data: vendorData, error: vendorError } = await supabase
        .from("vendor_profile")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (vendorError && vendorError.code !== "PGRST116") throw vendorError;

      if (vendorData) {
        setVendorProfile(vendorData);
        // Populate form with existing data
        setValue("company_name", vendorData.company_name || "");
        setValue("city", vendorData.city || "");
        setValue("state", vendorData.state || "");
        setValue("company_description", vendorData.company_description || "");
        setValue("website", vendorData.website || "");
        
        // MVP fields - parse "Other: X" format back into checkbox + text field
        const systemsArray = vendorData.systems_used || [];
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
        
        const inspectionTypesArray = vendorData.primary_inspection_types || [];
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
        setValue("primary_inspection_types", inspectionTypesForCheckboxes);
        setValue("primary_inspection_types_other", inspectionTypesOtherText);
        setValue("is_accepting_new_reps", vendorData.is_accepting_new_reps ?? true);
      } else {
        // Create new vendor profile with empty company_name (will be set on first save)
        const { data: newVendorProfile, error: createError } = await supabase
          .from("vendor_profile")
          .insert({ 
            user_id: user.id,
            company_name: "" // Temporary empty value, will be updated on save
          })
          .select()
          .single();

        if (createError) throw createError;
        setVendorProfile(newVendorProfile);
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
      // MVP: Prepare systems_used array
      let finalSystemsUsed = [...data.systems_used];
      if (data.systems_used.includes("Other") && data.systems_used_other) {
        finalSystemsUsed = finalSystemsUsed.filter(s => s !== "Other");
        finalSystemsUsed.push(`Other: ${data.systems_used_other}`);
      }

      // MVP: Prepare primary_inspection_types array
      let finalInspectionTypes = [...data.primary_inspection_types];
      if (data.primary_inspection_types.includes("Other") && data.primary_inspection_types_other) {
        finalInspectionTypes = finalInspectionTypes.filter(t => t !== "Other");
        finalInspectionTypes.push(`Other: ${data.primary_inspection_types_other}`);
      }

      const { error } = await supabase
        .from("vendor_profile")
        .update({
          company_name: data.company_name,
          city: data.city,
          state: data.state,
          company_description: data.company_description || null,
          website: data.website || null,
          // MVP PLACEHOLDER fields - will be normalized in Phase 2
          systems_used: finalSystemsUsed,
          primary_inspection_types: finalInspectionTypes,
          is_accepting_new_reps: data.is_accepting_new_reps,
        })
        .eq("id", vendorProfile.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Your company profile has been updated successfully.",
      });

      // Redirect to dashboard
      navigate("/dashboard");
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
          <h1 className="text-4xl font-bold text-foreground mb-2">Vendor Profile</h1>
          <p className="text-muted-foreground">
            Complete your profile to connect with field reps
          </p>
        </div>

        {/* Profile completion warning */}
        {(!watch("company_name") || !watch("city") || !watch("state") || systemsUsed.length === 0 || inspectionTypes.length === 0) && (
          <Alert className="mb-6 border-secondary/50 bg-secondary/10">
            <AlertCircle className="h-4 w-4 text-secondary" />
            <AlertDescription className="text-foreground">
              To connect with field reps, please complete your company information and select at least one Inspection Type and System Used.
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

            {/* Section A: Company Info */}
            <div className="space-y-4 pb-6 border-b border-border">
              <h3 className="text-xl font-semibold text-foreground">Company Info</h3>

              <div>
                <Label htmlFor="company_name">
                  Company Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="company_name"
                  {...register("company_name")}
                  placeholder="Enter your company name"
                  className={errors.company_name ? "border-destructive" : ""}
                />
                {errors.company_name && (
                  <p className="text-sm text-destructive mt-1">{errors.company_name.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="website">Website <span className="text-muted-foreground text-sm">(Optional)</span></Label>
                <Input
                  id="website"
                  {...register("website")}
                  placeholder="https://yourcompany.com"
                  className={errors.website ? "border-destructive" : ""}
                  type="url"
                />
                {errors.website && (
                  <p className="text-sm text-destructive mt-1">{errors.website.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="company_description">Short Company Description <span className="text-muted-foreground text-sm">(Optional)</span></Label>
                <Textarea
                  id="company_description"
                  {...register("company_description")}
                  placeholder="Tell reps about your company and what you do..."
                  className={errors.company_description ? "border-destructive" : ""}
                  rows={4}
                  maxLength={1000}
                />
                {errors.company_description && (
                  <p className="text-sm text-destructive mt-1">{errors.company_description.message}</p>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  {descriptionText.length} / 1000 characters
                </p>
              </div>
            </div>

            {/* Section B: Location */}
            <div className="space-y-4 pb-6 border-b border-border">
              <h3 className="text-xl font-semibold text-foreground">Location</h3>

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
            </div>

            {/* Section C: Systems We Use (MVP) */}
            <div className="space-y-4 pb-6 border-b border-border">
              <div>
                <h3 className="text-xl font-semibold text-foreground mb-1">Systems We Use</h3>
                <p className="text-sm text-muted-foreground">Select the inspection systems your company uses</p>
              </div>
              
              <div className="space-y-3">
                {SYSTEMS_LIST.map((system) => (
                  <div key={system} className="flex items-center space-x-3">
                    <Checkbox
                      id={`vendor-system-${system}`}
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
                    <Label htmlFor={`vendor-system-${system}`} className="text-foreground font-normal cursor-pointer">
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

            {/* Section D: Inspection Types We Assign (MVP) */}
            <div className="space-y-4 pb-6 border-b border-border">
              <div>
                <h3 className="text-xl font-semibold text-foreground mb-1">Inspection Types We Assign</h3>
                <p className="text-sm text-muted-foreground">Select the types of inspections you assign to field reps</p>
              </div>

              <div className="space-y-3">
                {INSPECTION_TYPES_LIST.map((type) => (
                  <div key={type} className="flex items-center space-x-3">
                    <Checkbox
                      id={`vendor-inspection-${type}`}
                      checked={inspectionTypes.includes(type)}
                      onCheckedChange={(checked) => {
                        const current = inspectionTypes;
                        if (checked) {
                          setValue("primary_inspection_types", [...current, type]);
                        } else {
                          setValue("primary_inspection_types", current.filter((t) => t !== type));
                        }
                      }}
                    />
                    <Label htmlFor={`vendor-inspection-${type}`} className="text-foreground font-normal cursor-pointer">
                      {type}
                    </Label>
                  </div>
                ))}
              </div>

              {/* Other inspection type free text */}
              {inspectionTypes.includes("Other") && (
                <div className="ml-7">
                  <Label htmlFor="primary_inspection_types_other" className="text-sm">
                    Please specify other inspection type
                  </Label>
                  <Input
                    id="primary_inspection_types_other"
                    {...register("primary_inspection_types_other")}
                    placeholder="Enter inspection type"
                    className="mt-1"
                    maxLength={100}
                  />
                </div>
              )}

              {errors.primary_inspection_types && (
                <p className="text-sm text-destructive">{errors.primary_inspection_types.message}</p>
              )}
            </div>

            {/* Section E: Availability */}
            <div className="space-y-4 pb-6 border-b border-border">
              <div>
                <h3 className="text-xl font-semibold text-foreground mb-1">Availability</h3>
                <p className="text-sm text-muted-foreground">Manage your rep recruitment status</p>
              </div>

              <div className="flex items-center justify-between">
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
    </div>
  );
};

export default VendorProfile;
