import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { ArrowLeft, Eye, MessageSquare, Building2, StickyNote, Edit2, X, Check, Info, Calendar, Clock, DollarSign } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import AdminViewBanner from "@/components/AdminViewBanner";
import { getOrCreateConversation } from "@/lib/conversations";
import { PublicProfileDialog } from "@/components/PublicProfileDialog";
import { ReviewDialog, Review } from "@/components/ReviewDialog";
import { RepExitReviewDialog } from "@/components/RepExitReviewDialog";
import { fetchTrustScoresForUsers } from "@/lib/reviews";
import { ReviewsDetailDialog } from "@/components/ReviewsDetailDialog";
import { fetchBlockedUserIds } from "@/lib/blocks";
import { VendorCalendarDialog, useVendorCalendarSummary } from "@/components/VendorCalendarDialog";
import { format, parseISO } from "date-fns";

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
    interestId: string;
  }>;
  conversationId?: string;
  connectedAt?: string | null;
  notes?: Array<{
    id: string;
    note: string;
    created_at: string;
  }>;
  review?: Review | null;
  // Agreement data (optional overlay)
  agreementId?: string | null;
  coverageSummary?: string | null;
  pricingSummary?: string | null;
  baseRate?: number | null;
  statesCovered?: string[] | null;
  // Trust Score
  trustScore?: number | null;
  trustScoreCount?: number;
  // Community Score
  communityScore?: number;
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
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [hasNotesByVendor, setHasNotesByVendor] = useState<Record<string, boolean>>({});
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editedNoteText, setEditedNoteText] = useState<string>("");
  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false);
  const [disconnectingVendorUserId, setDisconnectingVendorUserId] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const [showExitReviewDialog, setShowExitReviewDialog] = useState(false);
  const [exitReviewVendorUserId, setExitReviewVendorUserId] = useState<string | null>(null);
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [reviewDialogData, setReviewDialogData] = useState<{
    vendorUserId: string;
    repInterestId: string;
    isExitReview: boolean;
    existingReview?: Review | null;
  } | null>(null);
  const [stateFilter, setStateFilter] = useState<string>("all");
  const [showReviewsDialog, setShowReviewsDialog] = useState(false);
  const [reviewsDialogUserId, setReviewsDialogUserId] = useState<string | null>(null);
  const [showCalendarDialog, setShowCalendarDialog] = useState(false);
  const [calendarVendorId, setCalendarVendorId] = useState<string | null>(null);
  const [calendarVendorName, setCalendarVendorName] = useState<string>("");

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
    loadPendingRequests(repProfile.id);
    loadConnectedVendors(repProfile.id);
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

      if (error) {
        console.error("Error loading pending requests:", error);
        return;
      }

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

      // Fetch vendor profiles
      if (vendorIds.size > 0) {
        const { data: vendorProfiles, error: vendorError } = await supabase
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

        if (!vendorError && vendorProfiles) {
          for (const vendorProfile of vendorProfiles) {
            const fullName = (vendorProfile.profiles as any)?.full_name || "";
            const nameParts = fullName.split(" ");
            const firstName = nameParts[0] || "";
            const lastInitial = nameParts.length > 1 ? nameParts[nameParts.length - 1].charAt(0) : "";

            // Update all requests for this vendor
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

  const loadConnectedVendors = async (repId: string) => {
    if (!user) return;

    try {
      // Query vendor_connections as primary source
      const { data: connections, error } = await supabase
        .from("vendor_connections")
        .select("id, vendor_id, field_rep_id, requested_at")
        .eq("field_rep_id", user.id)
        .eq("status", "connected");

      if (error) {
        console.error("Error loading connections:", error);
        toast({
          title: "Error",
          description: "Failed to load your connected vendors.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      if (!connections || connections.length === 0) {
        setLoading(false);
        return;
      }

      // Get vendor IDs
      const vendorUserIds = connections.map(c => c.vendor_id);

      // LEFT JOIN vendor_rep_agreements
      const { data: agreements } = await supabase
        .from("vendor_rep_agreements")
        .select("id, vendor_id, field_rep_id, coverage_summary, pricing_summary, base_rate, states_covered, created_at")
        .eq("field_rep_id", user.id)
        .eq("status", "active")
        .in("vendor_id", vendorUserIds);

      // Build agreement map
      const agreementMap = new Map();
      (agreements || []).forEach(a => {
        agreementMap.set(a.vendor_id, a);
      });

      // Fetch vendor profiles
      const { data: vendorProfiles } = await supabase
        .from("vendor_profile")
        .select(`
          user_id,
          anonymous_id,
          company_name,
          city,
          state,
          systems_used,
          primary_inspection_types,
          is_accepting_new_reps,
          profiles:user_id (
            full_name
          )
        `)
        .in("user_id", vendorUserIds);

      // Build vendors array
      const vendorsArray: ConnectedVendor[] = [];

      for (const connection of connections) {
        const vendorProfile = vendorProfiles?.find(p => p.user_id === connection.vendor_id);
        
        if (!vendorProfile) continue;

        const fullName = (vendorProfile.profiles as any)?.full_name || "";
        const nameParts = fullName.split(" ");
        const firstName = nameParts[0] || "";
        const lastInitial = nameParts.length > 1 ? nameParts[nameParts.length - 1].charAt(0) : "";

        const agreement = agreementMap.get(connection.vendor_id);

        vendorsArray.push({
          vendorUserId: connection.vendor_id,
          anonymousId: vendorProfile.anonymous_id || `Vendor#${connection.vendor_id.substring(0, 6)}`,
          companyName: vendorProfile.company_name || "Vendor",
          firstName,
          lastInitial,
          city: vendorProfile.city,
          state: vendorProfile.state,
          systemsUsed: vendorProfile.systems_used || [],
          inspectionTypes: vendorProfile.primary_inspection_types || [],
          isAcceptingNewReps: vendorProfile.is_accepting_new_reps ?? true,
          connectedAt: agreement?.created_at || connection.requested_at,
          connectedPosts: [],
          // Agreement data (optional)
          agreementId: agreement?.id || null,
          coverageSummary: agreement?.coverage_summary || null,
          pricingSummary: agreement?.pricing_summary || null,
          baseRate: agreement?.base_rate || null,
          statesCovered: agreement?.states_covered || null,
        });
      }

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

      // Fetch notes for all vendors
      if (vendorUserIds.length > 0) {
        const { data: notesData, error: notesError } = await supabase
          .from("connection_notes")
          .select("id, vendor_id, rep_id, note, created_at")
          .eq("rep_id", user.id)
          .eq("side", "rep")
          .in("vendor_id", vendorUserIds)
          .order("created_at", { ascending: false });

        if (!notesError && notesData) {
          const notesByVendor: Record<string, any[]> = {};
          const hasNotesMap: Record<string, boolean> = {};
          
          for (const n of notesData) {
            if (!notesByVendor[n.vendor_id]) notesByVendor[n.vendor_id] = [];
            notesByVendor[n.vendor_id].push(n);
            hasNotesMap[n.vendor_id] = true;
          }

          vendorsArray.forEach(vendor => {
            vendor.notes = notesByVendor[vendor.vendorUserId] || [];
          });
          
          setHasNotesByVendor(hasNotesMap);
        }

        // Fetch reviews for all vendors
        const { data: reviewsData } = await supabase
          .from("reviews")
          .select("*")
          .eq("reviewer_id", user.id)
          .in("reviewee_id", vendorUserIds)
          .eq("direction", "rep_to_vendor")
          .order("created_at", { ascending: false });

        if (reviewsData) {
          const reviewsByVendor: Record<string, Review> = {};
          for (const review of reviewsData) {
            // Keep only the most recent review per vendor
            if (!reviewsByVendor[review.reviewee_id]) {
              reviewsByVendor[review.reviewee_id] = review as Review;
            }
          }

          vendorsArray.forEach(vendor => {
            vendor.review = reviewsByVendor[vendor.vendorUserId] || null;
          });
        }
      }

      // Sort by connectedAt (newest first)
      vendorsArray.sort((a, b) => {
        const aDate = a.connectedAt ?? '';
        const bDate = b.connectedAt ?? '';
        return new Date(bDate).getTime() - new Date(aDate).getTime();
      });

      // Fetch trust scores for all connected vendors
      const trustScores = await fetchTrustScoresForUsers(vendorUserIds);

      // Fetch community scores for all connected vendors
      const { data: communityScoreData } = await supabase
        .from("profiles")
        .select("id, community_score")
        .in("id", vendorUserIds);
      
      const communityScoreMap = new Map<string, number>();
      communityScoreData?.forEach(p => communityScoreMap.set(p.id, p.community_score ?? 0));

      // Assign trust scores and community scores to vendors
      vendorsArray.forEach(vendor => {
        const trust = trustScores[vendor.vendorUserId];
        vendor.trustScore = trust ? trust.average : null;
        vendor.trustScoreCount = trust ? trust.count : 0;
        vendor.communityScore = communityScoreMap.get(vendor.vendorUserId) ?? 0;
      });

      // Fetch blocked user IDs
      const blockedUserIds = await fetchBlockedUserIds();

      // Filter out blocked vendors
      const filteredVendors = vendorsArray.filter(vendor => !blockedUserIds.includes(vendor.vendorUserId));

      setConnectedVendors(filteredVendors);
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

  const handleMessage = async (vendorUserId: string, conversationId?: string, originPostId?: string) => {
    if (conversationId) {
      navigate(`/messages/${conversationId}`);
      return;
    }

    // Create conversation with origin if available
    const origin = originPostId
      ? { type: "seeking_coverage" as const, postId: originPostId }
      : null;

    const result = await getOrCreateConversation(user!.id, vendorUserId, origin);
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

  const handleAddNote = async (vendorUserId: string) => {
    const text = noteDrafts[vendorUserId]?.trim();
    if (!text) return;

    const { data, error } = await supabase
      .from("connection_notes")
      .insert([{
        vendor_id: vendorUserId,
        rep_id: user!.id,
        author_id: user!.id,
        side: "rep",
        note: text,
      }])
      .select("id, note, created_at")
      .single();

    if (error) {
      toast({ title: "Error", description: "Failed to save note.", variant: "destructive" });
      return;
    }

    // Optimistically update local state
    setConnectedVendors(prev =>
      prev.map(v =>
        v.vendorUserId === vendorUserId
          ? {
              ...v,
              notes: [{ id: data.id, note: data.note, created_at: data.created_at }, ...(v.notes || [])],
            }
          : v
      )
    );
    setNoteDrafts(prev => ({ ...prev, [vendorUserId]: "" }));
    setHasNotesByVendor(prev => ({ ...prev, [vendorUserId]: true }));
    toast({ title: "Note Added", description: "Your note has been saved." });
  };

  const handleEditNote = (noteId: string, currentText: string) => {
    setEditingNoteId(noteId);
    setEditedNoteText(currentText);
  };

  const handleCancelEdit = () => {
    setEditingNoteId(null);
    setEditedNoteText("");
  };

  const handleSaveEditedNote = async (noteId: string, vendorUserId: string) => {
    const text = editedNoteText.trim();
    if (!text) return;

    const { error } = await supabase
      .from("connection_notes")
      .update({ note: text })
      .eq("id", noteId);

    if (error) {
      toast({ title: "Error", description: "Failed to update note.", variant: "destructive" });
      return;
    }

    // Update local state
    setConnectedVendors(prev =>
      prev.map(v =>
        v.vendorUserId === vendorUserId
          ? {
              ...v,
              notes: v.notes?.map(n => n.id === noteId ? { ...n, note: text } : n),
            }
          : v
      )
    );
    setEditingNoteId(null);
    setEditedNoteText("");
    toast({ title: "Note Updated", description: "Your note has been updated." });
  };

  const handleDisconnectClick = (vendorUserId: string) => {
    setDisconnectingVendorUserId(vendorUserId);
    setShowDisconnectDialog(true);
  };

  const handleDisconnect = async () => {
    if (!disconnectingVendorUserId || !user) return;

    setDisconnecting(true);
    try {
      // Find the vendor being disconnected
      const disconnectingVendor = connectedVendors.find(v => v.vendorUserId === disconnectingVendorUserId);

      // Update vendor_connections status to 'ended'
      const { error: connError } = await supabase
        .from("vendor_connections")
        .update({ status: "ended" })
        .eq("vendor_id", disconnectingVendorUserId)
        .eq("field_rep_id", user.id);

      if (connError) throw connError;

      // If agreement exists, update its status to 'ended'
      if (disconnectingVendor?.agreementId) {
        const { error: agreementError } = await supabase
          .from("vendor_rep_agreements")
          .update({ status: "ended" })
          .eq("id", disconnectingVendor.agreementId);

        if (agreementError) throw agreementError;
      }

      // Remove from list
      setConnectedVendors(prev => prev.filter(v => v.vendorUserId !== disconnectingVendorUserId));

      setShowDisconnectDialog(false);
      
      toast({
        title: "Relationship ended",
        description: "This Vendor has been removed from your active list.",
      });

      // Show exit review dialog
      setExitReviewVendorUserId(disconnectingVendorUserId);
      setShowExitReviewDialog(true);

      setDisconnectingVendorUserId(null);
    } catch (error: any) {
      console.error("Error disconnecting:", error);
      toast({
        title: "Error",
        description: "Failed to end connection",
        variant: "destructive",
      });
    } finally {
      setDisconnecting(false);
    }
  };

  // Extract unique states from all agreements for filter
  const availableStates = React.useMemo(() => {
    const statesSet = new Set<string>();
    connectedVendors.forEach(vendor => {
      if (vendor.statesCovered && vendor.statesCovered.length > 0) {
        vendor.statesCovered.forEach(state => statesSet.add(state));
      }
    });
    return Array.from(statesSet).sort();
  }, [connectedVendors]);

  // Filter vendors by selected state
  const filteredVendors = React.useMemo(() => {
    if (stateFilter === "all") {
      return connectedVendors;
    }
    return connectedVendors.filter(vendor => 
      vendor.statesCovered && vendor.statesCovered.includes(stateFilter)
    );
  }, [connectedVendors, stateFilter]);

  const handleReviewVendor = (vendor: ConnectedVendor) => {
    setReviewDialogData({
      vendorUserId: vendor.vendorUserId,
      repInterestId: vendor.connectedPosts[0]?.interestId || "",
      isExitReview: false,
      existingReview: vendor.review || null,
    });
    setShowReviewDialog(true);
  };

  function handleReviewSaved() {
    // Reload vendors to get updated review
    if (repProfileId) {
      loadConnectedVendors(repProfileId);
    }
    setReviewDialogData(null);
  }

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

      // Reload both lists
      if (repProfileId) {
        loadPendingRequests(repProfileId);
        loadConnectedVendors(repProfileId);
      }
    } catch (error: any) {
      console.error("Error accepting request:", error);
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

      // Reload pending requests
      if (repProfileId) {
        loadPendingRequests(repProfileId);
      }
    } catch (error: any) {
      console.error("Error declining request:", error);
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
        <div className="text-center">
          <div className="text-lg text-muted-foreground">Loading your network...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        {/* Admin View Banner */}
        {profile?.is_admin && <AdminViewBanner />}
        
        <div className="mb-6 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold text-foreground">My Vendors</h1>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="w-4 h-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>Agreements are created by vendors when you've confirmed coverage and pricing. If something looks wrong, message the vendor directly to request an update.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <p className="text-muted-foreground mt-1">
              These are the vendors you currently have active agreements with, including your coverage and pricing.
            </p>
          </div>
        </div>

        {/* Connection Requests Section */}
        {pendingRequests.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">Connection Requests</h2>
            <div className="space-y-3">
              {pendingRequests.map((request) => (
                <Card key={request.interestId} className="bg-amber-500/5 border-amber-500/30">
                  <CardContent className="py-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <button
                            onClick={() => handleViewProfile(request.vendorUserId)}
                            className="text-primary hover:underline font-semibold flex items-center gap-2"
                          >
                            {request.anonymousId}
                            <Eye className="w-4 h-4" />
                          </button>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {request.companyName}
                        </p>
                        {(request.city || request.state) && (
                          <p className="text-sm text-muted-foreground">
                            {request.city && request.state ? `${request.city}, ${request.state}` : request.city || request.state}
                          </p>
                        )}
                        <p className="text-xs text-amber-600 mt-2 font-medium">
                          Wants to connect via: {request.postTitle} ({request.postStateCode})
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => handleAcceptRequest(request.interestId)}
                          disabled={acceptingRequest === request.interestId}
                          size="sm"
                          variant="default"
                        >
                          {acceptingRequest === request.interestId ? "Accepting..." : "Accept"}
                        </Button>
                        <Button
                          onClick={() => handleDeclineRequest(request.interestId)}
                          disabled={decliningRequest === request.interestId}
                          size="sm"
                          variant="outline"
                          className="text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground"
                        >
                          {decliningRequest === request.interestId ? "Declining..." : "Decline"}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {connectedVendors.length === 0 && pendingRequests.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center">
              <Building2 className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">No connections yet</h3>
              <p className="text-muted-foreground mb-4">
                When you express interest and accept vendor connection requests, they'll appear here.
              </p>
              <Button onClick={() => navigate("/rep/find-work")}>
                Find Work
              </Button>
            </CardContent>
          </Card>
        ) : connectedVendors.length > 0 ? (
          <>
            {/* State Filter */}
            {availableStates.length > 0 && (
              <div className="mb-4">
                <label className="text-sm font-medium mr-2">Filter by state:</label>
                <select
                  value={stateFilter}
                  onChange={(e) => setStateFilter(e.target.value)}
                  className="px-3 py-2 border border-input bg-background rounded-md text-sm"
                >
                  <option value="all">All States</option>
                  {availableStates.map(state => (
                    <option key={state} value={state}>{state}</option>
                  ))}
                </select>
              </div>
            )}

            <h2 className="text-xl font-semibold text-foreground mb-4">Active Agreements</h2>
            {filteredVendors.length === 0 && stateFilter !== "all" ? (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground">
                  No vendors found covering {stateFilter}.
                </p>
              </Card>
            ) : (
              <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-foreground">Vendor</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-foreground">Coverage & Pricing</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-foreground">Trust Score</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-foreground">States Covered</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-foreground">Connected Since</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredVendors.map((vendor) => (
                    <tr key={vendor.vendorUserId} className="border-b border-border hover:bg-muted/50 transition-colors">
                      <td className="py-4 px-4">
                        <div className="flex flex-col gap-1">
                          <button
                            onClick={() => handleViewProfile(vendor.vendorUserId)}
                            className="text-primary hover:underline font-semibold flex items-center gap-2 w-fit"
                          >
                            {vendor.anonymousId}
                            <Eye className="w-4 h-4" />
                          </button>
                          <p className="text-sm font-medium">{vendor.companyName}</p>
                          {(vendor.firstName || vendor.lastInitial) && (
                            <p className="text-xs text-muted-foreground">
                              {vendor.firstName} {vendor.lastInitial}.
                            </p>
                          )}
                          {/* Status line */}
                          <div className="text-xs text-muted-foreground flex items-center gap-1">
                            <span>Status: Connected</span>
                            <span>·</span>
                            <span>
                              {vendor.agreementId ? "Agreement on file" : "Details not set in ClearMarket"}
                            </span>
                            <span>·</span>
                            <button
                              onClick={() => handleDisconnectClick(vendor.vendorUserId)}
                              className="text-destructive hover:underline"
                            >
                              Disconnect
                            </button>
                          </div>
                          {hasNotesByVendor[vendor.vendorUserId] && (
                            <span 
                              className="inline-flex items-center gap-1 text-xs text-muted-foreground w-fit"
                              title="You have private notes on this connection"
                            >
                              <StickyNote className="w-3 h-3" />
                              Notes
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex flex-col gap-1 text-sm">
                          {vendor.agreementId ? (
                            <>
                              <p className="text-muted-foreground">
                                Coverage: {vendor.coverageSummary || "Not specified"}
                              </p>
                              <p className="text-muted-foreground">
                                Pricing: {vendor.pricingSummary || "Not specified"}
                              </p>
                            </>
                          ) : (
                            <>
                              <p className="text-muted-foreground">Coverage: Not set yet</p>
                              <p className="text-muted-foreground">Pricing: Not set yet</p>
                              <Badge variant="secondary" className="w-fit mt-1">Agreement pending</Badge>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-4 text-sm text-muted-foreground">
                        {vendor.trustScoreCount && vendor.trustScoreCount > 0 ? (
                          <button
                            onClick={() => {
                              setReviewsDialogUserId(vendor.vendorUserId);
                              setShowReviewsDialog(true);
                            }}
                            className="flex flex-col gap-0.5 hover:opacity-80 cursor-pointer text-left"
                          >
                            <span className="font-semibold text-foreground underline decoration-dotted">{vendor.trustScore?.toFixed(1)}</span>
                            <span className="text-xs">({vendor.trustScoreCount} {vendor.trustScoreCount === 1 ? 'review' : 'reviews'})</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              setReviewsDialogUserId(vendor.vendorUserId);
                              setShowReviewsDialog(true);
                            }}
                            className="flex flex-col gap-0.5 hover:opacity-80 cursor-pointer text-left"
                          >
                            <span className="font-semibold text-muted-foreground">3.0</span>
                            <Badge variant="secondary" className="text-xs w-fit">New – not yet rated</Badge>
                          </button>
                        )}
                        {/* Community Score */}
                        <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                          <span>Community:</span>
                          <Badge variant="outline" className="text-xs px-1 py-0">
                            {(vendor.communityScore ?? 0) >= 0 ? `+${vendor.communityScore ?? 0}` : vendor.communityScore}
                          </Badge>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-sm text-muted-foreground">
                        {vendor.statesCovered && vendor.statesCovered.length > 0
                          ? vendor.statesCovered.join(", ")
                          : <span className="text-muted-foreground/60">Not set in ClearMarket</span>
                        }
                      </td>
                      <td className="py-4 px-4 text-sm text-muted-foreground">
                        {vendor.connectedAt && new Date(vendor.connectedAt).toLocaleDateString()}
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex gap-2 justify-end flex-wrap">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewProfile(vendor.vendorUserId)}
                          >
                            View Profile
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setCalendarVendorId(vendor.vendorUserId);
                              setCalendarVendorName(vendor.companyName);
                              setShowCalendarDialog(true);
                            }}
                          >
                            <Calendar className="h-4 w-4 mr-1" />
                            Calendar
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleReviewVendor(vendor)}
                          >
                            {vendor.review ? "Edit Review" : "Leave Review"}
                          </Button>
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => 
                              handleMessage(
                                vendor.vendorUserId, 
                                vendor.conversationId,
                                vendor.connectedPosts[0]?.id
                              )
                            }
                          >
                            View Messages
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDisconnectClick(vendor.vendorUserId)}
                            className="text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground"
                          >
                            Disconnect
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Notes Section - Below Table */}
              <div className="mt-8 space-y-6">
                <h3 className="text-lg font-semibold text-foreground">Connection Notes</h3>
                {filteredVendors.map((vendor) => (
                  <Card key={`notes-${vendor.vendorUserId}`}>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        {vendor.anonymousId} - {vendor.companyName}
                        {hasNotesByVendor[vendor.vendorUserId] && (
                          <Badge variant="secondary" className="text-xs">
                            <StickyNote className="w-3 h-3 mr-1" />
                            Has Notes
                          </Badge>
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Existing Notes */}
                      {vendor.notes && vendor.notes.length > 0 ? (
                        <div className="space-y-2 max-h-32 overflow-y-auto">
                          {vendor.notes.slice(0, 3).map((n) => (
                            <div key={n.id} className="space-y-1">
                              {editingNoteId === n.id ? (
                                <div className="space-y-1">
                                  <textarea
                                    className="w-full text-xs rounded-md border bg-background px-2 py-1"
                                    rows={2}
                                    value={editedNoteText}
                                    onChange={(e) => setEditedNoteText(e.target.value)}
                                    autoFocus
                                  />
                                  <div className="flex gap-1">
                                    <Button
                                      size="sm"
                                      variant="default"
                                      className="h-6 text-xs"
                                      onClick={() => handleSaveEditedNote(n.id, vendor.vendorUserId)}
                                    >
                                      <Check className="w-3 h-3 mr-1" />
                                      Save
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-6 text-xs"
                                      onClick={handleCancelEdit}
                                    >
                                      <X className="w-3 h-3 mr-1" />
                                      Cancel
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-start justify-between gap-2">
                                  <p className="text-xs text-muted-foreground flex-1">
                                    <span className="font-medium">
                                      {new Date(n.created_at).toLocaleDateString()}
                                      {": "}
                                    </span>
                                    {n.note}
                                  </p>
                                  <button
                                    onClick={() => handleEditNote(n.id, n.note)}
                                    className="text-muted-foreground hover:text-foreground"
                                    title="Edit note"
                                  >
                                    <Edit2 className="w-3 h-3" />
                                  </button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground italic">No notes yet for this vendor.</p>
                      )}

                      {/* Add New Note */}
                      <div className="flex gap-2 pt-2 border-t border-border">
                        <textarea
                          className="flex-1 text-xs rounded-md border bg-background px-2 py-1"
                          rows={2}
                          placeholder="Add a quick note about this vendor..."
                          value={noteDrafts[vendor.vendorUserId] || ""}
                          onChange={(e) =>
                            setNoteDrafts((prev) => ({ ...prev, [vendor.vendorUserId]: e.target.value }))
                          }
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleAddNote(vendor.vendorUserId)}
                        >
                          Save
                        </Button>
                      </div>

                      {/* Disconnect Button */}
                      <div className="pt-2 border-t border-border">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDisconnectClick(vendor.vendorUserId)}
                          className="text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground"
                        >
                          Disconnect from {vendor.companyName}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
            )}
          </>
        ) : null}
      </div>

      {selectedVendorUserId && (
        <PublicProfileDialog
          open={profileDialogOpen}
          onOpenChange={setProfileDialogOpen}
          targetUserId={selectedVendorUserId}
        />
      )}

      <AlertDialog open={showDisconnectDialog} onOpenChange={setShowDisconnectDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect from this Vendor?</AlertDialogTitle>
            <AlertDialogDescription>
              You'll no longer see this Vendor in your active list. This won't delete past message history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {disconnecting ? "Disconnecting..." : "Disconnect"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {exitReviewVendorUserId && (
        <RepExitReviewDialog
          open={showExitReviewDialog}
          onOpenChange={setShowExitReviewDialog}
          vendorUserId={exitReviewVendorUserId}
          repUserId={user!.id}
        />
      )}

      <ReviewsDetailDialog
        open={showReviewsDialog}
        onOpenChange={setShowReviewsDialog}
        targetUserId={reviewsDialogUserId}
      />

      <VendorCalendarDialog
        open={showCalendarDialog}
        onOpenChange={setShowCalendarDialog}
        vendorId={calendarVendorId || ""}
        vendorName={calendarVendorName}
      />

      {reviewDialogData && user && (
        <ReviewDialog
          open={showReviewDialog}
          onOpenChange={setShowReviewDialog}
          reviewerId={user.id}
          revieweeId={reviewDialogData.vendorUserId}
          direction="rep_to_vendor"
          repInterestId={reviewDialogData.repInterestId}
          isExitReview={reviewDialogData.isExitReview}
          existingReview={reviewDialogData.existingReview}
          onSaved={handleReviewSaved}
        />
      )}
    </div>
  );
};

export default RepMyVendors;
