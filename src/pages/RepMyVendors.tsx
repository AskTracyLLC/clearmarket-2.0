import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { ArrowLeft, Eye, Building2, Info, Check, X } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import AdminViewBanner from "@/components/AdminViewBanner";
import { AuthenticatedLayout } from "@/components/AuthenticatedLayout";
import { getOrCreateConversation } from "@/lib/conversations";
import { PublicProfileDialog } from "@/components/PublicProfileDialog";
import { ReviewDialog, Review } from "@/components/ReviewDialog";
import { RepExitReviewDialog } from "@/components/RepExitReviewDialog";
import { fetchTrustScoresForUsers } from "@/lib/reviews";
import { ReviewsDetailDialog } from "@/components/ReviewsDetailDialog";
import { fetchBlockedUserIds } from "@/lib/blocks";
import { VendorCalendarDialog } from "@/components/VendorCalendarDialog";
import VendorConnectionCard from "@/components/VendorConnectionCard";
import WorkingTermsPendingCard from "@/components/WorkingTermsPendingCard";
import { fetchPendingWorkingTermsRequests, WorkingTermsRequest } from "@/lib/workingTerms";



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
  agreementId?: string | null;
  coverageSummary?: string | null;
  pricingSummary?: string | null;
  baseRate?: number | null;
  statesCovered?: string[] | null;
  
  trustScore?: number | null;
  trustScoreCount?: number;
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
    repInterestId: string | null;
    isExitReview: boolean;
    existingReview?: Review | null;
  } | null>(null);
  const [stateFilter, setStateFilter] = useState<string>("all");
  const [showReviewsDialog, setShowReviewsDialog] = useState(false);
  const [reviewsDialogUserId, setReviewsDialogUserId] = useState<string | null>(null);
  const [showCalendarDialog, setShowCalendarDialog] = useState(false);
  const [calendarVendorId, setCalendarVendorId] = useState<string | null>(null);
  const [calendarVendorName, setCalendarVendorName] = useState<string>("");
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
    loadConnectedVendors(repProfile.id);
    loadPendingWorkingTerms();
  };

  const loadPendingWorkingTerms = async () => {
    if (!user) return;
    
    const requests = await fetchPendingWorkingTermsRequests(user.id, 'rep');
    setPendingWorkingTerms(requests);
    
    // Load vendor names for these requests
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

      const vendorUserIds = connections.map(c => c.vendor_id);

      const { data: agreements } = await supabase
        .from("vendor_rep_agreements")
        .select("id, vendor_id, field_rep_id, coverage_summary, pricing_summary, base_rate, states_covered, created_at")
        .eq("field_rep_id", user.id)
        .eq("status", "active")
        .in("vendor_id", vendorUserIds);

      const agreementMap = new Map();
      (agreements || []).forEach(a => {
        agreementMap.set(a.vendor_id, a);
      });

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
          agreementId: agreement?.id || null,
          coverageSummary: agreement?.coverage_summary || null,
          pricingSummary: agreement?.pricing_summary || null,
          baseRate: agreement?.base_rate || null,
          statesCovered: agreement?.states_covered || null,
          
        });
      }

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
            if (!reviewsByVendor[review.reviewee_id]) {
              reviewsByVendor[review.reviewee_id] = review as Review;
            }
          }

          vendorsArray.forEach(vendor => {
            vendor.review = reviewsByVendor[vendor.vendorUserId] || null;
          });
        }
      }

      vendorsArray.sort((a, b) => {
        const aDate = a.connectedAt ?? '';
        const bDate = b.connectedAt ?? '';
        return new Date(bDate).getTime() - new Date(aDate).getTime();
      });

      const trustScores = await fetchTrustScoresForUsers(vendorUserIds);

      const { data: communityScoreData } = await supabase
        .from("profiles")
        .select("id, community_score")
        .in("id", vendorUserIds);
      
      const communityScoreMap = new Map<string, number>();
      communityScoreData?.forEach(p => communityScoreMap.set(p.id, p.community_score ?? 0));

      vendorsArray.forEach(vendor => {
        const trust = trustScores[vendor.vendorUserId];
        vendor.trustScore = trust ? trust.average : null;
        vendor.trustScoreCount = trust ? trust.count : 0;
        vendor.communityScore = communityScoreMap.get(vendor.vendorUserId) ?? 0;
      });

      const blockedUserIds = await fetchBlockedUserIds();
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
      const disconnectingVendor = connectedVendors.find(v => v.vendorUserId === disconnectingVendorUserId);

      const { error: connError } = await supabase
        .from("vendor_connections")
        .update({ status: "ended" })
        .eq("vendor_id", disconnectingVendorUserId)
        .eq("field_rep_id", user.id);

      if (connError) throw connError;

      if (disconnectingVendor?.agreementId) {
        const { error: agreementError } = await supabase
          .from("vendor_rep_agreements")
          .update({ status: "ended" })
          .eq("id", disconnectingVendor.agreementId);

        if (agreementError) throw agreementError;
      }

      setConnectedVendors(prev => prev.filter(v => v.vendorUserId !== disconnectingVendorUserId));

      setShowDisconnectDialog(false);
      
      toast({
        title: "Relationship ended",
        description: "This Vendor has been removed from your active list.",
      });

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

  const availableStates = React.useMemo(() => {
    const statesSet = new Set<string>();
    connectedVendors.forEach(vendor => {
      if (vendor.statesCovered && vendor.statesCovered.length > 0) {
        vendor.statesCovered.forEach(state => statesSet.add(state));
      }
    });
    return Array.from(statesSet).sort();
  }, [connectedVendors]);

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
      repInterestId: vendor.connectedPosts[0]?.interestId || null,
      isExitReview: false,
      existingReview: vendor.review || null,
    });
    setShowReviewDialog(true);
  };

  function handleReviewSaved() {
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
    <AuthenticatedLayout>
      <div className="container mx-auto px-4 py-6 md:py-8 max-w-4xl">
        {profile?.is_admin && <AdminViewBanner />}
        
        {/* Header */}
        <div className="mb-6 flex items-start gap-3 md:gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")} className="flex-shrink-0 mt-1">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl md:text-3xl font-bold text-foreground">My Vendors</h1>
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
            <p className="text-sm md:text-base text-muted-foreground mt-1">
              Your active vendor connections and agreements.
            </p>
          </div>
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
                        <div className="flex items-center gap-2 mb-1">
                          <button
                            onClick={() => handleViewProfile(request.vendorUserId)}
                            className="text-primary hover:underline font-semibold flex items-center gap-1.5 text-sm"
                          >
                            {request.anonymousId}
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </div>
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
                          className="flex-1 md:flex-none"
                        >
                          <Check className="w-4 h-4 mr-1.5 md:hidden" />
                          {acceptingRequest === request.interestId ? "Accepting..." : "Accept"}
                        </Button>
                        <Button
                          onClick={() => handleDeclineRequest(request.interestId)}
                          disabled={decliningRequest === request.interestId}
                          size="sm"
                          variant="outline"
                          className="text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground flex-1 md:flex-none"
                        >
                          <X className="w-4 h-4 mr-1.5 md:hidden" />
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

        {/* Empty State */}
        {connectedVendors.length === 0 && pendingRequests.length === 0 && pendingWorkingTerms.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center">
              <Building2 className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">No connections yet</h3>
              <p className="text-muted-foreground mb-4 text-sm md:text-base">
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
              <div className="mb-4 flex items-center gap-2 flex-wrap">
                <label className="text-sm font-medium">Filter by state:</label>
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

            <h2 className="text-lg md:text-xl font-semibold text-foreground mb-4">
              Active Agreements ({filteredVendors.length})
            </h2>

            {filteredVendors.length === 0 && stateFilter !== "all" ? (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground">
                  No vendors found covering {stateFilter}.
                </p>
              </Card>
            ) : (
              <div className="space-y-4">
                {filteredVendors.map((vendor) => (
                  <VendorConnectionCard
                    key={vendor.vendorUserId}
                    vendor={vendor}
                    hasNotes={hasNotesByVendor[vendor.vendorUserId] || false}
                    noteDraft={noteDrafts[vendor.vendorUserId] || ""}
                    onNoteDraftChange={(value) => setNoteDrafts(prev => ({ ...prev, [vendor.vendorUserId]: value }))}
                    onAddNote={() => handleAddNote(vendor.vendorUserId)}
                    editingNoteId={editingNoteId}
                    editedNoteText={editedNoteText}
                    onEditNote={handleEditNote}
                    onCancelEdit={handleCancelEdit}
                    onSaveEditedNote={(noteId) => handleSaveEditedNote(noteId, vendor.vendorUserId)}
                    onEditedNoteTextChange={setEditedNoteText}
                    onViewProfile={() => handleViewProfile(vendor.vendorUserId)}
                    onViewCalendar={() => {
                      setCalendarVendorId(vendor.vendorUserId);
                      setCalendarVendorName(vendor.companyName);
                      setShowCalendarDialog(true);
                    }}
                    onReviewVendor={() => handleReviewVendor(vendor)}
                    onViewMessages={() => handleMessage(
                      vendor.vendorUserId, 
                      vendor.conversationId,
                      vendor.connectedPosts[0]?.id
                    )}
                    onDisconnect={() => handleDisconnectClick(vendor.vendorUserId)}
                    onViewTrustScore={() => {
                      setReviewsDialogUserId(vendor.vendorUserId);
                      setShowReviewsDialog(true);
                    }}
                    onWorkingTermsSaved={() => repProfileId && loadConnectedVendors(repProfileId)}
                  />
                ))}
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
    </AuthenticatedLayout>
  );
};

export default RepMyVendors;
