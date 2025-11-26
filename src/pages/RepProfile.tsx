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
import { US_STATES } from "@/lib/constants";
import { ArrowLeft, Save } from "lucide-react";

// Validation schema for rep profile
const repProfileSchema = z.object({
  city: z.string().trim().min(1, "City is required").max(100, "City must be less than 100 characters"),
  state: z.string().min(1, "State is required"),
  zip_code: z.string().trim().min(5, "ZIP code must be at least 5 characters").max(10, "ZIP code must be less than 10 characters"),
  bio: z.string().trim().max(500, "Bio must be less than 500 characters").optional().nullable(),
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
  });

  const selectedState = watch("state");

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
      const { error } = await supabase
        .from("rep_profile")
        .update({
          city: data.city,
          state: data.state,
          zip_code: data.zip_code,
          bio: data.bio || null,
        })
        .eq("id", repProfile.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Your profile has been updated successfully.",
      });

      // Refresh profile data
      await loadProfile();
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

      <div className="container mx-auto px-4 py-12 max-w-2xl">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-2">My Profile</h1>
          <p className="text-muted-foreground">
            Update your basic profile information
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)}>
          <Card className="p-6 bg-card-elevated border border-border space-y-6">
            {/* Read-only fields */}
            <div className="space-y-4 pb-6 border-b border-border">
              <h3 className="text-lg font-semibold text-foreground">Account Information</h3>
              
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

            {/* Editable fields */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-foreground">Location & Details</h3>

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
                <Label htmlFor="bio">Short Bio</Label>
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
                  {watch("bio")?.length || 0} / 500 characters
                </p>
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
