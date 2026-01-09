import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
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
import { 
  ArrowLeft, 
  Eye, 
  Building2, 
  MessageSquare, 
  FileText, 
  Star, 
  Calendar, 
  MapPin,
  Edit,
  Trash2,
  Plus
} from "lucide-react";
import { PublicProfileDialog } from "@/components/PublicProfileDialog";
import { ReviewDialog, Review } from "@/components/ReviewDialog";
import { RepExitReviewDialog } from "@/components/RepExitReviewDialog";
import { fetchTrustScoresForUsers } from "@/lib/reviews";
import { ReviewsDetailDialog } from "@/components/ReviewsDetailDialog";
import { VendorCalendarDialog } from "@/components/VendorCalendarDialog";
import { WorkingTermsDialog } from "@/components/WorkingTermsDialog";
import { AgreementDetailsDialog } from "@/components/AgreementDetailsDialog";
import { getOrCreateConversation } from "@/lib/conversations";
import { format } from "date-fns";

interface VendorNote {
  id: string;
  note: string;
  created_at: string;
}

interface VendorDetails {
  vendorUserId: string;
  anonymousId: string;
  companyName: string;
  firstName: string;
  lastInitial: string;
  city: string | null;
  state: string | null;
  systemsUsed: string[];
  inspectionTypes: string[];
  connectedAt?: string | null;
  conversationId?: string;
  notes?: VendorNote[];
  review?: Review | null;
  agreementId?: string | null;
  coverageSummary?: string | null;
  pricingSummary?: string | null;
  baseRate?: number | null;
  statesCovered?: string[] | null;
  effectiveDate?: string | null;
  workType?: string | null;
  trustScore?: number | null;
  trustScoreCount?: number;
  communityScore?: number;
}

