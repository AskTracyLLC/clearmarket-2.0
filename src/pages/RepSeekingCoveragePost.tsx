import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, MapPin, Calendar, Building2, Clock, Shield, CheckCircle, AlertTriangle } from "lucide-react";

import { ExpressInterestDialog } from "@/components/ExpressInterestDialog";
import { isBackgroundCheckActive } from "@/lib/backgroundCheckUtils";
import { format, parseISO } from "date-fns";
import { getRateMatchStatus } from "@/lib/rateMatching";

interface PostData {
  id: string;
  vendor_id: string;
  title: string;
  description: string | null;
  state_code: string | null;
  county_id: string | null;
  inspection_types: string[];
  systems_required_array: string[];
  status: string;
  created_at: string;
  expires_at: string | null;
  is_accepting_responses: boolean;
  pay_type: string;
  pay_min: number | null;
  pay_max: number | null;
  pay_notes: string | null;
  requires_background_check: boolean;
  requires_aspen_grove: boolean;
  allow_willing_to_obtain_background_check?: boolean | null;
  us_counties?: { county_name: string; state_code: string } | null;
}

interface VendorInfo {
  anonymous_id: string | null;
  company_name: string;
}

export default function RepSeekingCoveragePost() {
  const { postId } = useParams<{ postId: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [post, setPost] = useState<PostData | null>(null);
  const [vendor, setVendor] = useState<VendorInfo | null>(null);
  const [repProfile, setRepProfile] = useState<any>(null);
  const [coverageAreas, setCoverageAreas] = useState<any[]>([]);
  const [hasExpressedInterest, setHasExpressedInterest] = useState(false);
  const [interestDialogOpen, setInterestDialogOpen] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      if (!user || !postId) return;

      try {
        // Verify user is a field rep
        const { data: profile } = await supabase
          .from("profiles")
          .select("is_fieldrep, is_admin")
          .eq("id", user.id)
          .single();

        if (!profile?.is_fieldrep && !profile?.is_admin) {
          toast.error("This page is only available to Field Reps.");
          navigate("/dashboard");
          return;
        }

        // Load the post
        const { data: postData, error: postError } = await supabase
          .from("seeking_coverage_posts")
          .select(`
            *,
            us_counties!county_id(county_name, state_code)
          `)
          .eq("id", postId)
          .is("deleted_at", null)
          .single();

        if (postError || !postData) {
          toast.error("Post not found or has been removed.");
          navigate("/rep/find-work");
          return;
        }

        setPost(postData);

        // Load vendor info
        const { data: vendorData } = await supabase
          .from("vendor_profile")
          .select("anonymous_id, company_name")
          .eq("user_id", postData.vendor_id)
          .single();

        setVendor(vendorData || { anonymous_id: null, company_name: "Unknown Vendor" });

        // Load rep profile
        const { data: repData } = await supabase
          .from("rep_profile")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle();

        setRepProfile(repData);

        // Load coverage areas
        const { data: coverageData } = await supabase
          .from("rep_coverage_areas")
          .select("id, state_code, county_id, county_name, covers_entire_state, covers_entire_county, base_price, rush_price")
          .eq("user_id", user.id);

        setCoverageAreas(coverageData || []);

        // Check if already expressed interest
        if (repData) {
          const { data: interestData } = await supabase
            .from("rep_interest")
            .select("id")
            .eq("post_id", postId)
            .eq("rep_id", repData.id)
            .maybeSingle();

          setHasExpressedInterest(!!interestData);
        }
      } catch (error) {
        console.error("Error loading post:", error);
        toast.error("Failed to load opportunity");
        navigate("/rep/find-work");
      } finally {
        setLoading(false);
      }
    };

    if (!authLoading) {
      loadData();
    }
  }, [user, authLoading, postId, navigate]);

  const handleInterestExpressed = (postId: string) => {
    setHasExpressedInterest(true);
  };

  if (authLoading || loading) {
    return (
      <AuthenticatedLayout>
        <div className="container py-8">
          <Card className="animate-pulse">
            <CardContent className="py-8">
              <div className="h-6 bg-muted rounded w-1/3 mb-4"></div>
              <div className="h-4 bg-muted rounded w-2/3 mb-2"></div>
              <div className="h-4 bg-muted rounded w-1/2"></div>
            </CardContent>
          </Card>
        </div>
      </AuthenticatedLayout>
    );
  }

  if (!post || !vendor) {
    return (
      <AuthenticatedLayout>
        <div className="container py-8">
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground">Post not found.</p>
              <Button variant="outline" className="mt-4" onClick={() => navigate("/dashboard")}>
                Back to Dashboard
              </Button>
            </CardContent>
          </Card>
        </div>
      </AuthenticatedLayout>
    );
  }

  // Find rep's base rate for this post's location
  const getRepBaseRateForPost = () => {
    if (!post || !coverageAreas || coverageAreas.length === 0) return null;
    
    const matchingCoverage = coverageAreas.find((coverage) => {
      if (coverage.state_code !== post.state_code) return false;
      if (coverage.covers_entire_state) return true;
      if (!post.county_id) return true;
      if (coverage.county_id === post.county_id) return true;
      return false;
    });
    
    return matchingCoverage?.base_price ?? null;
  };
  
  const repBaseRate = getRepBaseRateForPost();
  
  // Check if the post's rate matches the rep's base rate
  const rateMatchStatus = getRateMatchStatus(repBaseRate, post.pay_min, post.pay_max);

  const locationText = post.us_counties
    ? `${post.us_counties.county_name}, ${post.state_code}`
    : post.state_code || "Location TBD";

  const isActive = post.status === "active" && post.is_accepting_responses;

  return (
    <>
      <div className="container py-6 max-w-3xl">
        {/* Back button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/dashboard")}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>

        <Card className="border-border">
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant={isActive ? "default" : "secondary"}>
                    {isActive ? "Active" : post.status}
                  </Badge>
                  {post.requires_background_check && (
                    <Badge variant="outline" className="border-amber-500 text-amber-600 dark:text-amber-400">
                      <Shield className="h-3 w-3 mr-1" />
                      Background Check Required
                    </Badge>
                  )}
                </div>
                <CardTitle className="text-xl">{post.title}</CardTitle>
                <CardDescription className="flex items-center gap-2 mt-2">
                  <Building2 className="h-4 w-4" />
                  {vendor.company_name || vendor.anonymous_id || "Vendor"}
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Location & Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span>{locationText}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>Posted {format(parseISO(post.created_at), "MMM d, yyyy")}</span>
              </div>
            </div>

            {/* Pay - Rep view: show rate match status based on actual matching logic */}
            {rateMatchStatus.matches ? (
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  <span className="font-semibold text-lg text-emerald-700 dark:text-emerald-300">
                    {rateMatchStatus.message}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {rateMatchStatus.subMessage}
                </p>
              </div>
            ) : (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                  <span className="font-semibold text-lg text-amber-700 dark:text-amber-300">
                    {rateMatchStatus.message}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {rateMatchStatus.subMessage}
                </p>
              </div>
            )}

            {/* Description */}
            {post.description && (
              <div>
                <h4 className="font-medium mb-2">Description</h4>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {post.description}
                </p>
              </div>
            )}

            {/* Inspection Types */}
            {post.inspection_types?.length > 0 && (
              <div>
                <h4 className="font-medium mb-2">Inspection Types</h4>
                <div className="flex flex-wrap gap-2">
                  {post.inspection_types.map((type, i) => (
                    <Badge key={i} variant="secondary">{type}</Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Systems Required */}
            {post.systems_required_array?.length > 0 && (
              <div>
                <h4 className="font-medium mb-2">Systems Required</h4>
                <div className="flex flex-wrap gap-2">
                  {post.systems_required_array.map((sys, i) => (
                    <Badge key={i} variant="outline">{sys}</Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Expiration */}
            {post.expires_at && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>Expires {format(parseISO(post.expires_at), "MMM d, yyyy")}</span>
              </div>
            )}

            {/* Action Button */}
            <div className="pt-4 border-t border-border">
              {hasExpressedInterest ? (
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle className="h-5 w-5" />
                  <span className="font-medium">You've expressed interest in this opportunity</span>
                </div>
              ) : isActive ? (
                <Button
                  onClick={() => setInterestDialogOpen(true)}
                  className="w-full sm:w-auto"
                >
                  I'm Interested
                </Button>
              ) : (
                <p className="text-sm text-muted-foreground">
                  This post is no longer accepting responses.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Express Interest Dialog */}
        {repProfile && (
          <ExpressInterestDialog
            open={interestDialogOpen}
            onOpenChange={setInterestDialogOpen}
            post={{
              id: post.id,
              title: post.title,
              state_code: post.state_code,
              county: post.us_counties || null,
              vendor_id: post.vendor_id,
            }}
            repProfile={repProfile}
            coverageAreas={coverageAreas}
            onInterestExpressed={handleInterestExpressed}
          />
        )}
      </div>
    </>
  );
}
