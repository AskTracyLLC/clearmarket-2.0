import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Eye, MessageSquare, Building2 } from "lucide-react";
import { getOrCreateConversation } from "@/lib/conversations";
import { PublicProfileDialog } from "@/components/PublicProfileDialog";

interface ConnectedVendor {
  vendorUserId: string;
  anonymousId: string;
  companyName: string;
  firstName: string;
  lastInitial: string;
  city: string | null;
  state: string | null;
  systemsUsed: string[];
  inspectionTypes: string[];
  isAcceptingNewReps: boolean;
  connectedPosts: Array<{
    id: string;
    title: string;
    stateCode: string | null;
  }>;
  conversationId?: string;
}

const RepMyVendors = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [connectedVendors, setConnectedVendors] = useState<ConnectedVendor[]>([]);
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [selectedVendorUserId, setSelectedVendorUserId] = useState<string | null>(null);
  const [repProfileId, setRepProfileId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/signin");
      return;
    }

    if (user) {
      checkAccess();
    }
  }, [user, authLoading, navigate]);

  const checkAccess = async () => {
    if (!user) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("is_fieldrep")
      .eq("id", user.id)
      .single();

    if (!profile?.is_fieldrep) {
      toast({
        title: "Access Denied",
        description: "This page is only available to field rep accounts.",
        variant: "destructive",
      });
      navigate("/dashboard");
      return;
    }

    // Get rep_profile.id for querying rep_interest
    const { data: repProfile } = await supabase
      .from("rep_profile")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!repProfile) {
      toast({
        title: "Profile Not Found",
        description: "Please complete your rep profile first.",
        variant: "destructive",
      });
      navigate("/rep/profile");
      return;
    }

    setRepProfileId(repProfile.id);
    loadConnectedVendors(repProfile.id);
  };

  const loadConnectedVendors = async (repId: string) => {
    if (!user) return;

    try {
      // Get all connected rep_interest entries for this rep
      const { data: interests, error } = await supabase
        .from("rep_interest")
        .select(`
          id,
          status,
          created_at,
          seeking_coverage_posts:post_id (
            id,
            title,
            vendor_id,
            state_code,
            vendor_profile:vendor_id (
              user_id,
              anonymous_id,
              company_name,
              city,
              state,
              systems_used,
              primary_inspection_types,
              is_accepting_new_reps,
              profiles:profiles!vendor_profile_user_id_fkey ( full_name )
            )
          )
        `)
        .eq("rep_id", repId)
        .eq("status", "connected");

      if (error) {
        console.error("Error loading connected vendors:", error);
        toast({
          title: "Error",
          description: "Failed to load your connected vendors.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // Deduplicate by vendor user_id and aggregate posts
      const vendorsMap = new Map<string, ConnectedVendor>();

      for (const interest of interests || []) {
        const post = interest.seeking_coverage_posts as any;
        
        if (!post || !post.vendor_profile) continue;

        const vendorProfile = post.vendor_profile;
        const vendorUserId = vendorProfile.user_id;

        if (!vendorsMap.has(vendorUserId)) {
          const fullName = vendorProfile.profiles?.full_name || "";
          const nameParts = fullName.split(" ");
          const firstName = nameParts[0] || "";
          const lastInitial = nameParts.length > 1 ? nameParts[nameParts.length - 1].charAt(0) : "";

          vendorsMap.set(vendorUserId, {
            vendorUserId,
            anonymousId: vendorProfile.anonymous_id || `Vendor#${vendorUserId.substring(0, 6)}`,
            companyName: vendorProfile.company_name || "Vendor",
            firstName,
            lastInitial,
            city: vendorProfile.city,
            state: vendorProfile.state,
            systemsUsed: vendorProfile.systems_used || [],
            inspectionTypes: vendorProfile.primary_inspection_types || [],
            isAcceptingNewReps: vendorProfile.is_accepting_new_reps ?? true,
            connectedPosts: [],
          });
        }

        // Add this post to the vendor's connected posts
        const vendor = vendorsMap.get(vendorUserId)!;
        vendor.connectedPosts.push({
          id: post.id,
          title: post.title,
          stateCode: post.state_code,
        });
      }

      // Convert map to array and fetch conversation IDs
      const vendorsArray = Array.from(vendorsMap.values());

      // For each vendor, check if conversation exists
      for (const vendor of vendorsArray) {
        const [p1, p2] = [user.id, vendor.vendorUserId].sort();
        const { data: conv } = await supabase
          .from("conversations")
          .select("id")
          .eq("participant_one", p1)
          .eq("participant_two", p2)
          .maybeSingle();

        if (conv) {
          vendor.conversationId = conv.id;
        }
      }

      setConnectedVendors(vendorsArray);
    } catch (error) {
      console.error("Error in loadConnectedVendors:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewProfile = (vendorUserId: string) => {
    setSelectedVendorUserId(vendorUserId);
    setProfileDialogOpen(true);
  };

  const handleMessage = async (vendorUserId: string, conversationId?: string) => {
    if (conversationId) {
      navigate(`/messages/${conversationId}`);
      return;
    }

    // Create conversation
    const result = await getOrCreateConversation(user!.id, vendorUserId);
    if (result.error) {
      toast({
        title: "Error",
        description: result.error,
        variant: "destructive",
      });
      return;
    }

    navigate(`/messages/${result.id}`);
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg text-muted-foreground">Loading your network...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="mb-6 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">My Vendors</h1>
            <p className="text-muted-foreground mt-1">
              Vendors you've connected with through Seeking Coverage.
            </p>
          </div>
        </div>

        {connectedVendors.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center">
              <Building2 className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">No connections yet</h3>
              <p className="text-muted-foreground mb-4">
                When you express interest and vendors mark you as Connected, they'll appear here.
              </p>
              <Button onClick={() => navigate("/rep/find-work")}>
                Find Work
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {connectedVendors.map((vendor) => (
              <Card key={vendor.vendorUserId}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <button
                          onClick={() => handleViewProfile(vendor.vendorUserId)}
                          className="text-primary hover:underline font-semibold text-lg flex items-center gap-2"
                        >
                          {vendor.anonymousId}
                          <Eye className="w-4 h-4" />
                        </button>
                      </div>
                      <p className="text-sm font-medium">{vendor.companyName}</p>
                      <p className="text-xs text-muted-foreground">
                        {vendor.firstName} {vendor.lastInitial}.
                      </p>
                      {(vendor.city || vendor.state) && (
                        <p className="text-sm text-muted-foreground">
                          {vendor.city && vendor.state ? `${vendor.city}, ${vendor.state}` : vendor.city || vendor.state}
                        </p>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Systems and Inspection Types */}
                  <div className="space-y-2">
                    {vendor.systemsUsed.length > 0 && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Systems Used:</p>
                        <div className="flex flex-wrap gap-1">
                          {vendor.systemsUsed.slice(0, 4).map((system, idx) => (
                            <Badge key={idx} variant="secondary" className="text-xs">
                              {system}
                            </Badge>
                          ))}
                          {vendor.systemsUsed.length > 4 && (
                            <Badge variant="outline" className="text-xs">
                              +{vendor.systemsUsed.length - 4} more
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}
                    {vendor.inspectionTypes.length > 0 && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Inspection Types:</p>
                        <div className="flex flex-wrap gap-1">
                          {vendor.inspectionTypes.slice(0, 4).map((type, idx) => (
                            <Badge key={idx} variant="secondary" className="text-xs">
                              {type}
                            </Badge>
                          ))}
                          {vendor.inspectionTypes.length > 4 && (
                            <Badge variant="outline" className="text-xs">
                              +{vendor.inspectionTypes.length - 4} more
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Availability */}
                  <div className="text-sm">
                    <span className="text-muted-foreground">Accepting new reps: </span>
                    <span className={vendor.isAcceptingNewReps ? "text-green-500" : "text-muted-foreground"}>
                      {vendor.isAcceptingNewReps ? "Yes" : "No"}
                    </span>
                  </div>

                  {/* Connected Posts */}
                  <div>
                    <p className="text-sm font-medium mb-2">
                      Connected on {vendor.connectedPosts.length} post{vendor.connectedPosts.length !== 1 ? "s" : ""}
                    </p>
                    <div className="space-y-1">
                      {vendor.connectedPosts.slice(0, 2).map((post) => (
                        <p key={post.id} className="text-xs text-muted-foreground">
                          {post.stateCode ? `${post.stateCode} – ` : ""}{post.title}
                        </p>
                      ))}
                      {vendor.connectedPosts.length > 2 && (
                        <p className="text-xs text-muted-foreground">
                          +{vendor.connectedPosts.length - 2} more
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewProfile(vendor.vendorUserId)}
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      View Profile
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => handleMessage(vendor.vendorUserId, vendor.conversationId)}
                    >
                      <MessageSquare className="w-4 h-4 mr-2" />
                      Message Vendor
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {selectedVendorUserId && (
        <PublicProfileDialog
          open={profileDialogOpen}
          onOpenChange={setProfileDialogOpen}
          targetUserId={selectedVendorUserId}
        />
      )}
    </div>
  );
};

export default RepMyVendors;