export default function RepVendorDetails() {
  const navigate = useNavigate();
  const { vendorId } = useParams<{ vendorId: string }>();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [vendor, setVendor] = useState<VendorDetails | null>(null);
  
  // Dialog states
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [showCalendarDialog, setShowCalendarDialog] = useState(false);
  const [showReviewsDialog, setShowReviewsDialog] = useState(false);
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false);
  const [showExitReviewDialog, setShowExitReviewDialog] = useState(false);
  const [showWorkingTermsDialog, setShowWorkingTermsDialog] = useState(false);
  const [showAgreementDialog, setShowAgreementDialog] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  
  // Notes
  const [noteDraft, setNoteDraft] = useState("");
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editedNoteText, setEditedNoteText] = useState("");

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/signin");
      return;
    }

    if (user && vendorId) {
      loadVendorDetails();
    }
  }, [user, authLoading, vendorId, navigate]);

  const loadVendorDetails = async () => {
    if (!user || !vendorId) return;

    setLoading(true);
    try {
      // Check connection exists
      const { data: connection, error: connError } = await supabase
        .from("vendor_connections")
        .select("id, vendor_id, requested_at")
        .eq("field_rep_id", user.id)
        .eq("vendor_id", vendorId)
        .eq("status", "connected")
        .maybeSingle();

      if (connError || !connection) {
        toast({
          title: "Not Found",
          description: "Vendor connection not found.",
          variant: "destructive",
        });
        navigate("/rep/my-vendors");
        return;
      }

      // Get vendor profile
      const { data: vendorProfile } = await supabase
        .from("vendor_profile")
        .select(`
          user_id,
          anonymous_id,
          company_name,
          city,
          state,
          systems_used,
          primary_inspection_types,
          profiles:user_id (
            full_name
          )
        `)
        .eq("user_id", vendorId)
        .single();

      if (!vendorProfile) {
        toast({
          title: "Not Found",
          description: "Vendor profile not found.",
          variant: "destructive",
        });
        navigate("/rep/my-vendors");
        return;
      }

      const fullName = (vendorProfile.profiles as any)?.full_name || "";
      const nameParts = fullName.split(" ");
      const firstName = nameParts[0] || "";
      const lastInitial = nameParts.length > 1 ? nameParts[nameParts.length - 1].charAt(0) : "";

      // Get agreement
      const { data: agreement } = await supabase
        .from("vendor_rep_agreements")
        .select("id, coverage_summary, pricing_summary, base_rate, states_covered, effective_date, work_type, created_at")
        .eq("field_rep_id", user.id)
        .eq("vendor_id", vendorId)
        .eq("status", "active")
        .maybeSingle();

      // Get conversation
      const [p1, p2] = [user.id, vendorId].sort();
      const { data: conv } = await supabase
        .from("conversations")
        .select("id")
        .eq("participant_one", p1)
        .eq("participant_two", p2)
        .maybeSingle();

      // Get notes
      const { data: notesData } = await supabase
        .from("connection_notes")
        .select("id, note, created_at")
        .eq("rep_id", user.id)
        .eq("vendor_id", vendorId)
        .eq("side", "rep")
        .order("created_at", { ascending: false });

      // Get reviews
      const { data: reviewsData } = await supabase
        .from("reviews")
        .select("*")
        .eq("reviewer_id", user.id)
        .eq("reviewee_id", vendorId)
        .eq("direction", "rep_to_vendor")
        .order("created_at", { ascending: false })
        .limit(1);

      // Get trust scores
      const trustScores = await fetchTrustScoresForUsers([vendorId]);

      // Get community score
      const { data: communityData } = await supabase
        .from("profiles")
        .select("community_score")
        .eq("id", vendorId)
        .single();

      setVendor({
        vendorUserId: vendorId,
        anonymousId: vendorProfile.anonymous_id || `Vendor#${vendorId.substring(0, 6)}`,
        companyName: vendorProfile.company_name || "Vendor",
        firstName,
        lastInitial,
        city: vendorProfile.city,
        state: vendorProfile.state,
        systemsUsed: vendorProfile.systems_used || [],
        inspectionTypes: vendorProfile.primary_inspection_types || [],
        connectedAt: agreement?.created_at || connection.requested_at,
        conversationId: conv?.id,
        notes: notesData || [],
        review: reviewsData?.[0] as Review || null,
        agreementId: agreement?.id || null,
        coverageSummary: agreement?.coverage_summary || null,
        pricingSummary: agreement?.pricing_summary || null,
        baseRate: agreement?.base_rate || null,
        statesCovered: agreement?.states_covered || null,
        effectiveDate: agreement?.effective_date || null,
        workType: agreement?.work_type || null,
        trustScore: trustScores[vendorId]?.average || null,
        trustScoreCount: trustScores[vendorId]?.count || 0,
        communityScore: communityData?.community_score || 0,
      });
    } catch (error) {
      console.error("Error loading vendor details:", error);
      toast({
        title: "Error",
        description: "Failed to load vendor details.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleMessage = async () => {
    if (!user || !vendor) return;

    if (vendor.conversationId) {
      navigate(`/messages/${vendor.conversationId}`);
      return;
    }

    const result = await getOrCreateConversation(user.id, vendor.vendorUserId);
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

  const handleAddNote = async () => {
    if (!user || !vendor || !noteDraft.trim()) return;

    const { data, error } = await supabase
      .from("connection_notes")
      .insert([{
        vendor_id: vendor.vendorUserId,
        rep_id: user.id,
        author_id: user.id,
        side: "rep",
        note: noteDraft.trim(),
      }])
      .select("id, note, created_at")
      .single();

    if (error) {
      toast({ title: "Error", description: "Failed to save note.", variant: "destructive" });
      return;
    }

    setVendor(prev => prev ? {
      ...prev,
      notes: [data, ...(prev.notes || [])],
    } : null);
    setNoteDraft("");
    toast({ title: "Note Added", description: "Your note has been saved." });
  };

  const handleSaveEditedNote = async (noteId: string) => {
    if (!editedNoteText.trim()) return;

    const { error } = await supabase
      .from("connection_notes")
      .update({ note: editedNoteText.trim() })
      .eq("id", noteId);

    if (error) {
      toast({ title: "Error", description: "Failed to update note.", variant: "destructive" });
      return;
    }

    setVendor(prev => prev ? {
      ...prev,
      notes: prev.notes?.map(n => n.id === noteId ? { ...n, note: editedNoteText.trim() } : n),
    } : null);
    setEditingNoteId(null);
    setEditedNoteText("");
    toast({ title: "Note Updated", description: "Your note has been updated." });
  };

  const handleDisconnect = async () => {
    if (!user || !vendor) return;

    setDisconnecting(true);
    try {
      const { error: connError } = await supabase
        .from("vendor_connections")
        .update({ status: "ended" })
        .eq("vendor_id", vendor.vendorUserId)
        .eq("field_rep_id", user.id);

      if (connError) throw connError;

      if (vendor.agreementId) {
        await supabase
          .from("vendor_rep_agreements")
          .update({ status: "ended" })
          .eq("id", vendor.agreementId);
      }

      setShowDisconnectDialog(false);
      toast({
        title: "Relationship ended",
        description: "This Vendor has been removed from your active list.",
      });

      setShowExitReviewDialog(true);
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

  const handleReviewSaved = () => {
    loadVendorDetails();
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-lg text-muted-foreground">Loading vendor details...</div>
      </div>
    );
  }

  if (!vendor) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <Button variant="ghost" onClick={() => navigate("/rep/my-vendors")} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to My Vendors
        </Button>
        <Card>
          <CardContent className="py-12 text-center">
            <Building2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">Vendor not found.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <>
      <div className="container mx-auto px-4 py-6 md:py-8 max-w-3xl">
        {/* Back button */}
        <Button variant="ghost" onClick={() => navigate("/rep/my-vendors")} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to My Vendors
        </Button>

        {/* Header Card */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
              <div>
                <CardTitle className="text-xl md:text-2xl flex items-center gap-2">
                  {vendor.companyName}
                  <Badge variant="default">Connected</Badge>
                </CardTitle>
                {(vendor.city || vendor.state) && (
                  <p className="text-muted-foreground flex items-center gap-1 mt-1">
                    <MapPin className="h-4 w-4" />
                    {vendor.city && vendor.state ? `${vendor.city}, ${vendor.state}` : vendor.city || vendor.state}
                  </p>
                )}
                <p className="text-sm text-muted-foreground mt-1">
                  {vendor.anonymousId} • {vendor.firstName} {vendor.lastInitial && `${vendor.lastInitial}.`}
                </p>
              </div>
              
              {/* Trust Score */}
              <div className="flex items-center gap-4">
                {vendor.trustScore !== null && (
                  <button
                    onClick={() => setShowReviewsDialog(true)}
                    className="text-center hover:opacity-80 transition-opacity"
                  >
                    <div className="flex items-center gap-1 text-lg font-semibold">
                      <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
                      {vendor.trustScore.toFixed(1)}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {vendor.trustScoreCount} review{vendor.trustScoreCount !== 1 ? "s" : ""}
                    </p>
                  </button>
                )}
                {vendor.communityScore !== undefined && vendor.communityScore > 0 && (
                  <div className="text-center">
                    <div className="text-lg font-semibold text-primary">
                      +{vendor.communityScore}
                    </div>
                    <p className="text-xs text-muted-foreground">Community</p>
                  </div>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Connected Since */}
            {vendor.connectedAt && (
              <p className="text-sm text-muted-foreground mb-4">
                Connected since {format(new Date(vendor.connectedAt), "MMM d, yyyy")}
              </p>
            )}

            {/* Primary Actions */}
            <div className="flex flex-wrap gap-2">
              <Button onClick={handleMessage}>
                <MessageSquare className="h-4 w-4 mr-2" />
                Messages
              </Button>
              {vendor.agreementId && (
                <Button variant="outline" onClick={() => setShowAgreementDialog(true)}>
                  <FileText className="h-4 w-4 mr-2" />
                  Agreement
                </Button>
              )}
              <Button 
                variant="outline" 
                onClick={() => setShowReviewDialog(true)}
              >
                <Star className="h-4 w-4 mr-2" />
                {vendor.review ? "Update Review" : "Post Review"}
              </Button>
              <Button variant="outline" onClick={() => setShowCalendarDialog(true)}>
                <Calendar className="h-4 w-4 mr-2" />
                Calendar
              </Button>
              <Button variant="outline" onClick={() => setProfileDialogOpen(true)}>
                <Eye className="h-4 w-4 mr-2" />
                Profile
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Working Terms Section */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Working Terms</CardTitle>
          </CardHeader>
          <CardContent>
            {vendor.statesCovered && vendor.statesCovered.length > 0 ? (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  {vendor.statesCovered.map(state => (
                    <Badge key={state} variant="secondary">{state}</Badge>
                  ))}
                </div>
                {vendor.baseRate && (
                  <p className="text-sm text-muted-foreground">
                    Base rate: ${vendor.baseRate}
                  </p>
                )}
                <Button 
                  variant="link" 
                  className="p-0 h-auto text-primary"
                  onClick={() => setShowWorkingTermsDialog(true)}
                >
                  View working terms details →
                </Button>
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-muted-foreground mb-2">No working terms set up yet.</p>
                <Button variant="outline" size="sm" onClick={() => setShowWorkingTermsDialog(true)}>
                  Set Up Working Terms
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Connection Notes Section */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Connection Notes</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Add Note */}
            <div className="flex gap-2 mb-4">
              <Textarea
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                placeholder="Add a private note about this vendor..."
                rows={2}
                className="flex-1"
              />
              <Button onClick={handleAddNote} disabled={!noteDraft.trim()}>
                <Plus className="h-4 w-4 mr-1" />
                Add
              </Button>
            </div>

            {/* Notes List */}
            {vendor.notes && vendor.notes.length > 0 ? (
              <div className="space-y-3">
                {vendor.notes.map((note) => (
                  <div key={note.id} className="bg-muted/50 rounded-lg p-3">
                    {editingNoteId === note.id ? (
                      <div className="space-y-2">
                        <Textarea
                          value={editedNoteText}
                          onChange={(e) => setEditedNoteText(e.target.value)}
                          rows={2}
                        />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => handleSaveEditedNote(note.id)}>
                            Save
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={() => {
                              setEditingNoteId(null);
                              setEditedNoteText("");
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm whitespace-pre-wrap">{note.note}</p>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(note.created_at), "MMM d, yyyy h:mm a")}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditingNoteId(note.id);
                              setEditedNoteText(note.note);
                            }}
                          >
                            <Edit className="h-3 w-3 mr-1" />
                            Edit
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No notes yet. Add notes to keep track of important details.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Disconnect Section */}
        <Card className="border-destructive/30">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-destructive">End Connection</p>
                <p className="text-sm text-muted-foreground">
                  Remove this vendor from your active list
                </p>
              </div>
              <Button 
                variant="outline" 
                className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                onClick={() => setShowDisconnectDialog(true)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Disconnect
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Dialogs */}
      <PublicProfileDialog
        open={profileDialogOpen}
        onOpenChange={setProfileDialogOpen}
        targetUserId={vendor.vendorUserId}
      />

      <VendorCalendarDialog
        open={showCalendarDialog}
        onOpenChange={setShowCalendarDialog}
        vendorId={vendor.vendorUserId}
        vendorName={vendor.companyName}
      />

      <ReviewsDetailDialog
        open={showReviewsDialog}
        onOpenChange={setShowReviewsDialog}
        targetUserId={vendor.vendorUserId}
      />

      {user && (
        <ReviewDialog
          open={showReviewDialog}
          onOpenChange={(open) => {
            setShowReviewDialog(open);
            if (!open) handleReviewSaved();
          }}
          reviewerId={user.id}
          revieweeId={vendor.vendorUserId}
          direction="rep_to_vendor"
          repInterestId={null}
          existingReview={vendor.review}
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

      {user && (
        <RepExitReviewDialog
          open={showExitReviewDialog}
          onOpenChange={(open) => {
            setShowExitReviewDialog(open);
            if (!open) {
              navigate("/rep/my-vendors");
            }
          }}
          vendorUserId={vendor.vendorUserId}
          repUserId={user.id}
        />
      )}

      <WorkingTermsDialog
        open={showWorkingTermsDialog}
        onOpenChange={setShowWorkingTermsDialog}
        vendorId={vendor.vendorUserId}
        repId={user?.id || ""}
        vendorName={vendor.companyName}
        mode="rep"
      />
    </>
  );
}
