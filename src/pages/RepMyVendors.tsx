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
import { ArrowLeft, Eye, MessageSquare, Building2, StickyNote, Edit2, X, Check } from "lucide-react";
import { getOrCreateConversation } from "@/lib/conversations";
import { PublicProfileDialog } from "@/components/PublicProfileDialog";
import { ExitReviewDialog } from "@/components/ExitReviewDialog";

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
  notes?: Array<{
    id: string;
    note: string;
    created_at: string;
  }>;
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
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [hasNotesByVendor, setHasNotesByVendor] = useState<Record<string, boolean>>({});
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editedNoteText, setEditedNoteText] = useState<string>("");
  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false);
  const [disconnectingInterestId, setDisconnectingInterestId] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const [showExitReviewDialog, setShowExitReviewDialog] = useState(false);
  const [pendingDisconnectData, setPendingDisconnectData] = useState<{
    repInterestId: string;
    repUserId: string;
    vendorUserId: string;
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
      // Step 1: Get all connected rep_interest entries with basic post info
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
            state_code
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

      // Step 2: Build map of connected vendors and collect vendor IDs
      const vendorsMap = new Map<string, ConnectedVendor>();
      const vendorIds = new Set<string>();

      for (const interest of interests || []) {
        const post = interest.seeking_coverage_posts as any;
        
        if (!post || !post.vendor_id) continue;

        const vendorUserId = post.vendor_id;
        vendorIds.add(vendorUserId);

        if (!vendorsMap.has(vendorUserId)) {
          // Initialize vendor entry with placeholder data
          vendorsMap.set(vendorUserId, {
            vendorUserId,
            anonymousId: `Vendor#${vendorUserId.substring(0, 6)}`,
            companyName: "Vendor",
            firstName: "",
            lastInitial: "",
            city: null,
            state: null,
            systemsUsed: [],
            inspectionTypes: [],
            isAcceptingNewReps: true,
            connectedPosts: [],
          });
        }

        // Add this post to the vendor's connected posts
        const vendor = vendorsMap.get(vendorUserId)!;
        vendor.connectedPosts.push({
          id: post.id,
          title: post.title,
          stateCode: post.state_code,
          interestId: interest.id,
        });
      }

      // Step 3: Fetch vendor_profile details for all connected vendors
      if (vendorIds.size > 0) {
        const { data: vendorProfiles, error: vendorError } = await supabase
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
          .in("user_id", Array.from(vendorIds));

        if (vendorError) {
          console.error("Error loading vendor profiles:", vendorError);
        }

        // Step 4: Merge vendor profile data into the map
        if (vendorProfiles) {
          for (const vendorProfile of vendorProfiles) {
            const vendor = vendorsMap.get(vendorProfile.user_id);
            if (!vendor) continue;

            const fullName = (vendorProfile.profiles as any)?.full_name || "";
            const nameParts = fullName.split(" ");
            const firstName = nameParts[0] || "";
            const lastInitial = nameParts.length > 1 ? nameParts[nameParts.length - 1].charAt(0) : "";

            // Update vendor with profile data
            vendor.anonymousId = vendorProfile.anonymous_id || `Vendor#${vendorProfile.user_id.substring(0, 6)}`;
            vendor.companyName = vendorProfile.company_name || "Vendor";
            vendor.firstName = firstName;
            vendor.lastInitial = lastInitial;
            vendor.city = vendorProfile.city;
            vendor.state = vendorProfile.state;
            vendor.systemsUsed = vendorProfile.systems_used || [];
            vendor.inspectionTypes = vendorProfile.primary_inspection_types || [];
            vendor.isAcceptingNewReps = vendorProfile.is_accepting_new_reps ?? true;
          }
        }
      }

      // Step 5: Convert map to array and fetch conversation IDs
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

      // Step 6: Fetch notes for all vendors
      const vendorUserIds = vendorsArray.map(v => v.vendorUserId);
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

      // Find the vendor that's being disconnected to get subject_id and post_id
      const disconnectedVendor = connectedVendors.find(vendor =>
        vendor.connectedPosts.some(post => post.interestId === disconnectingInterestId)
      );

      // Remove the vendor from the list
      setConnectedVendors(prev => {
        return prev.filter(vendor => {
          return !vendor.connectedPosts.some(post => post.interestId === disconnectingInterestId);
        });
      });

      setShowDisconnectDialog(false);

      // Trigger Exit Review flow
      if (disconnectedVendor && user) {
        setPendingDisconnectData({
          repInterestId: disconnectingInterestId,
          repUserId: user.id,
          vendorUserId: disconnectedVendor.vendorUserId,
          postId: disconnectedVendor.connectedPosts[0]?.id || null,
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
                        {hasNotesByVendor[vendor.vendorUserId] && (
                          <span 
                            className="inline-flex items-center gap-1 text-xs text-muted-foreground"
                            title="You have private notes on this connection"
                          >
                            <StickyNote className="w-3 h-3" />
                            Notes
                          </span>
                        )}
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
                      onClick={() => 
                        handleMessage(
                          vendor.vendorUserId, 
                          vendor.conversationId,
                          vendor.connectedPosts[0]?.id
                        )
                      }
                    >
                      <MessageSquare className="w-4 h-4 mr-2" />
                      Message Vendor
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDisconnectClick(vendor.connectedPosts[0].interestId)}
                      className="text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground"
                    >
                      Disconnect
                    </Button>
                  </div>

                  {/* Notes Section */}
                  <div className="pt-3 border-t border-border mt-2 space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">Notes (private to you)</p>

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

                    <div className="flex gap-2">
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
          repUserId={pendingDisconnectData.repUserId}
          vendorUserId={pendingDisconnectData.vendorUserId}
          reviewerRole="rep"
          source="disconnect"
          onComplete={handleExitReviewComplete}
        />
      )}
    </div>
  );
};

export default RepMyVendors;
