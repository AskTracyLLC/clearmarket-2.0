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
    },
  });

  const selectedState = watch("state");
  const systemsUsed = watch("systems_used") || [];
  const inspectionTypes = watch("inspection_types") || [];
  const bioText = watch("bio") || "";

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
        // MVP fields
        setValue("systems_used", repData.systems_used || []);
        setValue("inspection_types", repData.inspection_types || []);
        setValue("is_accepting_new_vendors", repData.is_accepting_new_vendors ?? true);
        setValue("willing_to_travel_out_of_state", repData.willing_to_travel_out_of_state ?? false);
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

  const onSubmit = async (data: RepProfileForm) => {
    if (!user || !repProfile) return;

    setSaving(true);

    try {
      // MVP: Prepare systems_used array
      let finalSystemsUsed = [...data.systems_used];
      if (data.systems_used.includes("Other") && data.systems_used_other) {
        finalSystemsUsed = finalSystemsUsed.filter(s => s !== "Other");
        finalSystemsUsed.push(`Other: ${data.systems_used_other}`);
      }

      // MVP: Prepare inspection_types array
      let finalInspectionTypes = [...data.inspection_types];
      if (data.inspection_types.includes("Other") && data.inspection_types_other) {
        finalInspectionTypes = finalInspectionTypes.filter(t => t !== "Other");
        finalInspectionTypes.push(`Other: ${data.inspection_types_other}`);
      }

      const { error } = await supabase
        .from("rep_profile")
        .update({
          city: data.city,
          state: data.state,
          zip_code: data.zip_code,
          bio: data.bio || null,
          // MVP PLACEHOLDER fields - will be normalized in Phase 2
          systems_used: finalSystemsUsed,
          inspection_types: finalInspectionTypes,
          is_accepting_new_vendors: data.is_accepting_new_vendors,
          willing_to_travel_out_of_state: data.willing_to_travel_out_of_state,
        })
        .eq("id", repProfile.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Your profile has been updated successfully.",
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

export default RepProfile;
