import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Building2, Check, X } from "lucide-react";
import AdminViewBanner from "@/components/AdminViewBanner";
import { PublicProfileDialog } from "@/components/PublicProfileDialog";
import WorkingTermsPendingCard from "@/components/WorkingTermsPendingCard";
import { fetchPendingWorkingTermsRequests, WorkingTermsRequest } from "@/lib/workingTerms";
import { ConnectedVendorsTable } from "@/components/ConnectedVendorsTable";
import { MyVendorContacts } from "@/components/MyVendorContacts";

interface ConnectedVendor {
  vendorUserId: string;
  anonymousId: string;
  companyName: string;
  city: string | null;
  state: string | null;
  connectedAt?: string | null;
  conversationId?: string;
  hasActiveWorkingTerms?: boolean;
}

interface PendingRequest {
  interestId: string;
  vendorUserId: string;
  anonymousId: string;
  companyName: string;
  firstName: string;
  lastInitial: string;
  city: string | null;
  state: string | null;
  postTitle: string;
  postStateCode: string | null;
  postId: string;
}

const RepMyVendors = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<{ is_fieldrep: boolean; is_admin: boolean } | null>(null);
  const [connectedVendors, setConnectedVendors] = useState<ConnectedVendor[]>([]);
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [selectedVendorUserId, setSelectedVendorUserId] = useState<string | null>(null);
  const [repProfileId, setRepProfileId] = useState<string | null>(null);
  const [acceptingRequest, setAcceptingRequest] = useState<string | null>(null);
  const [decliningRequest, setDecliningRequest] = useState<string | null>(null);
  const [pendingWorkingTerms, setPendingWorkingTerms] = useState<WorkingTermsRequest[]>([]);
  const [workingTermsVendorNames, setWorkingTermsVendorNames] = useState<Record<string, string>>({});

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

    const { data: profileData } = await supabase
      .from("profiles")
      .select("is_fieldrep, is_admin")
      .eq("id", user.id)
      .single();

    setProfile(profileData);

    if (!profileData?.is_fieldrep && !profileData?.is_admin) {
      toast({
        title: "Access Denied",
        description: "This page is only available to field rep accounts.",
        variant: "destructive",
      });
      navigate("/dashboard");
      return;
    }

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
    loadPendingRequests(repProfile.id);
    loadConnectedVendors();
    loadPendingWorkingTerms();
  };

  const loadPendingWorkingTerms = async () => {
    if (!user) return;
    
    const requests = await fetchPendingWorkingTermsRequests(user.id, 'rep');
    setPendingWorkingTerms(requests);
    
    if (requests.length > 0) {
      const vendorIds = [...new Set(requests.map(r => r.vendor_id))];
      const { data: vendors } = await supabase
        .from("vendor_profile")
        .select("user_id, company_name, anonymous_id")
        .in("user_id", vendorIds);
      
      const names: Record<string, string> = {};
      vendors?.forEach(v => {
        names[v.user_id] = v.company_name || v.anonymous_id || 'Vendor';
      });
      setWorkingTermsVendorNames(names);
    }
  };

  const loadPendingRequests = async (repId: string) => {
    if (!user) return;

    try {
      const { data: interests, error } = await supabase
        .from("rep_interest")
        .select(`
          id,
          seeking_coverage_posts:post_id (
            id,
            title,
            vendor_id,
            state_code
          )
        `)
        .eq("rep_id", repId)
        .eq("status", "pending_rep_confirm");

      if (error) return;

      const requests: PendingRequest[] = [];
      const vendorIds = new Set<string>();

      for (const interest of interests || []) {
        const post = interest.seeking_coverage_posts as any;
        if (!post || !post.vendor_id) continue;

        vendorIds.add(post.vendor_id);
        requests.push({
          interestId: interest.id,
          vendorUserId: post.vendor_id,
          anonymousId: `Vendor#${post.vendor_id.substring(0, 6)}`,
          companyName: "Vendor",
          firstName: "",
          lastInitial: "",
          city: null,
          state: null,
          postTitle: post.title,
          postStateCode: post.state_code,
          postId: post.id,
        });
      }

      if (vendorIds.size > 0) {
        const { data: vendorProfiles } = await supabase
          .from("vendor_profile")
          .select(`
            user_id,
            anonymous_id,
            company_name,
            city,
            state,
            profiles:user_id (
              full_name
            )
          `)
          .in("user_id", Array.from(vendorIds));

        if (vendorProfiles) {
          for (const vendorProfile of vendorProfiles) {
            const fullName = (vendorProfile.profiles as any)?.full_name || "";
            const nameParts = fullName.split(" ");
            const firstName = nameParts[0] || "";
            const lastInitial = nameParts.length > 1 ? nameParts[nameParts.length - 1].charAt(0) : "";

            requests.forEach(req => {
              if (req.vendorUserId === vendorProfile.user_id) {
                req.anonymousId = vendorProfile.anonymous_id || req.anonymousId;
                req.companyName = vendorProfile.company_name || req.companyName;
                req.firstName = firstName;
                req.lastInitial = lastInitial;
                req.city = vendorProfile.city;
                req.state = vendorProfile.state;
              }
            });
          }
        }
      }

      setPendingRequests(requests);
    } catch (error) {
      console.error("Error in loadPendingRequests:", error);
    }
  };

  const loadConnectedVendors = async () => {
    if (!user) return;

    try {
      const { data: connections, error } = await supabase
        .from("vendor_connections")
        .select("id, vendor_id, requested_at")
        .eq("field_rep_id", user.id)
        .eq("status", "connected");

      if (error || !connections || connections.length === 0) {
        setLoading(false);
        return;
      }

      const vendorUserIds = connections.map(c => c.vendor_id);

      // Get vendor profiles
      const { data: vendorProfiles } = await supabase
        .from("vendor_profile")
        .select(`
          user_id,
          anonymous_id,
          company_name,
          city,
          state
        `)
        .in("user_id", vendorUserIds);

      // Get agreements
      const { data: agreements } = await supabase
        .from("vendor_rep_agreements")
        .select("vendor_id, created_at")
        .eq("field_rep_id", user.id)
        .eq("status", "active")
        .in("vendor_id", vendorUserIds);

      // Get working terms
      const { data: workingTerms } = await supabase
        .from("working_terms_rows")
        .select("vendor_id, status")
        .eq("rep_id", user.id)
        .eq("status", "active")
        .in("vendor_id", vendorUserIds);

      const workingTermsSet = new Set(workingTerms?.map(w => w.vendor_id) || []);

      const agreementMap = new Map();
      (agreements || []).forEach(a => {
        agreementMap.set(a.vendor_id, a);
      });

      // Get conversations
      const vendorsArray: ConnectedVendor[] = [];

      for (const connection of connections) {
        const vendorProfile = vendorProfiles?.find(p => p.user_id === connection.vendor_id);
        if (!vendorProfile) continue;

        const agreement = agreementMap.get(connection.vendor_id);

        // Get conversation
        const [p1, p2] = [user.id, connection.vendor_id].sort();
        const { data: conv } = await supabase
          .from("conversations")
          .select("id")
          .eq("participant_one", p1)
          .eq("participant_two", p2)
          .maybeSingle();

        vendorsArray.push({
          vendorUserId: connection.vendor_id,
          anonymousId: vendorProfile.anonymous_id || `Vendor#${connection.vendor_id.substring(0, 6)}`,
          companyName: vendorProfile.company_name || "Vendor",
          city: vendorProfile.city,
          state: vendorProfile.state,
          connectedAt: agreement?.created_at || connection.requested_at,
          conversationId: conv?.id,
          hasActiveWorkingTerms: workingTermsSet.has(connection.vendor_id),
        });
      }

      vendorsArray.sort((a, b) => {
        const aDate = a.connectedAt ?? '';
        const bDate = b.connectedAt ?? '';
        return new Date(bDate).getTime() - new Date(aDate).getTime();
      });

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

  const handleAcceptRequest = async (interestId: string) => {
    setAcceptingRequest(interestId);
    try {
      const { error } = await supabase
        .from("rep_interest")
        .update({ 
          status: "connected",
          connected_at: new Date().toISOString()
        })
        .eq("id", interestId);

      if (error) throw error;

      toast({
        title: "Connection Accepted",
        description: "This vendor is now in your My Vendors list.",
      });

      if (repProfileId) {
        loadPendingRequests(repProfileId);
        loadConnectedVendors();
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to accept connection",
        variant: "destructive",
      });
    } finally {
      setAcceptingRequest(null);
    }
  };

  const handleDeclineRequest = async (interestId: string) => {
    setDecliningRequest(interestId);
    try {
      const { error } = await supabase
        .from("rep_interest")
        .update({ 
          status: "declined",
          connected_at: null
        })
        .eq("id", interestId);

      if (error) throw error;

      toast({
        title: "Connection Declined",
        description: "Connection request has been declined.",
      });

      if (repProfileId) {
        loadPendingRequests(repProfileId);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to decline connection",
        variant: "destructive",
      });
    } finally {
      setDecliningRequest(null);
    }
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-lg text-muted-foreground">Loading your network...</div>
      </div>
    );
  }

  return (
    <>
      <div className="container mx-auto px-4 py-6 md:py-8 max-w-5xl">
        {profile?.is_admin && <AdminViewBanner />}
        
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">My Vendors</h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">
            Your active vendor connections and offline contacts.
          </p>
        </div>

        {/* Connection Requests Section */}
        {pendingRequests.length > 0 && (
          <div className="mb-6 md:mb-8">
            <h2 className="text-lg md:text-xl font-semibold text-foreground mb-3 md:mb-4">Connection Requests</h2>
            <div className="space-y-3">
              {pendingRequests.map((request) => (
                <Card key={request.interestId} className="bg-amber-500/5 border-amber-500/30">
                  <CardContent className="p-4">
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-3 md:gap-4">
                      <div className="flex-1 min-w-0">
                        <button
                          onClick={() => handleViewProfile(request.vendorUserId)}
                          className="text-primary hover:underline font-semibold text-sm"
                        >
                          {request.anonymousId}
                        </button>
                        <p className="text-sm font-medium text-foreground">{request.companyName}</p>
                        {(request.city || request.state) && (
                          <p className="text-xs text-muted-foreground">
                            {request.city && request.state ? `${request.city}, ${request.state}` : request.city || request.state}
                          </p>
                        )}
                        <p className="text-xs text-amber-600 mt-2 font-medium">
                          Wants to connect via: {request.postTitle} ({request.postStateCode})
                        </p>
                      </div>
                      <div className="flex gap-2 self-end md:self-start">
                        <Button
                          onClick={() => handleAcceptRequest(request.interestId)}
                          disabled={acceptingRequest === request.interestId}
                          size="sm"
                          variant="default"
                        >
                          <Check className="w-4 h-4 mr-1.5" />
                          {acceptingRequest === request.interestId ? "..." : "Accept"}
                        </Button>
                        <Button
                          onClick={() => handleDeclineRequest(request.interestId)}
                          disabled={decliningRequest === request.interestId}
                          size="sm"
                          variant="outline"
                          className="text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground"
                        >
                          <X className="w-4 h-4 mr-1.5" />
                          {decliningRequest === request.interestId ? "..." : "Decline"}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Pending Working Terms Requests Section */}
        {pendingWorkingTerms.length > 0 && (
          <div className="mb-6 md:mb-8">
            <h2 className="text-lg md:text-xl font-semibold text-foreground mb-3 md:mb-4">
              Coverage & Pricing Requests ({pendingWorkingTerms.length})
            </h2>
            <div className="space-y-3">
              {pendingWorkingTerms.map((request) => (
                <WorkingTermsPendingCard
                  key={request.id}
                  request={request}
                  vendorName={workingTermsVendorNames[request.vendor_id]}
                  role="rep"
                />
              ))}
            </div>
          </div>
        )}

        {/* Tabs */}
        <Tabs defaultValue="connected" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="connected">
              Connected Vendors ({connectedVendors.length})
            </TabsTrigger>
            <TabsTrigger value="offline">
              Offline Vendor Contacts
            </TabsTrigger>
          </TabsList>

          <TabsContent value="connected">
            <Card>
              <CardContent className="p-4 md:p-6">
                <ConnectedVendorsTable 
                  vendors={connectedVendors} 
                  currentUserId={user?.id || ""} 
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="offline">
            {user && <MyVendorContacts repUserId={user.id} embedded />}
          </TabsContent>
        </Tabs>
      </div>

      {selectedVendorUserId && (
        <PublicProfileDialog
          open={profileDialogOpen}
          onOpenChange={setProfileDialogOpen}
          targetUserId={selectedVendorUserId}
        />
      )}
    </>
  );
};

export default RepMyVendors;
