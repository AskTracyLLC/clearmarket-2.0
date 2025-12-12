import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { ArrowLeft, Users, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { getOrCreateConversation } from "@/lib/conversations";
import AdminViewBanner from "@/components/AdminViewBanner";
import { PublicProfileDialog } from "@/components/PublicProfileDialog";
import { ReviewDialog, Review } from "@/components/ReviewDialog";
import { VendorExitReviewDialog } from "@/components/VendorExitReviewDialog";
import { RepostCoverageDialog } from "@/components/RepostCoverageDialog";
import { fetchTrustScoresForUsers } from "@/lib/reviews";
import { ReviewsDetailDialog } from "@/components/ReviewsDetailDialog";
import { fetchBlockedUserIds } from "@/lib/blocks";
import { AuthenticatedLayout } from "@/components/AuthenticatedLayout";
import { MyRepsTable } from "@/components/MyRepsTable";
import { ConnectionNotesModal } from "@/components/ConnectionNotesModal";

interface ConnectedRep {
  repUserId: string;
  anonymousId: string;
  firstName: string;
  lastInitial: string;
  city: string | null;
  state: string | null;
  systemsUsed: string[];
  inspectionTypes: string[];
  isAcceptingNewVendors: boolean;
  willingToTravelOutOfState: boolean;
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

const VendorMyReps = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<{ is_vendor_admin: boolean; is_admin: boolean } | null>(null);
  const [connectedReps, setConnectedReps] = useState<ConnectedRep[]>([]);
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [selectedRepUserId, setSelectedRepUserId] = useState<string | null>(null);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editedNoteText, setEditedNoteText] = useState<string>("");
  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false);
  const [disconnectingRepUserId, setDisconnectingRepUserId] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const [showExitReviewDialog, setShowExitReviewDialog] = useState(false);
  const [exitReviewRepUserId, setExitReviewRepUserId] = useState<string | null>(null);
  const [showRepostDialog, setShowRepostDialog] = useState(false);
  const [repostData, setRepostData] = useState<{
    coverageSummary: string | null;
    pricingSummary: string | null;
  } | null>(null);
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [reviewDialogData, setReviewDialogData] = useState<{
    repUserId: string;
    repInterestId: string;
    isExitReview: boolean;
    existingReview?: Review | null;
  } | null>(null);
  const [showReviewsDialog, setShowReviewsDialog] = useState(false);
  const [reviewsDialogUserId, setReviewsDialogUserId] = useState<string | null>(null);
  
  // Notes modal state
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [notesModalRep, setNotesModalRep] = useState<ConnectedRep | null>(null);

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
      .select("is_vendor_admin, is_admin")
      .eq("id", user.id)
      .single();

    setProfile(profileData);

    if (!profileData?.is_vendor_admin && !profileData?.is_admin) {
      toast({
        title: "Access Denied",
        description: "This page is only available to vendor accounts.",
        variant: "destructive",
      });
      navigate("/dashboard");
      return;
    }

    loadConnectedReps();
  };

  const loadConnectedReps = async () => {
    if (!user) return;

    try {
      const { data: connections, error } = await supabase
        .from("vendor_connections")
        .select("id, vendor_id, field_rep_id, requested_at")
        .eq("vendor_id", user.id)
        .eq("status", "connected");

      if (error) {
        console.error("Error loading connections:", error);
        toast({
          title: "Error",
          description: "Failed to load your field reps.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      if (!connections || connections.length === 0) {
        setLoading(false);
        return;
      }

      const repUserIds = connections.map(c => c.field_rep_id);

      const { data: agreements } = await supabase
        .from("vendor_rep_agreements")
        .select("id, vendor_id, field_rep_id, coverage_summary, pricing_summary, base_rate, states_covered, created_at")
        .eq("vendor_id", user.id)
        .eq("status", "active")
        .in("field_rep_id", repUserIds);

      const agreementMap = new Map();
      (agreements || []).forEach(a => {
        agreementMap.set(a.field_rep_id, a);
      });

      const { data: repProfiles } = await supabase
        .from("rep_profile")
        .select(`
          id,
          user_id,
          anonymous_id,
          city,
          state,
          systems_used,
          inspection_types,
          is_accepting_new_vendors,
          willing_to_travel_out_of_state,
          profiles:user_id ( full_name )
        `)
        .in("user_id", repUserIds);

      const repsArray: ConnectedRep[] = [];

      for (const connection of connections) {
        const repProfile = repProfiles?.find(p => p.user_id === connection.field_rep_id);
        
        if (!repProfile) continue;

        const fullName = (repProfile.profiles as any)?.full_name || "";
        const nameParts = fullName.split(" ");
        const firstName = nameParts[0] || "";
        const lastInitial = nameParts.length > 1 ? nameParts[nameParts.length - 1].charAt(0) : "";

        const agreement = agreementMap.get(connection.field_rep_id);

        repsArray.push({
          repUserId: connection.field_rep_id,
          anonymousId: repProfile.anonymous_id || `FieldRep#${connection.field_rep_id.substring(0, 6)}`,
          firstName,
          lastInitial,
          city: repProfile.city,
          state: repProfile.state,
          systemsUsed: repProfile.systems_used || [],
          inspectionTypes: repProfile.inspection_types || [],
          isAcceptingNewVendors: repProfile.is_accepting_new_vendors ?? true,
          willingToTravelOutOfState: repProfile.willing_to_travel_out_of_state ?? false,
          connectedAt: agreement?.created_at || connection.requested_at,
          connectedPosts: [],
          agreementId: agreement?.id || null,
          coverageSummary: agreement?.coverage_summary || null,
          pricingSummary: agreement?.pricing_summary || null,
          baseRate: agreement?.base_rate || null,
          statesCovered: agreement?.states_covered || null,
        });
      }

      // Fetch conversations
      for (const rep of repsArray) {
        const [p1, p2] = [user.id, rep.repUserId].sort();
        const { data: conv } = await supabase
          .from("conversations")
          .select("id")
          .eq("participant_one", p1)
          .eq("participant_two", p2)
          .maybeSingle();

        if (conv) {
          rep.conversationId = conv.id;
        }
      }

      // Fetch notes for all reps
      if (repUserIds.length > 0) {
        const { data: notesData, error: notesError } = await supabase
          .from("connection_notes")
          .select("id, vendor_id, rep_id, note, created_at")
          .eq("vendor_id", user.id)
          .eq("side", "vendor")
          .in("rep_id", repUserIds)
          .order("created_at", { ascending: false });

        if (!notesError && notesData) {
          const notesByRep: Record<string, any[]> = {};
          
          for (const n of notesData) {
            if (!notesByRep[n.rep_id]) notesByRep[n.rep_id] = [];
            notesByRep[n.rep_id].push(n);
          }

          repsArray.forEach(rep => {
            rep.notes = notesByRep[rep.repUserId] || [];
          });
        }

        // Fetch reviews for all reps
        const { data: reviewsData } = await supabase
          .from("reviews")
          .select("*")
          .eq("reviewer_id", user.id)
          .in("reviewee_id", repUserIds)
          .eq("direction", "vendor_to_rep")
          .order("created_at", { ascending: false });

        if (reviewsData) {
          const reviewsByRep: Record<string, Review> = {};
          for (const review of reviewsData) {
            if (!reviewsByRep[review.reviewee_id]) {
              reviewsByRep[review.reviewee_id] = review as Review;
            }
          }

          repsArray.forEach(rep => {
            rep.review = reviewsByRep[rep.repUserId] || null;
          });
        }
      }

      // Sort by connectedAt (newest first)
      repsArray.sort((a, b) => {
        const aDate = a.connectedAt ?? '';
        const bDate = b.connectedAt ?? '';
        return new Date(bDate).getTime() - new Date(aDate).getTime();
      });

      // Fetch trust scores for all connected reps
      const trustScores = await fetchTrustScoresForUsers(repUserIds);

      // Fetch community scores for all connected reps
      const { data: communityScoreData } = await supabase
        .from("profiles")
        .select("id, community_score")
        .in("id", repUserIds);
      
      const communityScoreMap = new Map<string, number>();
      communityScoreData?.forEach(p => communityScoreMap.set(p.id, p.community_score ?? 0));

      // Assign trust scores and community scores to reps
      repsArray.forEach(rep => {
        const trust = trustScores[rep.repUserId];
        rep.trustScore = trust ? trust.average : null;
        rep.trustScoreCount = trust ? trust.count : 0;
        rep.communityScore = communityScoreMap.get(rep.repUserId) ?? 0;
      });

      // Fetch blocked user IDs
      const blockedUserIds = await fetchBlockedUserIds();

      // Filter out blocked reps
      const filteredReps = repsArray.filter(rep => !blockedUserIds.includes(rep.repUserId));

      setConnectedReps(filteredReps);
    } catch (error) {
      console.error("Error in loadConnectedReps:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewProfile = (repUserId: string) => {
    setSelectedRepUserId(repUserId);
    setProfileDialogOpen(true);
  };

  const handleMessage = async (repUserId: string, conversationId?: string) => {
    if (conversationId) {
      navigate(`/messages/${conversationId}`);
      return;
    }

    const result = await getOrCreateConversation(user!.id, repUserId);
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

  const handleOpenNotes = (rep: ConnectedRep) => {
    setNotesModalRep(rep);
    setShowNotesModal(true);
  };

  const handleAddNote = async () => {
    if (!notesModalRep) return;
    const text = noteDrafts[notesModalRep.repUserId]?.trim();
    if (!text) return;

    const { data, error } = await supabase
      .from("connection_notes")
      .insert([{
        vendor_id: user!.id,
        rep_id: notesModalRep.repUserId,
        author_id: user!.id,
        side: "vendor",
        note: text,
      }])
      .select("id, note, created_at")
      .single();

    if (error) {
      toast({ title: "Error", description: "Failed to save note.", variant: "destructive" });
      return;
    }

    // Update local state
    setConnectedReps(prev =>
      prev.map(r =>
        r.repUserId === notesModalRep.repUserId
          ? {
              ...r,
              notes: [{ id: data.id, note: data.note, created_at: data.created_at }, ...(r.notes || [])],
            }
          : r
      )
    );
    
    // Also update the modal rep
    setNotesModalRep(prev => prev ? {
      ...prev,
      notes: [{ id: data.id, note: data.note, created_at: data.created_at }, ...(prev.notes || [])],
    } : null);
    
    setNoteDrafts(prev => ({ ...prev, [notesModalRep.repUserId]: "" }));
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

  const handleSaveEditedNote = async (noteId: string) => {
    if (!notesModalRep) return;
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
    setConnectedReps(prev =>
      prev.map(r =>
        r.repUserId === notesModalRep.repUserId
          ? {
              ...r,
              notes: r.notes?.map(n => n.id === noteId ? { ...n, note: text } : n),
            }
          : r
      )
    );
    
    // Also update the modal rep
    setNotesModalRep(prev => prev ? {
      ...prev,
      notes: prev.notes?.map(n => n.id === noteId ? { ...n, note: text } : n),
    } : null);
    
    setEditingNoteId(null);
    setEditedNoteText("");
    toast({ title: "Note Updated", description: "Your note has been updated." });
  };

  const handleDisconnectClick = (repUserId: string) => {
    setDisconnectingRepUserId(repUserId);
    setShowDisconnectDialog(true);
  };

  const handleDisconnect = async () => {
    if (!disconnectingRepUserId || !user) return;

    setDisconnecting(true);
    try {
      const disconnectingRep = connectedReps.find(r => r.repUserId === disconnectingRepUserId);

      const { error: connError } = await supabase
        .from("vendor_connections")
        .update({ status: "ended" })
        .eq("vendor_id", user.id)
        .eq("field_rep_id", disconnectingRepUserId);

      if (connError) throw connError;

      if (disconnectingRep?.agreementId) {
        const { error: agreementError } = await supabase
          .from("vendor_rep_agreements")
          .update({ status: "ended" })
          .eq("id", disconnectingRep.agreementId);

        if (agreementError) throw agreementError;
      }

      setConnectedReps(prev => prev.filter(r => r.repUserId !== disconnectingRepUserId));

      setShowDisconnectDialog(false);
      
      toast({
        title: "Disconnected",
        description: "This Field Rep has been removed from your active list.",
      });

      setExitReviewRepUserId(disconnectingRepUserId);
      setShowExitReviewDialog(true);

      if (disconnectingRep) {
        setRepostData({
          coverageSummary: disconnectingRep.coverageSummary,
          pricingSummary: disconnectingRep.pricingSummary,
        });
      }

      setDisconnectingRepUserId(null);
    } catch (error: any) {
      console.error("Error disconnecting:", error);
      toast({
        title: "Error",
        description: "Failed to disconnect",
        variant: "destructive",
      });
    } finally {
      setDisconnecting(false);
    }
  };

  const handleExitReviewComplete = () => {
    setShowExitReviewDialog(false);
    if (repostData) {
      setShowRepostDialog(true);
    }
  };

  const handleReviewRep = (rep: ConnectedRep) => {
    setReviewDialogData({
      repUserId: rep.repUserId,
      repInterestId: rep.connectedPosts[0]?.interestId || "",
      isExitReview: false,
      existingReview: rep.review || null,
    });
    setShowReviewDialog(true);
  };

  function handleReviewSaved() {
    loadConnectedReps();
    setReviewDialogData(null);
  }

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
      <div className="container mx-auto px-4 py-6 md:py-8 max-w-6xl">
        {profile?.is_admin && <AdminViewBanner />}
        
        {/* Header */}
        <div className="mb-6 flex items-start gap-3 md:gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")} className="flex-shrink-0 mt-1">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl md:text-3xl font-bold text-foreground">My Field Reps</h1>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="w-4 h-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>Create agreements to capture coverage areas and pricing for each field rep. This helps you track your network.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <p className="text-sm md:text-base text-muted-foreground mt-1">
              Your active field rep connections and agreements.
            </p>
          </div>
        </div>

        {/* Empty State */}
        {connectedReps.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center">
              <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">No connections yet</h3>
              <p className="text-muted-foreground mb-4 text-sm md:text-base">
                When you mark interested reps as Connected, they'll appear here.
              </p>
              <Button onClick={() => navigate("/vendor/seeking-coverage")}>
                View Seeking Coverage
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <h2 className="text-lg md:text-xl font-semibold text-foreground mb-4">
              Active Agreements ({connectedReps.length})
            </h2>

            <MyRepsTable
              reps={connectedReps}
              vendorId={user!.id}
              onViewProfile={handleViewProfile}
              onViewMessages={handleMessage}
              onReviewRep={handleReviewRep}
              onDisconnect={handleDisconnectClick}
              onViewTrustScore={(repUserId) => {
                setReviewsDialogUserId(repUserId);
                setShowReviewsDialog(true);
              }}
              onOpenNotes={handleOpenNotes}
              onWorkingTermsSaved={loadConnectedReps}
            />
          </>
        )}
      </div>

      {/* Notes Modal */}
      {notesModalRep && (
        <ConnectionNotesModal
          open={showNotesModal}
          onOpenChange={setShowNotesModal}
          repName={notesModalRep.anonymousId}
          notes={notesModalRep.notes || []}
          noteDraft={noteDrafts[notesModalRep.repUserId] || ""}
          onNoteDraftChange={(value) => setNoteDrafts(prev => ({ ...prev, [notesModalRep.repUserId]: value }))}
          onAddNote={handleAddNote}
          editingNoteId={editingNoteId}
          editedNoteText={editedNoteText}
          onEditNote={handleEditNote}
          onCancelEdit={handleCancelEdit}
          onSaveEditedNote={handleSaveEditedNote}
          onEditedNoteTextChange={setEditedNoteText}
        />
      )}

      {selectedRepUserId && (
        <PublicProfileDialog
          open={profileDialogOpen}
          onOpenChange={setProfileDialogOpen}
          targetUserId={selectedRepUserId}
          viewerContext={{
            type: "vendor_my_reps",
            rep: connectedReps.find(r => r.repUserId === selectedRepUserId),
            actions: {
              onMessage: (repUserId: string, conversationId?: string) => handleMessage(repUserId, conversationId),
              onReview: (rep: ConnectedRep) => handleReviewRep(rep),
              onDisconnect: (repUserId: string) => handleDisconnectClick(repUserId),
            }
          }}
        />
      )}

      {reviewDialogData && user && (
        <ReviewDialog
          open={showReviewDialog}
          onOpenChange={setShowReviewDialog}
          reviewerId={user.id}
          revieweeId={reviewDialogData.repUserId}
          direction="vendor_to_rep"
          repInterestId={reviewDialogData.repInterestId}
          isExitReview={reviewDialogData.isExitReview}
          existingReview={reviewDialogData.existingReview}
          onSaved={handleReviewSaved}
        />
      )}

      {user && (
        <>
          <VendorExitReviewDialog
            open={showExitReviewDialog}
            onOpenChange={setShowExitReviewDialog}
            repUserId={exitReviewRepUserId || ""}
            vendorUserId={user.id}
            onComplete={handleExitReviewComplete}
          />

          <RepostCoverageDialog
            open={showRepostDialog}
            onOpenChange={setShowRepostDialog}
            coverageSummary={repostData?.coverageSummary || null}
            pricingSummary={repostData?.pricingSummary || null}
            vendorUserId={user.id}
          />
        </>
      )}

      <ReviewsDetailDialog
        open={showReviewsDialog}
        onOpenChange={setShowReviewsDialog}
        targetUserId={reviewsDialogUserId}
      />

      <AlertDialog open={showDisconnectDialog} onOpenChange={setShowDisconnectDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect from this Field Rep?</AlertDialogTitle>
            <AlertDialogDescription>
              You'll no longer see this Field Rep in your active list, and they'll no longer appear as covering work for you in this area. This won't delete past message history.
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
    </AuthenticatedLayout>
  );
};

export default VendorMyReps;
