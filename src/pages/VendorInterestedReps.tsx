import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, MapPin, CheckCircle2, XCircle, Star, User, MessageSquare } from "lucide-react";

interface InterestedRep {
  id: string; // rep_interest.id
  rep_id: string;
  status: string;
  created_at: string;
  rep_profile: {
    user_id: string;
    anonymous_id: string | null;
    city: string | null;
    state: string | null;
    zip_code: string | null;
    systems_used: string[] | null;
    inspection_types: string[] | null;
    is_accepting_new_vendors: boolean | null;
    willing_to_travel_out_of_state: boolean | null;
    profiles: {
      full_name: string | null;
    } | null;
  };
  rep_coverage_areas: {
    base_price: number | null;
    rush_price: number | null;
  }[];
  all_state_coverage: {
    county_name: string | null;
    state_code: string;
    state_name: string;
    base_price: number | null;
    rush_price: number | null;
  }[];
}

interface SeekingCoveragePost {
  id: string;
  title: string;
  state_code: string | null;
  county_id: string | null;
  pay_type: string;
  pay_min: number | null;
  pay_max: number | null;
  pay_notes: string | null;
  vendor_id: string;
}

export default function VendorInterestedReps() {
  const navigate = useNavigate();
  const { postId } = useParams<{ postId: string }>();
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [post, setPost] = useState<SeekingCoveragePost | null>(null);
  const [interestedReps, setInterestedReps] = useState<InterestedRep[]>([]);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [selectedRep, setSelectedRep] = useState<InterestedRep | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/signin");
      return;
    }

    if (user && postId) {
      loadData();
    }
  }, [user, authLoading, postId, navigate]);

  const getFirstNameLastInitial = (fullName: string | null): string => {
    if (!fullName) return "";
    const parts = fullName.trim().split(" ");
    if (parts.length === 0) return "";
    if (parts.length === 1) return parts[0];
    const firstName = parts[0];
    const lastInitial = parts[parts.length - 1].charAt(0).toUpperCase();
    return `${firstName} ${lastInitial}.`;
  };

  const loadData = async () => {
    if (!user || !postId) return;

    try {
      // Load the seeking coverage post
      const { data: postData, error: postError } = await supabase
        .from("seeking_coverage_posts")
        .select("*")
        .eq("id", postId)
        .single();

      if (postError) throw postError;

      // Verify vendor owns this post
      if (postData.vendor_id !== user.id) {
        toast.error("You don't have permission to view this post");
        navigate("/vendor/seeking-coverage");
        return;
      }

      setPost(postData);

      // Load interested reps with their profiles and coverage for this county
      const { data: interestData, error: interestError } = await supabase
        .from("rep_interest")
        .select(`
          id,
          rep_id,
          status,
          created_at,
          rep_profile!inner (
            user_id,
            anonymous_id,
            city,
            state,
            zip_code,
            systems_used,
            inspection_types,
            is_accepting_new_vendors,
            willing_to_travel_out_of_state,
            profiles:user_id (
              full_name
            )
          )
        `)
        .eq("post_id", postId)
        .order("created_at", { ascending: false });

      if (interestError) throw interestError;

      // For each interested rep, get their coverage area pricing for this county AND all counties in this state
      const repsWithCoverage = await Promise.all(
        (interestData || []).map(async (interest: any) => {
          // Get coverage for the specific county of this post
          const { data: coverageData } = await supabase
            .from("rep_coverage_areas")
            .select("base_price, rush_price")
            .eq("user_id", interest.rep_profile.user_id)
            .eq("county_id", postData.county_id || null);

          const { data: allStateCoverageRaw, error: allStateError } = await supabase
            .from("rep_coverage_areas")
            .select(`
              base_price,
              rush_price,
              state_code,
              state_name,
              county_name,
              county_id,
              us_counties:county_id (
                county_name,
                state_code,
                state_name
              )
            `)
            .eq("user_id", interest.rep_profile.user_id);

          if (allStateError) {
            console.error("Error fetching all-state coverage:", allStateError);
          }

          const normalizedAllStateCoverage =
            (allStateCoverageRaw || [])
              .filter(row => {
                const rowState =
                  row.us_counties?.state_code || row.state_code;
                return rowState === postData.state_code;
              })
              .map(row => ({
                county_name: row.us_counties?.county_name || row.county_name || null,
                state_code: row.us_counties?.state_code || row.state_code || "",
                state_name: row.us_counties?.state_name || row.state_name || "",
                base_price: row.base_price ?? null,
                rush_price: row.rush_price ?? null,
              }));

          return {
            ...interest,
            rep_coverage_areas: coverageData || [],
            all_state_coverage: normalizedAllStateCoverage,
          };
        })
      );

      setInterestedReps(repsWithCoverage as InterestedRep[]);
    } catch (error: any) {
      console.error("Error loading data:", error);
      toast.error("Failed to load interested reps");
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (interestId: string, newStatus: string) => {
    setUpdatingStatus(interestId);

    try {
      const { error } = await supabase
        .from("rep_interest")
        .update({ status: newStatus })
        .eq("id", interestId);

      if (error) throw error;

      toast.success("Rep status updated");
      loadData(); // Reload to reflect changes
    } catch (error: any) {
      console.error("Error updating status:", error);
      toast.error("Failed to update status");
    } finally {
      setUpdatingStatus(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "interested":
        return <Badge variant="secondary">Interested</Badge>;
      case "shortlisted":
        return <Badge className="bg-primary/20 text-primary border-primary/30">Shortlisted</Badge>;
      case "declined":
        return <Badge variant="outline" className="text-muted-foreground">Declined</Badge>;
      case "connected":
        return <Badge className="bg-green-600/20 text-green-600 border-green-600/30">Connected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleViewProfile = (rep: InterestedRep) => {
    setSelectedRep(rep);
    setIsProfileModalOpen(true);
  };

  const handleMessageRep = async (repUserId: string) => {
    if (!user || !post) return;

    try {
      const { getOrCreateConversation } = await import("@/lib/conversations");
      const result = await getOrCreateConversation(user.id, repUserId, {
        type: "seeking_coverage",
        postId: post.id,
      });
      
      if (result.error) {
        toast.error(result.error);
        return;
      }

      // Navigate to the conversation
      navigate(`/messages/${result.id}`);
    } catch (error) {
      console.error("Error starting conversation:", error);
      toast.error("Failed to start conversation");
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!post) {
    return null;
  }

  const vendorPay = post.pay_max !== null && post.pay_max !== undefined 
    ? post.pay_max 
    : post.pay_min;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-8">
              <Link to="/" className="text-xl font-bold text-foreground hover:text-primary transition-colors">
                ClearMarket
              </Link>
            </div>
            <Link to="/vendor/seeking-coverage">
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Seeking Coverage
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-12 max-w-6xl">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-2">Interested Field Reps</h1>
          <p className="text-muted-foreground mb-4">
            For: <span className="font-semibold">{post.title}</span>
          </p>
          <p className="text-sm text-muted-foreground">
            These reps expressed interest in this request. You can shortlist or decline them. 
            Contact and connection workflows will be added in a later phase.
          </p>
        </div>

        {/* Post Info Card */}
        <Card className="mb-8 bg-card-elevated">
          <CardHeader>
            <CardTitle className="text-lg">Your Offer</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Pricing:</p>
                <p className="text-lg font-semibold text-primary">
                  {post.pay_type === "fixed" 
                    ? `$${post.pay_min?.toFixed(2)} / order`
                    : `$${post.pay_min?.toFixed(2)} – $${post.pay_max?.toFixed(2)} / order`
                  }
                </p>
                {post.pay_notes && (
                  <p className="text-xs text-muted-foreground mt-1 italic">{post.pay_notes}</p>
                )}
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Location:</p>
                <p className="text-sm">{post.state_code}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Interested Reps List */}
        {interestedReps.length === 0 ? (
          <Card className="p-12 text-center border-2 border-dashed">
            <div className="max-w-md mx-auto">
              <h3 className="text-xl font-semibold text-foreground mb-2">
                No interested reps yet
              </h3>
              <p className="text-muted-foreground mb-6">
                Reps who express interest in this post will appear here.
              </p>
              <Button variant="outline" onClick={() => navigate("/vendor/seeking-coverage")}>
                Back to Seeking Coverage
              </Button>
            </div>
          </Card>
        ) : (
          <div className="space-y-4">
            {interestedReps.map((interest) => {
              const repCoverage = interest.rep_coverage_areas[0];
              const repMinimum = repCoverage?.base_price;

              return (
                <Card key={interest.id} className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-semibold text-foreground">
                          {interest.rep_profile.anonymous_id || "FieldRep"}
                        </h3>
                        {getStatusBadge(interest.status)}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                        <MapPin className="h-4 w-4" />
                        {interest.rep_profile.city}, {interest.rep_profile.state}
                        {interest.rep_profile.zip_code && ` ${interest.rep_profile.zip_code}`}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Expressed interest on {new Date(interest.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  {/* Systems */}
                  {interest.rep_profile.systems_used && interest.rep_profile.systems_used.length > 0 && (
                    <div className="mb-3">
                      <p className="text-xs text-muted-foreground mb-2">Systems Used:</p>
                      <div className="flex flex-wrap gap-2">
                        {interest.rep_profile.systems_used.slice(0, 5).map((system, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs">
                            {system}
                          </Badge>
                        ))}
                        {interest.rep_profile.systems_used.length > 5 && (
                          <Badge variant="outline" className="text-xs">
                            +{interest.rep_profile.systems_used.length - 5} more
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Inspection Types */}
                  {interest.rep_profile.inspection_types && interest.rep_profile.inspection_types.length > 0 && (
                    <div className="mb-4">
                      <p className="text-xs text-muted-foreground mb-2">Inspection Types:</p>
                      <div className="flex flex-wrap gap-2">
                        {interest.rep_profile.inspection_types.map((type, idx) => (
                          <Badge key={idx} variant="secondary" className="text-xs">
                            {type}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Pricing Section */}
                  <div className="mb-4 p-3 bg-muted/30 rounded-lg">
                    <p className="text-xs text-muted-foreground mb-2">Pricing for this county:</p>
                    {repCoverage ? (
                      <>
                        <div className="space-y-1">
                          <p className="text-sm">
                            Base Rate: <span className="font-semibold">${repCoverage.base_price?.toFixed(2) || "Not set"}</span>
                          </p>
                          {repCoverage.rush_price && (
                            <p className="text-sm">
                              Rush Rate: <span className="font-semibold">${repCoverage.rush_price.toFixed(2)}</span>
                            </p>
                          )}
                        </div>
                        {vendorPay && repMinimum && (
                          <>
                            <div className="mt-2 pt-2 border-t border-border/50">
                              <p className="text-sm">
                                Your offer: <span className="font-semibold">${vendorPay.toFixed(2)}</span> / order
                              </p>
                            </div>
                            {vendorPay >= repMinimum && (
                              <p className="text-xs text-green-600 mt-1">✓ Pricing aligned with this rep's minimum</p>
                            )}
                          </>
                        )}
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">Base Rate: Not set</p>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2 pt-4 border-t border-border">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewProfile(interest)}
                    >
                      <User className="h-4 w-4 mr-2" />
                      View Profile
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleMessageRep(interest.rep_profile.user_id)}
                    >
                      <MessageSquare className="h-4 w-4 mr-2" />
                      Message Rep
                    </Button>
                  </div>

                  {/* Status Management Buttons */}
                  <div className="flex gap-2 pt-2">
                    {interest.status === "interested" && (
                      <>
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => handleStatusUpdate(interest.id, "shortlisted")}
                          disabled={updatingStatus === interest.id}
                        >
                          <Star className="h-4 w-4 mr-2" />
                          Shortlist
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleStatusUpdate(interest.id, "declined")}
                          disabled={updatingStatus === interest.id}
                        >
                          <XCircle className="h-4 w-4 mr-2" />
                          Decline
                        </Button>
                      </>
                    )}
                    {interest.status === "shortlisted" && (
                      <>
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => handleStatusUpdate(interest.id, "connected")}
                          disabled={updatingStatus === interest.id}
                        >
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          Mark Connected
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleStatusUpdate(interest.id, "declined")}
                          disabled={updatingStatus === interest.id}
                        >
                          <XCircle className="h-4 w-4 mr-2" />
                          Decline
                        </Button>
                      </>
                    )}
                    {interest.status === "declined" && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleStatusUpdate(interest.id, "interested")}
                        disabled={updatingStatus === interest.id}
                      >
                        Restore to Interested
                      </Button>
                    )}
                    {interest.status === "connected" && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleStatusUpdate(interest.id, "interested")}
                        disabled={updatingStatus === interest.id}
                      >
                        Reset to Interested
                      </Button>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Rep Profile Preview Modal */}
      <Dialog open={isProfileModalOpen} onOpenChange={setIsProfileModalOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="space-y-1">
              <div className="text-2xl font-bold">
                {selectedRep?.rep_profile.anonymous_id || "Field Rep Profile"}
              </div>
              {selectedRep?.rep_profile.profiles?.full_name && (
                <div className="text-base font-normal text-muted-foreground">
                  {getFirstNameLastInitial(selectedRep.rep_profile.profiles.full_name)}
                </div>
              )}
            </DialogTitle>
          </DialogHeader>

          {selectedRep && (
            <div className="space-y-6">
              {/* Location */}
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-2">Location</h3>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  {selectedRep.rep_profile.city}, {selectedRep.rep_profile.state}
                  {selectedRep.rep_profile.zip_code && ` ${selectedRep.rep_profile.zip_code}`}
                </div>
              </div>

              {/* Systems Used */}
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-2">Systems I Use</h3>
                {selectedRep.rep_profile.systems_used && selectedRep.rep_profile.systems_used.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {selectedRep.rep_profile.systems_used.map((system, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs">
                        {system}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">This rep has not completed this section yet.</p>
                )}
              </div>

              {/* Inspection Types */}
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-2">Inspection Types</h3>
                {selectedRep.rep_profile.inspection_types && selectedRep.rep_profile.inspection_types.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {selectedRep.rep_profile.inspection_types.map((type, idx) => (
                      <Badge key={idx} variant="secondary" className="text-xs">
                        {type}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">This rep has not completed this section yet.</p>
                )}
              </div>

              {/* Coverage Snapshot */}
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-2">Coverage Snapshot</h3>
                {selectedRep.all_state_coverage.length > 0 ? (
                  <>
                    <p className="text-sm text-muted-foreground mb-3">
                      This rep covers the following areas in {selectedRep.all_state_coverage[0].state_code} – {selectedRep.all_state_coverage[0].state_name}:
                    </p>
                    <div className="space-y-2">
                      {/* Check if rep covers the exact county from this post */}
                      {selectedRep.rep_coverage_areas.length > 0 && selectedRep.rep_coverage_areas[0].base_price !== null && (
                        <div className="space-y-1">
                          <p className="text-sm">
                            • {selectedRep.all_state_coverage.find(c => c.county_name)?.county_name || "This county"} <span className="text-primary font-medium">(matches this request)</span>
                          </p>
                          <p className="text-xs text-muted-foreground ml-4">
                            Rep Base Rate in this county: <span className="font-semibold text-foreground">
                              ${selectedRep.rep_coverage_areas[0].base_price.toFixed(2)}
                            </span>
                            {selectedRep.rep_coverage_areas[0].rush_price && (
                              <> • Rush: ${selectedRep.rep_coverage_areas[0].rush_price.toFixed(2)}</>
                            )}
                          </p>
                        </div>
                      )}
                      
                      {/* Show other counties if they exist */}
                      {selectedRep.all_state_coverage.length > 1 && (
                        <p className="text-sm">
                          • Also covers: {selectedRep.all_state_coverage
                            .filter((_, idx) => idx > 0 || selectedRep.rep_coverage_areas.length === 0)
                            .map(c => c.county_name)
                            .filter(Boolean)
                            .join(", ")}
                        </p>
                      )}
                      
                      {selectedRep.all_state_coverage.length === 1 && selectedRep.rep_coverage_areas.length === 0 && (
                        <p className="text-sm">
                          • {selectedRep.all_state_coverage[0].county_name}
                        </p>
                      )}
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground italic">
                    This rep has not configured coverage in {post?.state_code} yet.
                  </p>
                )}
              </div>

              {/* Availability & Preferences */}
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-2">Availability & Preferences</h3>
                <div className="space-y-1 text-sm">
                  <p>
                    Accepting New Vendors: <span className="font-medium">
                      {selectedRep.rep_profile.is_accepting_new_vendors ? "Yes" : "No"}
                    </span>
                  </p>
                  <p>
                    Willing to Travel Out of State: <span className="font-medium">
                      {selectedRep.rep_profile.willing_to_travel_out_of_state ? "Yes" : "No"}
                    </span>
                  </p>
                </div>
              </div>

              {/* Status */}
              {selectedRep.status === "connected" && (
                <div className="p-3 bg-green-600/10 border border-green-600/20 rounded-lg">
                  <p className="text-sm text-green-600">
                    ✓ Status: Connected on this Seeking Coverage post
                  </p>
                </div>
              )}

              {/* Start Conversation Button */}
              <div className="pt-4 border-t border-border">
                <Button
                  className="w-full"
                  onClick={() => handleMessageRep(selectedRep.rep_profile.user_id)}
                >
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Start Conversation
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
