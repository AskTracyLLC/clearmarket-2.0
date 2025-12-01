import { useEffect, useState } from "react";
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
import { ArrowLeft, Eye, MessageSquare, Users, StickyNote, Edit2, X, Check } from "lucide-react";
import { getOrCreateConversation } from "@/lib/conversations";
import { PublicProfileDialog } from "@/components/PublicProfileDialog";
import { ReviewDialog, Review } from "@/components/ReviewDialog";
import { VendorExitReviewDialog } from "@/components/VendorExitReviewDialog";
import { RepostCoverageDialog } from "@/components/RepostCoverageDialog";

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
  // Agreement data (optional overlay)
  agreementId?: string | null;
  coverageSummary?: string | null;
  pricingSummary?: string | null;
  baseRate?: number | null;
}

const VendorMyReps = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [connectedReps, setConnectedReps] = useState<ConnectedRep[]>([]);
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [selectedRepUserId, setSelectedRepUserId] = useState<string | null>(null);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [hasNotesByRep, setHasNotesByRep] = useState<Record<string, boolean>>({});
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editedNoteText, setEditedNoteText] = useState<string>("");
  const [showEndRelationshipDialog, setShowEndRelationshipDialog] = useState(false);
  const [endingRepUserId, setEndingRepUserId] = useState<string | null>(null);
  const [ending, setEnding] = useState(false);
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
      .select("is_vendor_admin")
      .eq("id", user.id)
      .single();

    if (!profile?.is_vendor_admin) {
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
      // Query vendor_connections as primary source
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

      // Get field rep IDs
      const repUserIds = connections.map(c => c.field_rep_id);

      // LEFT JOIN vendor_rep_agreements
      const { data: agreements } = await supabase
        .from("vendor_rep_agreements")
        .select("id, vendor_id, field_rep_id, coverage_summary, pricing_summary, base_rate, created_at")
        .eq("vendor_id", user.id)
        .eq("status", "active")
        .in("field_rep_id", repUserIds);

      // Build agreement map
      const agreementMap = new Map();
      (agreements || []).forEach(a => {
        agreementMap.set(a.field_rep_id, a);
      });

      // Fetch rep profiles
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

      // Build reps array
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
          // Agreement data (optional)
          agreementId: agreement?.id || null,
          coverageSummary: agreement?.coverage_summary || null,
          pricingSummary: agreement?.pricing_summary || null,
          baseRate: agreement?.base_rate || null,
        });
      }

      // For each rep, check if conversation exists
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
          const hasNotesMap: Record<string, boolean> = {};
          
          for (const n of notesData) {
            if (!notesByRep[n.rep_id]) notesByRep[n.rep_id] = [];
            notesByRep[n.rep_id].push(n);
            hasNotesMap[n.rep_id] = true;
          }

          repsArray.forEach(rep => {
            rep.notes = notesByRep[rep.repUserId] || [];
          });
          
          setHasNotesByRep(hasNotesMap);
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
            // Keep only the most recent review per rep
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

      setConnectedReps(repsArray);
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

    // Create conversation
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

  const handleAddNote = async (repUserId: string) => {
    const text = noteDrafts[repUserId]?.trim();
    if (!text) return;

    const { data, error } = await supabase
      .from("connection_notes")
      .insert([{
        vendor_id: user!.id,
        rep_id: repUserId,
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

    // Optimistically update local state
    setConnectedReps(prev =>
      prev.map(r =>
        r.repUserId === repUserId
          ? {
              ...r,
              notes: [{ id: data.id, note: data.note, created_at: data.created_at }, ...(r.notes || [])],
            }
          : r
      )
    );
    setNoteDrafts(prev => ({ ...prev, [repUserId]: "" }));
    setHasNotesByRep(prev => ({ ...prev, [repUserId]: true }));
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

  const handleSaveEditedNote = async (noteId: string, repUserId: string) => {
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
        r.repUserId === repUserId
          ? {
              ...r,
              notes: r.notes?.map(n => n.id === noteId ? { ...n, note: text } : n),
            }
          : r
      )
    );
    setEditingNoteId(null);
    setEditedNoteText("");
    toast({ title: "Note Updated", description: "Your note has been updated." });
  };

  const handleEndRelationshipClick = (repUserId: string) => {
    setEndingRepUserId(repUserId);
    setShowEndRelationshipDialog(true);
  };

  const handleEndRelationship = async () => {
    if (!endingRepUserId || !user) return;

    setEnding(true);
    try {
      // Find the rep being ended
      const endingRep = connectedReps.find(r => r.repUserId === endingRepUserId);

      // Update vendor_connections status to 'ended'
      const { error: connError } = await supabase
        .from("vendor_connections")
        .update({ status: "ended" })
        .eq("vendor_id", user.id)
        .eq("field_rep_id", endingRepUserId);

      if (connError) throw connError;

      // If agreement exists, update its status to 'ended'
      if (endingRep?.agreementId) {
        const { error: agreementError } = await supabase
          .from("vendor_rep_agreements")
          .update({ status: "ended" })
          .eq("id", endingRep.agreementId);

        if (agreementError) throw agreementError;
      }

      // Remove from list
      setConnectedReps(prev => prev.filter(r => r.repUserId !== endingRepUserId));

      setShowEndRelationshipDialog(false);
      
      toast({
        title: "Relationship ended",
        description: "This Field Rep has been removed from your active list.",
      });

      // Show exit review dialog
      setExitReviewRepUserId(endingRepUserId);
      setShowExitReviewDialog(true);

      // Store data for potential repost dialog
      if (endingRep) {
        setRepostData({
          coverageSummary: endingRep.coverageSummary,
          pricingSummary: endingRep.pricingSummary,
        });
      }

      setEndingRepUserId(null);
    } catch (error: any) {
      console.error("Error ending relationship:", error);
      toast({
        title: "Error",
        description: "Failed to end relationship",
        variant: "destructive",
      });
    } finally {
      setEnding(false);
    }
  };

  const handleExitReviewComplete = () => {
    // After exit review, show repost dialog
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
    // Reload reps to get updated review
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
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="mb-6 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">My Reps</h1>
            <p className="text-muted-foreground mt-1">
              Field reps you've marked as Connected across your Seeking Coverage posts.
            </p>
          </div>
        </div>

        {connectedReps.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center">
              <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">No connections yet</h3>
              <p className="text-muted-foreground mb-4">
                When you mark interested reps as Connected, they'll appear here.
              </p>
              <Button onClick={() => navigate("/vendor/seeking-coverage")}>
                View Seeking Coverage
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-foreground">Field Rep</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-foreground">Coverage & Pricing</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-foreground">Trust Score</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-foreground">Connected Since</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {connectedReps.map((rep) => (
                  <tr key={rep.repUserId} className="border-b border-border hover:bg-muted/50 transition-colors">
                    <td className="py-4 px-4">
                      <div className="flex flex-col gap-1">
                        <button
                          onClick={() => handleViewProfile(rep.repUserId)}
                          className="text-primary hover:underline font-semibold flex items-center gap-2 w-fit"
                        >
                          {rep.anonymousId}
                          <Eye className="w-4 h-4" />
                        </button>
                        {(rep.firstName || rep.lastInitial) && (
                          <p className="text-xs text-muted-foreground">
                            {rep.firstName} {rep.lastInitial}.
                          </p>
                        )}
                        {hasNotesByRep[rep.repUserId] && (
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
                        {rep.agreementId ? (
                          <>
                            <p className="text-muted-foreground">
                              Coverage: {rep.coverageSummary || "Not specified"}
                            </p>
                            <p className="text-muted-foreground">
                              Pricing: {rep.pricingSummary || "Not specified"}
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
                      <span title="Trust Score feature coming soon">Coming soon</span>
                    </td>
                    <td className="py-4 px-4 text-sm text-muted-foreground">
                      {rep.connectedAt && new Date(rep.connectedAt).toLocaleDateString()}
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex gap-2 justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewProfile(rep.repUserId)}
                        >
                          View Profile
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleReviewRep(rep)}
                        >
                          {rep.review ? "Edit Review" : "Leave Review"}
                        </Button>
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => handleMessage(rep.repUserId, rep.conversationId)}
                        >
                          View Messages
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled
                          title={rep.agreementId ? "Edit Agreement feature coming soon" : "Create Agreement feature coming soon"}
                        >
                          {rep.agreementId ? "Edit Agreement" : "Create Agreement"}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEndRelationshipClick(rep.repUserId)}
                          className="text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground"
                        >
                          End Relationship
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
              {connectedReps.map((rep) => (
                <Card key={`notes-${rep.repUserId}`}>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      {rep.anonymousId}
                      {hasNotesByRep[rep.repUserId] && (
                        <Badge variant="secondary" className="text-xs">
                          <StickyNote className="w-3 h-3 mr-1" />
                          Has Notes
                        </Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Existing Notes */}
                    {rep.notes && rep.notes.length > 0 ? (
                      <div className="space-y-2 max-h-32 overflow-y-auto">
                        {rep.notes.slice(0, 3).map((n) => (
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
                                    onClick={() => handleSaveEditedNote(n.id, rep.repUserId)}
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
                      <p className="text-xs text-muted-foreground italic">No notes yet for this rep.</p>
                    )}

                    {/* Add New Note */}
                    <div className="flex gap-2 pt-2 border-t border-border">
                      <textarea
                        className="flex-1 text-xs rounded-md border bg-background px-2 py-1"
                        rows={2}
                        placeholder="Add a quick note about this rep..."
                        value={noteDrafts[rep.repUserId] || ""}
                        onChange={(e) =>
                          setNoteDrafts((prev) => ({ ...prev, [rep.repUserId]: e.target.value }))
                        }
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleAddNote(rep.repUserId)}
                      >
                        Save
                      </Button>
                    </div>

                    {/* End Relationship Button */}
                    <div className="pt-2 border-t border-border">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEndRelationshipClick(rep.repUserId)}
                        className="text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground"
                      >
                        End Relationship with {rep.anonymousId}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>

      {selectedRepUserId && (
        <PublicProfileDialog
          open={profileDialogOpen}
          onOpenChange={setProfileDialogOpen}
          targetUserId={selectedRepUserId}
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
    </div>
  );
};

export default VendorMyReps;
