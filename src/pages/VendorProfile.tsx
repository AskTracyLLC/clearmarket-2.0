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

// Validation schema for vendor profile
const vendorProfileSchema = z.object({
  company_name: z.string().trim().min(1, "Company name is required").max(100, "Company name must be less than 100 characters"),
  city: z.string().trim().max(100, "City must be less than 100 characters").optional().nullable(),
  state: z.string().min(1, "State is required"),
  company_description: z.string().trim().max(1000, "Description must be less than 1000 characters").optional().nullable(),
  website: z.string().trim().url("Must be a valid URL").max(255, "Website URL must be less than 255 characters").optional().or(z.literal("")),
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
      const { error } = await supabase
        .from("vendor_profile")
        .update({
          company_name: data.company_name,
          city: data.city || null,
          state: data.state,
          company_description: data.company_description || null,
          website: data.website || null,
        })
        .eq("id", vendorProfile.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Your company profile has been updated successfully.",
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
          <h1 className="text-4xl font-bold text-foreground mb-2">My Company Profile</h1>
          <p className="text-muted-foreground">
            Update your company information
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
              <h3 className="text-lg font-semibold text-foreground">Company Details</h3>

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
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  {...register("city")}
                  placeholder="Enter your city (optional)"
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
                <Label htmlFor="website">Website</Label>
                <Input
                  id="website"
                  {...register("website")}
                  placeholder="https://yourcompany.com (optional)"
                  className={errors.website ? "border-destructive" : ""}
                  type="url"
                />
                {errors.website && (
                  <p className="text-sm text-destructive mt-1">{errors.website.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="company_description">Short Company Description</Label>
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
                  {watch("company_description")?.length || 0} / 1000 characters
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

export default VendorProfile;
