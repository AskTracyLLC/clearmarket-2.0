import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ExternalLink, MapPin, Briefcase, CheckCircle, XCircle } from "lucide-react";

interface PublicProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetUserId: string | null;
}

interface ProfileData {
  role: "rep" | "vendor" | null;
  anonymousId: string;
  displayName: string;
  city?: string;
  state?: string;
  zipCode?: string;
  bio?: string;
  companyName?: string;
  companyDescription?: string;
  website?: string;
  systemsUsed?: string[];
  inspectionTypes?: string[];
  isAcceptingNewVendors?: boolean;
  isAcceptingNewReps?: boolean;
  willingToTravelOutOfState?: boolean;
  coverageAreas?: Array<{
    stateCode: string;
    stateName: string;
    countyName: string | null;
    coversEntireState: boolean;
    basePrice: number | null;
    rushPrice: number | null;
  }>;
}

export function PublicProfileDialog({
  open,
  onOpenChange,
  targetUserId,
}: PublicProfileDialogProps) {
  const [loading, setLoading] = useState(true);
  const [profileData, setProfileData] = useState<ProfileData | null>(null);

  useEffect(() => {
    if (!open || !targetUserId) return;

    async function loadPublicProfile() {
      setLoading(true);
      try {
        // Load base profile
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("full_name, is_fieldrep, is_vendor_admin")
          .eq("id", targetUserId)
          .single();

        if (profileError || !profile) {
          console.error("Error loading profile:", profileError);
          setProfileData(null);
          setLoading(false);
          return;
        }

        // Determine display name (first name + last initial)
        const fullName = profile.full_name || "";
        const nameParts = fullName.trim().split(" ");
        const displayName =
          nameParts.length > 1
            ? `${nameParts[0]} ${nameParts[nameParts.length - 1].charAt(0)}.`
            : nameParts[0] || "User";

        // Load rep profile if applicable
        if (profile.is_fieldrep) {
          const { data: repProfile } = await supabase
            .from("rep_profile")
            .select("*")
            .eq("user_id", targetUserId)
            .single();

          if (repProfile) {
            // Load coverage areas
            const { data: coverageAreas } = await supabase
              .from("rep_coverage_areas")
              .select(`
                state_code,
                state_name,
                county_name,
                covers_entire_state,
                base_price,
                rush_price
              `)
              .eq("user_id", targetUserId)
              .order("state_code");

            setProfileData({
              role: "rep",
              anonymousId: repProfile.anonymous_id || "FieldRep#?",
              displayName,
              city: repProfile.city,
              state: repProfile.state,
              zipCode: repProfile.zip_code,
              bio: repProfile.bio,
              systemsUsed: repProfile.systems_used || [],
              inspectionTypes: repProfile.inspection_types || [],
              isAcceptingNewVendors: repProfile.is_accepting_new_vendors,
              willingToTravelOutOfState: repProfile.willing_to_travel_out_of_state,
              coverageAreas: (coverageAreas || []).map(area => ({
                stateCode: area.state_code,
                stateName: area.state_name,
                countyName: area.county_name,
                coversEntireState: area.covers_entire_state,
                basePrice: area.base_price,
                rushPrice: area.rush_price,
              })),
            });
          } else {
            setProfileData(null);
          }
        }
        // Load vendor profile if applicable
        else if (profile.is_vendor_admin) {
          const { data: vendorProfile } = await supabase
            .from("vendor_profile")
            .select("*")
            .eq("user_id", targetUserId)
            .single();

          if (vendorProfile) {
            setProfileData({
              role: "vendor",
              anonymousId: vendorProfile.anonymous_id || "Vendor#?",
              displayName,
              companyName: vendorProfile.company_name,
              companyDescription: vendorProfile.company_description,
              website: vendorProfile.website,
              city: vendorProfile.city,
              state: vendorProfile.state,
              systemsUsed: vendorProfile.systems_used || [],
              inspectionTypes: vendorProfile.primary_inspection_types || [],
              isAcceptingNewReps: vendorProfile.is_accepting_new_reps,
            });
          } else {
            setProfileData(null);
          }
        } else {
          setProfileData(null);
        }
      } catch (error) {
        console.error("Unexpected error loading public profile:", error);
        setProfileData(null);
      } finally {
        setLoading(false);
      }
    }

    loadPublicProfile();
  }, [open, targetUserId]);

  if (loading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Loading profile...</DialogTitle>
          </DialogHeader>
          <div className="py-8 text-center text-muted-foreground">
            Loading...
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!profileData) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Profile Not Available</DialogTitle>
          </DialogHeader>
          <div className="py-8 text-center text-muted-foreground">
            This user hasn't completed their public profile yet.
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-primary">
            {profileData.anonymousId}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">{profileData.displayName}</p>
        </DialogHeader>

        <div className="space-y-6">
          {/* Location */}
          {(profileData.city || profileData.state) && (
            <Card className="p-4 bg-card-elevated">
              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-foreground mb-1">Location</h3>
                  <p className="text-sm text-muted-foreground">
                    {[profileData.city, profileData.state, profileData.zipCode]
                      .filter(Boolean)
                      .join(", ")}
                  </p>
                </div>
              </div>
            </Card>
          )}

          {/* Rep-specific sections */}
          {profileData.role === "rep" && (
            <>
              {/* Bio */}
              {profileData.bio && (
                <Card className="p-4 bg-card-elevated">
                  <h3 className="font-semibold text-foreground mb-2">About</h3>
                  <p className="text-sm text-muted-foreground">{profileData.bio}</p>
                </Card>
              )}

              {/* Systems Used */}
              {profileData.systemsUsed && profileData.systemsUsed.length > 0 && (
                <Card className="p-4 bg-card-elevated">
                  <h3 className="font-semibold text-foreground mb-3">Systems I Use</h3>
                  <div className="flex flex-wrap gap-2">
                    {profileData.systemsUsed.map((system, idx) => (
                      <Badge key={idx} variant="secondary">
                        {system}
                      </Badge>
                    ))}
                  </div>
                </Card>
              )}

              {/* Inspection Types */}
              {profileData.inspectionTypes && profileData.inspectionTypes.length > 0 && (
                <Card className="p-4 bg-card-elevated">
                  <h3 className="font-semibold text-foreground mb-3">Inspection Types</h3>
                  <div className="flex flex-wrap gap-2">
                    {profileData.inspectionTypes.map((type, idx) => (
                      <Badge key={idx} variant="outline">
                        {type}
                      </Badge>
                    ))}
                  </div>
                </Card>
              )}

              {/* Availability & Preferences */}
              <Card className="p-4 bg-card-elevated">
                <h3 className="font-semibold text-foreground mb-3">
                  Availability & Preferences
                </h3>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    {profileData.isAcceptingNewVendors ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="text-sm text-muted-foreground">
                      {profileData.isAcceptingNewVendors
                        ? "Accepting New Vendors"
                        : "Not Accepting New Vendors"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {profileData.willingToTravelOutOfState ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="text-sm text-muted-foreground">
                      {profileData.willingToTravelOutOfState
                        ? "Willing to Travel Out of State"
                        : "Not Willing to Travel Out of State"}
                    </span>
                  </div>
                </div>
              </Card>

              {/* Coverage Snapshot */}
              {profileData.coverageAreas && profileData.coverageAreas.length > 0 && (
                <Card className="p-4 bg-card-elevated">
                  <h3 className="font-semibold text-foreground mb-3">Coverage Snapshot</h3>
                  <div className="space-y-2">
                    {profileData.coverageAreas.map((area, idx) => (
                      <div key={idx} className="text-sm">
                        <span className="text-foreground font-medium">
                          {area.stateCode} – {area.stateName}
                        </span>
                        {area.countyName && !area.coversEntireState && (
                          <span className="text-muted-foreground"> / {area.countyName}</span>
                        )}
                        {area.coversEntireState && (
                          <span className="text-muted-foreground"> (Entire State)</span>
                        )}
                        {(area.basePrice || area.rushPrice) && (
                          <span className="text-muted-foreground">
                            {area.basePrice && ` • Base: $${area.basePrice}`}
                            {area.rushPrice && ` • Rush: $${area.rushPrice}`}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </>
          )}

          {/* Vendor-specific sections */}
          {profileData.role === "vendor" && (
            <>
              {/* Company Info */}
              <Card className="p-4 bg-card-elevated">
                <div className="flex items-start gap-3">
                  <Briefcase className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground mb-1">
                      {profileData.companyName}
                    </h3>
                    {profileData.companyDescription && (
                      <p className="text-sm text-muted-foreground mb-2">
                        {profileData.companyDescription}
                      </p>
                    )}
                    {profileData.website && (
                      <a
                        href={profileData.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                      >
                        {profileData.website}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </div>
              </Card>

              {/* Systems We Use */}
              {profileData.systemsUsed && profileData.systemsUsed.length > 0 && (
                <Card className="p-4 bg-card-elevated">
                  <h3 className="font-semibold text-foreground mb-3">Systems We Use</h3>
                  <div className="flex flex-wrap gap-2">
                    {profileData.systemsUsed.map((system, idx) => (
                      <Badge key={idx} variant="secondary">
                        {system}
                      </Badge>
                    ))}
                  </div>
                </Card>
              )}

              {/* Inspection Types We Assign */}
              {profileData.inspectionTypes && profileData.inspectionTypes.length > 0 && (
                <Card className="p-4 bg-card-elevated">
                  <h3 className="font-semibold text-foreground mb-3">
                    Inspection Types We Assign
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {profileData.inspectionTypes.map((type, idx) => (
                      <Badge key={idx} variant="outline">
                        {type}
                      </Badge>
                    ))}
                  </div>
                </Card>
              )}

              {/* Availability */}
              <Card className="p-4 bg-card-elevated">
                <h3 className="font-semibold text-foreground mb-3">Availability</h3>
                <div className="flex items-center gap-2">
                  {profileData.isAcceptingNewReps ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className="text-sm text-muted-foreground">
                    {profileData.isAcceptingNewReps
                      ? "Accepting New Reps"
                      : "Not Accepting New Reps"}
                  </span>
                </div>
              </Card>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
