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
import { ExitReviewDialog } from "@/components/ExitReviewDialog";

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
  notes?: Array<{
    id: string;
    note: string;
    created_at: string;
  }>;
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
  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false);
  const [disconnectingInterestId, setDisconnectingInterestId] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const [showExitReviewDialog, setShowExitReviewDialog] = useState(false);
  const [pendingDisconnectData, setPendingDisconnectData] = useState<{
    repInterestId: string;
    subjectUserId: string;
    postId?: string | null;
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
      // First, get all posts belonging to this vendor
      const { data: vendorPosts } = await supabase
        .from("seeking_coverage_posts")
        .select("id")
        .eq("vendor_id", user.id);

      if (!vendorPosts || vendorPosts.length === 0) {
        setLoading(false);
        return;
      }

      const postIds = vendorPosts.map((p) => p.id);

      // Get all connected rep_interest entries for these posts
      const { data: interests, error } = await supabase
        .from("rep_interest")
        .select(`
          id,
          status,
          created_at,
          post_id,
          rep_profile:rep_id (
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
          ),
          seeking_coverage_posts:post_id (
            id,
            title,
            state_code
          )
        `)
        .eq("status", "connected")
        .in("post_id", postIds);

      if (error) {
        console.error("Error loading connected reps:", error);
        toast({
          title: "Error",
          description: "Failed to load your connected reps.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // Deduplicate by rep user_id and aggregate posts
      const repsMap = new Map<string, ConnectedRep>();

      for (const interest of interests || []) {
        const repProfile = interest.rep_profile as any;
        const post = interest.seeking_coverage_posts as any;
        
        if (!repProfile || !post) continue;

        const repUserId = repProfile.user_id;

        if (!repsMap.has(repUserId)) {
          const fullName = repProfile.profiles?.full_name || "";
          const nameParts = fullName.split(" ");
          const firstName = nameParts[0] || "";
          const lastInitial = nameParts.length > 1 ? nameParts[nameParts.length - 1].charAt(0) : "";

          repsMap.set(repUserId, {
            repUserId,
            anonymousId: repProfile.anonymous_id || `FieldRep#${repUserId.substring(0, 6)}`,
            firstName,
            lastInitial,
            city: repProfile.city,
            state: repProfile.state,
            systemsUsed: repProfile.systems_used || [],
            inspectionTypes: repProfile.inspection_types || [],
            isAcceptingNewVendors: repProfile.is_accepting_new_vendors ?? true,
            willingToTravelOutOfState: repProfile.willing_to_travel_out_of_state ?? false,
            connectedPosts: [],
          });
        }

        // Add this post to the rep's connected posts
        const rep = repsMap.get(repUserId)!;
        rep.connectedPosts.push({
          id: post.id,
          title: post.title,
          stateCode: post.state_code,
          interestId: interest.id,
        });
      }

      // Convert map to array and fetch conversation IDs
      const repsArray = Array.from(repsMap.values());

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
      const repUserIds = repsArray.map(r => r.repUserId);
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
      }

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

  const handleDisconnectClick = (interestId: string) => {
    setDisconnectingInterestId(interestId);
    setShowDisconnectDialog(true);
  };

  const handleDisconnect = async () => {
    if (!disconnectingInterestId) return;

    setDisconnecting(true);
    try {
      const { error } = await supabase
        .from("rep_interest")
        .update({ status: "disconnected" })
        .eq("id", disconnectingInterestId);

      if (error) throw error;

      // Find the rep that's being disconnected to get subject_id and post_id
      const disconnectedRep = connectedReps.find(rep =>
        rep.connectedPosts.some(post => post.interestId === disconnectingInterestId)
      );

      // Remove the rep from the list
      setConnectedReps(prev => {
        return prev.filter(rep => {
          return !rep.connectedPosts.some(post => post.interestId === disconnectingInterestId);
        });
      });

      setShowDisconnectDialog(false);

      // Trigger Exit Review flow
      if (disconnectedRep) {
        setPendingDisconnectData({
          repInterestId: disconnectingInterestId,
          subjectUserId: disconnectedRep.repUserId,
          postId: disconnectedRep.connectedPosts[0]?.id || null,
        });
        setShowExitReviewDialog(true);
      }

      setDisconnectingInterestId(null);
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

  function handleExitReviewComplete() {
    // Exit review completed or skipped
    setPendingDisconnectData(null);
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
          <div className="space-y-4">
            {connectedReps.map((rep) => (
              <Card key={rep.repUserId}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <button
                          onClick={() => handleViewProfile(rep.repUserId)}
                          className="text-primary hover:underline font-semibold text-lg flex items-center gap-2"
                        >
                          {rep.anonymousId}
                          <Eye className="w-4 h-4" />
                        </button>
                        {hasNotesByRep[rep.repUserId] && (
                          <span 
                            className="inline-flex items-center gap-1 text-xs text-muted-foreground"
                            title="You have private notes on this connection"
                          >
                            <StickyNote className="w-3 h-3" />
                            Notes
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {rep.firstName} {rep.lastInitial}.
                      </p>
                      {(rep.city || rep.state) && (
                        <p className="text-sm text-muted-foreground">
                          {rep.city && rep.state ? `${rep.city}, ${rep.state}` : rep.city || rep.state}
                        </p>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Systems and Inspection Types */}
                  <div className="space-y-2">
                    {rep.systemsUsed.length > 0 && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Systems Used:</p>
                        <div className="flex flex-wrap gap-1">
                          {rep.systemsUsed.slice(0, 4).map((system, idx) => (
                            <Badge key={idx} variant="secondary" className="text-xs">
                              {system}
                            </Badge>
                          ))}
                          {rep.systemsUsed.length > 4 && (
                            <Badge variant="outline" className="text-xs">
                              +{rep.systemsUsed.length - 4} more
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}
                    {rep.inspectionTypes.length > 0 && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Inspection Types:</p>
                        <div className="flex flex-wrap gap-1">
                          {rep.inspectionTypes.slice(0, 4).map((type, idx) => (
                            <Badge key={idx} variant="secondary" className="text-xs">
                              {type}
                            </Badge>
                          ))}
                          {rep.inspectionTypes.length > 4 && (
                            <Badge variant="outline" className="text-xs">
                              +{rep.inspectionTypes.length - 4} more
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Availability */}
                  <div className="text-sm">
                    <span className="text-muted-foreground">Accepting new vendors: </span>
                    <span className={rep.isAcceptingNewVendors ? "text-green-500" : "text-muted-foreground"}>
                      {rep.isAcceptingNewVendors ? "Yes" : "No"}
                    </span>
                  </div>

                  {/* Connected Posts */}
                  <div>
                    <p className="text-sm font-medium mb-2">
                      Connected on {rep.connectedPosts.length} post{rep.connectedPosts.length !== 1 ? "s" : ""}
                    </p>
                    <div className="space-y-1">
                      {rep.connectedPosts.slice(0, 2).map((post) => (
                        <p key={post.id} className="text-xs text-muted-foreground">
                          {post.stateCode ? `${post.stateCode} – ` : ""}{post.title}
                        </p>
                      ))}
                      {rep.connectedPosts.length > 2 && (
                        <p className="text-xs text-muted-foreground">
                          +{rep.connectedPosts.length - 2} more
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewProfile(rep.repUserId)}
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      View Profile
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => handleMessage(rep.repUserId, rep.conversationId)}
                    >
                      <MessageSquare className="w-4 h-4 mr-2" />
                      Message
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDisconnectClick(rep.connectedPosts[0].interestId)}
                      className="text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground"
                    >
                      Disconnect
                    </Button>
                  </div>

                  {/* Notes Section */}
                  <div className="pt-3 border-t border-border mt-2 space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">Notes (private to your account)</p>

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

                    <div className="flex gap-2">
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
                  </div>
                </CardContent>
              </Card>
            ))}
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

      <AlertDialog open={showDisconnectDialog} onOpenChange={setShowDisconnectDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>End Connection?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove this connection from your My Reps / My Vendors list, but your message history will remain. You can reconnect again later if you both agree.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {disconnecting ? "Disconnecting..." : "Yes, disconnect"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {pendingDisconnectData && (
        <ExitReviewDialog
          open={showExitReviewDialog}
          onOpenChange={setShowExitReviewDialog}
          repInterestId={pendingDisconnectData.repInterestId}
          subjectUserId={pendingDisconnectData.subjectUserId}
          postId={pendingDisconnectData.postId}
          onComplete={handleExitReviewComplete}
        />
      )}
    </div>
  );
};

export default VendorMyReps;
