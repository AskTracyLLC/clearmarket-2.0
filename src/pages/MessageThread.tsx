import { useEffect, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useMimic } from "@/hooks/useMimic";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, Send, Eye, CheckCircle2, MoreVertical, ClipboardCheck, Clock, Ban } from "lucide-react";
import { getUserDisplayName } from "@/lib/conversations";
import { toast } from "@/hooks/use-toast";
import { formatDistanceToNow, format, parseISO } from "date-fns";
import { PublicProfileDialog } from "@/components/PublicProfileDialog";
import { TemplateSelector } from "@/components/TemplateSelector";
import { ExitReviewDialog } from "@/components/ExitReviewDialog";
import { CreateAgreementDialog } from "@/components/CreateAgreementDialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { blockUser, unblockUser, isUserBlocked } from "@/lib/blocks";
import { ReportFlagButton } from "@/components/ReportFlagButton";
import { ReportUserDialog } from "@/components/ReportUserDialog";
import { checkAlreadyReported } from "@/lib/reports";
import { useBlockStatus } from "@/hooks/useBlockStatus";

import { AssignTerritoryDialog } from "@/components/AssignTerritoryDialog";
import { TerritoryAssignmentBanner } from "@/components/TerritoryAssignmentBanner";
import { 
  TerritoryAssignment, 
  fetchPendingAssignmentForConversation,
  fetchActiveAssignmentForConversation 
} from "@/lib/territoryAssignments";
import { formatVendorOfferedRate } from "@/lib/vendorRateDisplay";
import { DeclineRepDialog } from "@/components/DeclineRepDialog";
import { checklist } from "@/lib/checklistTracking";

interface Message {
  id: string;
  sender_id: string;
  recipient_id: string;
  body: string;
  created_at: string;
}

export default function MessageThread() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const { user, loading: authLoading } = useAuth();
  const { effectiveUserId } = useMimic();
  const navigate = useNavigate();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [otherParticipantId, setOtherParticipantId] = useState<string>("");
  const [otherParticipantName, setOtherParticipantName] = useState<string>("");
  const [messageText, setMessageText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [conversationData, setConversationData] = useState<any>(null);
  const [otherPartyProfile, setOtherPartyProfile] = useState<any>(null);
  const [currentUserProfile, setCurrentUserProfile] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [isVendor, setIsVendor] = useState(false);
  const [isRep, setIsRep] = useState(false);
  const [repInterest, setRepInterest] = useState<any>(null);
  const [connectingStatus, setConnectingStatus] = useState(false);
  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [showExitReviewDialog, setShowExitReviewDialog] = useState(false);
  const [pendingDisconnectData, setPendingDisconnectData] = useState<{
    repInterestId: string;
    repUserId: string;
    vendorUserId: string;
    postId?: string | null;
  } | null>(null);
  const [vendorConnection, setVendorConnection] = useState<any>(null);
  const [loadingVendorConnection, setLoadingVendorConnection] = useState(false);
  const [agreement, setAgreement] = useState<any>(null);
  const [creatingAgreement, setCreatingAgreement] = useState(false);
  const [showAgreementDialog, setShowAgreementDialog] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [showBlockDialog, setShowBlockDialog] = useState(false);
  const [blockReason, setBlockReason] = useState("");
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [alreadyReported, setAlreadyReported] = useState(false);
  const [showAssignTerritoryDialog, setShowAssignTerritoryDialog] = useState(false);
  const [pendingAssignment, setPendingAssignment] = useState<TerritoryAssignment | null>(null);
  const [activeAssignment, setActiveAssignment] = useState<TerritoryAssignment | null>(null);
  const [showDeclineDialog, setShowDeclineDialog] = useState(false);

  // Bidirectional block check - used to hide Connect buttons
  const blockStatus = useBlockStatus(otherParticipantId || null);

  useEffect(() => {
    if (authLoading) return;
    
    if (!user) {
      navigate("/signin");
      return;
    }

    if (!conversationId) {
      navigate("/messages");
      return;
    }

    loadConversationData();
  }, [effectiveUserId, authLoading, conversationId, navigate]);

  useEffect(() => {
    // Load agreement, block status, report status, and territory assignments when we have effective user and other participant
    if (effectiveUserId && otherParticipantId) {
      loadAgreement();
      checkBlockStatus();
      checkReportStatus();
    }
  }, [effectiveUserId, otherParticipantId, conversationId]);

  useEffect(() => {
    // Load territory assignments when conversation data is available
    if (conversationId && conversationData?.origin_type === "seeking_coverage") {
      loadTerritoryAssignments();
    }
  }, [conversationId, conversationData]);

  async function checkBlockStatus() {
    if (!otherParticipantId) return;
    
    const blocked = await isUserBlocked(otherParticipantId);
    setIsBlocked(blocked);
  }

  async function checkReportStatus() {
    if (!effectiveUserId || !otherParticipantId) return;
    
    const reported = await checkAlreadyReported(effectiveUserId, otherParticipantId, conversationId);
    setAlreadyReported(reported);
  }

  useEffect(() => {
    // Scroll to bottom when messages change
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function loadConversationData() {
    if (!effectiveUserId || !conversationId) return;

    setLoading(true);
    try {
      // Check if current user (or mimicked user) is a vendor or rep
      const { data: profile } = await supabase
        .from("profiles")
        .select("is_vendor_admin, is_fieldrep")
        .eq("id", effectiveUserId)
        .single();
      
      setIsVendor(profile?.is_vendor_admin || false);
      setIsRep(profile?.is_fieldrep || false);

      // Load current user's profile for templates
      if (profile?.is_fieldrep) {
        const { data: repProfile } = await supabase
          .from("rep_profile")
          .select("*")
          .eq("user_id", effectiveUserId)
          .maybeSingle();
        
        if (repProfile) {
          setCurrentUserProfile({
            type: "rep",
            anonymous_id: repProfile.anonymous_id,
            state: repProfile.state,
            systems_used: repProfile.systems_used || [],
            inspection_types: repProfile.inspection_types || []
          });
        }
      }

      // Load conversation with Seeking Coverage origin data
      const { data: conversation, error: convError } = await supabase
        .from("conversations")
        .select(`
          participant_one,
          participant_two,
          origin_type,
          origin_post_id,
          rep_interest_id,
          post_title_snapshot,
          seeking_post:origin_post_id (
            id,
            title,
            state_code,
            status,
            county_id,
            pay_type,
            pay_min,
            pay_max,
            pay_notes,
            us_counties:county_id (
              county_name,
              state_code,
              state_name
            )
          )
        `)
        .eq("id", conversationId)
        .maybeSingle();

      if (convError || !conversation) {
        toast({
          title: "Error",
          description: "Could not load conversation",
          variant: "destructive",
        });
        navigate("/messages");
        return;
      }

      // Verify user (or mimicked user) is a participant
      if (conversation.participant_one !== effectiveUserId && conversation.participant_two !== effectiveUserId) {
        toast({
          title: "Access Denied",
          description: "You are not authorized to view this conversation",
          variant: "destructive",
        });
        navigate("/messages");
        return;
      }

      // Store conversation data with origin info
      setConversationData(conversation);

      // Determine other participant
      const otherId = conversation.participant_one === effectiveUserId 
        ? conversation.participant_two 
        : conversation.participant_one;
      
      setOtherParticipantId(otherId);
      
      // Get other participant's display name
      const name = await getUserDisplayName(otherId);
      setOtherParticipantName(name);

      // If this is a Seeking Coverage conversation, load other party's public profile and rep_interest
      if (conversation.origin_type === "seeking_coverage") {
        await loadOtherPartyProfile(otherId, conversation.seeking_post);
        await loadRepInterest(conversation);
      }

      // Load vendor connection for any vendor-rep conversation (pair-based, not thread-based)
      await loadVendorConnection(otherId, profile?.is_vendor_admin || false, profile?.is_fieldrep || false);

      // Load messages
      await loadMessages();
    } catch (error) {
      console.error("Error loading conversation data:", error);
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  async function loadRepInterest(conversation: any) {
    if (!conversation.rep_interest_id) return;

    try {
      const { data: interest, error } = await supabase
        .from("rep_interest")
        .select("id, status, rep_id, post_id, declined_reason, declined_at")
        .eq("id", conversation.rep_interest_id)
        .maybeSingle();

      if (error) {
        console.error("Error loading rep_interest:", error);
        return;
      }

      setRepInterest(interest);
    } catch (error) {
      console.error("Error loading rep interest:", error);
    }
  }

  async function loadOtherPartyProfile(userId: string, seekingPost?: any) {
    try {
      // Check if they're a rep or vendor
      const { data: repProfile } = await supabase
        .from("rep_profile")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      const { data: vendorProfile } = await supabase
        .from("vendor_profile")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      // Load basic profile info
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", userId)
        .maybeSingle();

      if (repProfile) {
        // Load coverage for this rep's state if available
        let coverageData = null;
        const stateCode = seekingPost?.state_code;
        if (stateCode) {
          const { data: coverage } = await supabase
            .from("rep_coverage_areas")
            .select(`
              county_name,
              base_price,
              rush_price,
              county_id,
              us_counties:county_id (
                county_name,
                state_code,
                state_name
              )
            `)
            .eq("user_id", userId);
          
          // Filter by state in JS since state_code is unreliable
          coverageData = coverage?.filter(c => 
            c.us_counties?.state_code === stateCode
          );
        }

        setOtherPartyProfile({
          type: "rep",
          anonymous_id: repProfile.anonymous_id,
          full_name: profile?.full_name,
          city: repProfile.city,
          state: repProfile.state,
          systems_used: repProfile.systems_used || [],
          inspection_types: repProfile.inspection_types || [],
          is_accepting_new_vendors: repProfile.is_accepting_new_vendors,
          coverage: coverageData || []
        });
      } else if (vendorProfile) {
        setOtherPartyProfile({
          type: "vendor",
          anonymous_id: vendorProfile.anonymous_id,
          company_name: vendorProfile.company_name,
          full_name: profile?.full_name,
          city: vendorProfile.city,
          state: vendorProfile.state,
          systems_used: vendorProfile.systems_used || [],
          primary_inspection_types: vendorProfile.primary_inspection_types || [],
          is_accepting_new_reps: vendorProfile.is_accepting_new_reps
        });
      }
    } catch (error) {
      console.error("Error loading other party profile:", error);
    }
  }

  async function loadMessages() {
    if (!conversationId || !effectiveUserId) return;

    const { data, error } = await supabase
      .from("messages")
      .select("id, sender_id, recipient_id, body, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error loading messages:", error);
      return;
    }

    setMessages(data || []);

    // Mark all unread messages in this conversation as read
    await supabase
      .from("messages")
      .update({ read: true })
      .eq("conversation_id", conversationId)
      .eq("recipient_id", effectiveUserId)
      .eq("read", false);
  }

  async function loadAgreement() {
    if (!effectiveUserId || !otherParticipantId) return;

    try {
      // Check if agreement exists between this vendor and rep
      const { data, error } = await supabase
        .from("vendor_rep_agreements")
        .select("*")
        .or(`and(vendor_id.eq.${effectiveUserId},field_rep_id.eq.${otherParticipantId}),and(vendor_id.eq.${otherParticipantId},field_rep_id.eq.${effectiveUserId})`)
        .maybeSingle();

      if (!error && data) {
        setAgreement(data);
      }
    } catch (error) {
      console.error("Error loading agreement:", error);
    }
  }

  async function loadTerritoryAssignments() {
    if (!conversationId) return;

    const pending = await fetchPendingAssignmentForConversation(conversationId);
    setPendingAssignment(pending);

    const active = await fetchActiveAssignmentForConversation(conversationId);
    setActiveAssignment(active);
  }

  async function loadVendorConnection(otherId: string, userIsVendor: boolean, userIsRep: boolean) {
    if (!effectiveUserId) return;
    
    setLoadingVendorConnection(true);
    try {
      // Determine vendor and rep IDs based on current user's role
      const vendorId = userIsVendor ? effectiveUserId : otherId;
      const repId = userIsRep ? effectiveUserId : otherId;

      const { data, error } = await supabase
        .from("vendor_connections")
        .select("*")
        .eq("vendor_id", vendorId)
        .eq("field_rep_id", repId)
        .maybeSingle();

      if (!error) {
        setVendorConnection(data);
      }
    } catch (error) {
      console.error("Error loading vendor connection:", error);
    } finally {
      setLoadingVendorConnection(false);
    }
  }

  async function handleCreateAgreement(data: {
    coverageSummary: string;
    pricingSummary: string;
    baseRate?: number;
    markPostFilled: boolean;
    statesCovered: string[];
  }) {
    if (!user || !otherParticipantId) return;

    setCreatingAgreement(true);
    try {
      // Ensure vendor_connections exists and is connected
      const { data: existingConn } = await supabase
        .from("vendor_connections")
        .select("*")
        .eq("vendor_id", isVendor ? user.id : otherParticipantId)
        .eq("field_rep_id", isVendor ? otherParticipantId : user.id)
        .maybeSingle();

      if (!existingConn) {
        // Create vendor_connections entry
        await supabase
          .from("vendor_connections")
          .insert({
            vendor_id: isVendor ? user.id : otherParticipantId,
            field_rep_id: isVendor ? otherParticipantId : user.id,
            status: "connected",
            requested_by: "vendor",
            responded_at: new Date().toISOString(),
          });
      } else if (existingConn.status === "pending") {
        // Update to connected
        await supabase
          .from("vendor_connections")
          .update({
            status: "connected",
            responded_at: new Date().toISOString(),
          })
          .eq("id", existingConn.id);
      }

      // Create agreement
      const { data: newAgreement, error } = await supabase
        .from("vendor_rep_agreements")
        .insert({
          vendor_id: isVendor ? user.id : otherParticipantId,
          field_rep_id: isVendor ? otherParticipantId : user.id,
          status: "active",
          coverage_summary: data.coverageSummary,
          pricing_summary: data.pricingSummary,
          base_rate: data.baseRate,
          states_covered: data.statesCovered,
        })
        .select()
        .single();

      if (error) {
        // Check for duplicate
        if (error.code === "23505") {
          toast({
            title: "Agreement Already Exists",
            description: "An agreement already exists with this field rep.",
            variant: "default",
          });
          loadAgreement();
          setShowAgreementDialog(false);
          return;
        }
        throw error;
      }

      // Mark post as filled if requested
      if (data.markPostFilled && conversationData?.seeking_post?.id) {
        await supabase
          .from("seeking_coverage_posts")
          .update({ status: "closed" })
          .eq("id", conversationData.seeking_post.id);
      }

      setAgreement(newAgreement);
      setShowAgreementDialog(false);
      
      // Track first agreement created for checklist
      if (isVendor && user) {
        checklist.firstAgreementCreated(user.id);
      }
      
      const toastTitle = data.markPostFilled ? "Agreement created & post filled" : "Agreement created";
      const toastDescription = data.markPostFilled
        ? "The Seeking Coverage post is now marked as filled, and this rep was added to your My Field Reps list."
        : "This Field Rep has been added to your My Field Reps list with the selected coverage and pricing.";
      
      toast({
        title: toastTitle,
        description: toastDescription,
      });
    } catch (error: any) {
      console.error("Error creating agreement:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to create agreement.",
        variant: "destructive",
      });
    } finally {
      setCreatingAgreement(false);
    }
  }

  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !conversationId || !messageText.trim() || !otherParticipantId) return;

    // Block check
    if (isBlocked) {
      toast({
        title: "Cannot send message",
        description: "You have blocked this user. Unblock them to send messages.",
        variant: "destructive",
      });
      return;
    }

    setSending(true);
    try {
      const { error } = await supabase
        .from("messages")
        .insert({
          conversation_id: conversationId,
          sender_id: user.id,
          recipient_id: otherParticipantId,
          body: messageText.trim(),
        });

      if (error) throw error;

      // Update conversation's last_message_at and preview
      await supabase
        .from("conversations")
        .update({
          last_message_at: new Date().toISOString(),
          last_message_preview: messageText.trim().substring(0, 100),
        })
        .eq("id", conversationId);

      // Create notification for recipient
      await supabase
        .from("notifications")
        .insert({
          user_id: otherParticipantId,
          type: "new_message",
          title: "New message",
          body: messageText.trim().substring(0, 100),
          ref_id: conversationId,
        });

      setMessageText("");
      await loadMessages();
      
      // Track first message sent by vendor for checklist
      if (isVendor) {
        checklist.firstRepMessageSent(user.id);
      }
    } catch (error) {
      console.error("Error sending message:", error);
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  }

  async function handleBlockUser() {
    if (!otherParticipantId) return;
    
    setBlocking(true);
    try {
      const { error } = await blockUser(otherParticipantId, blockReason.trim() || undefined);
      if (error) throw new Error(error);
      
      setIsBlocked(true);
      setShowBlockDialog(false);
      setBlockReason("");
      toast({
        title: "User blocked",
        description: "You will no longer see messages from this user.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to block user",
        variant: "destructive",
      });
    } finally {
      setBlocking(false);
    }
  }

  async function handleUnblockUser() {
    if (!otherParticipantId) return;
    
    setBlocking(true);
    try {
      const { error } = await unblockUser(otherParticipantId);
      if (error) throw new Error(error);
      
      setIsBlocked(false);
      toast({
        title: "User unblocked",
        description: "You can now send and receive messages from this user.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to unblock user",
        variant: "destructive",
      });
    } finally {
      setBlocking(false);
    }
  }

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <>
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        {/* Back button and header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate("/messages")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Messages
            </Button>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setProfileDialogOpen(true)}
                className="flex items-center gap-2"
              >
                <Eye className="h-4 w-4" />
                <span className="font-medium">{otherParticipantName}</span>
              </Button>
            </div>
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {isBlocked ? (
                <DropdownMenuItem onClick={handleUnblockUser} disabled={blocking}>
                  Unblock User
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={() => setShowBlockDialog(true)}>
                  Block User
                </DropdownMenuItem>
              )}
              <DropdownMenuItem 
                onClick={() => setShowReportDialog(true)}
                disabled={alreadyReported}
              >
                {alreadyReported ? "Already Reported" : "Report User"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Block warning */}
        {isBlocked && (
          <Alert className="mb-4 border-orange-500/50 bg-orange-500/10">
            <AlertDescription>
              You have blocked this user. You can still view the conversation history, but cannot send new messages until you unblock them.
            </AlertDescription>
          </Alert>
        )}

        {/* Territory Assignment Banner for Reps */}
        {isRep && pendingAssignment && effectiveUserId && (
          <div className="mb-4">
            <TerritoryAssignmentBanner
              assignment={pendingAssignment}
              repUserId={effectiveUserId}
              onUpdate={() => {
                loadTerritoryAssignments();
                loadAgreement();
                loadMessages();
              }}
            />
          </div>
        )}

        {/* Seeking Coverage Context Header */}
        {conversationData?.origin_type === "seeking_coverage" && conversationData?.seeking_post && (
          <Card className="mb-4 bg-secondary/20 border-secondary/30">
            <CardHeader className="py-3">
              <CardTitle className="text-sm flex items-center justify-between">
                <span>Connected via Seeking Coverage</span>
                {isVendor && (
                  <Button variant="ghost" size="sm" onClick={() => navigate("/vendor/seeking-coverage")}>
                    View Seeking Coverage
                  </Button>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="py-2 space-y-2">
              <div className="text-sm">
                <span className="font-medium">{conversationData.seeking_post.title}</span>
                {conversationData.seeking_post.state_code && (
                  <Badge variant="outline" className="ml-2">{conversationData.seeking_post.state_code}</Badge>
                )}
              </div>
              {isVendor && (conversationData.seeking_post.pay_min != null || conversationData.seeking_post.pay_max != null) && (
                <div className="text-sm text-muted-foreground">
                  Pay: {formatVendorOfferedRate(
                    conversationData.seeking_post.pay_min,
                    conversationData.seeking_post.pay_max,
                    conversationData.seeking_post.pay_type
                  )}
                </div>
              )}
              {/* Rate comparison indicator - vendor only */}
              {isVendor && otherPartyProfile?.type === "rep" && (() => {
                const postMax = conversationData.seeking_post.pay_max;
                const postCountyId = conversationData.seeking_post.county_id;
                const postCountyName = conversationData.seeking_post.us_counties?.county_name;
                // Find the rep's coverage for this specific county
                const repCoverage = otherPartyProfile.coverage?.find((c: any) => 
                  c.county_id === postCountyId || 
                  (postCountyName && (c.us_counties?.county_name === postCountyName || c.county_name === postCountyName))
                );
                // Fallback to first coverage in state if no specific county match
                const repRate = repCoverage?.base_price ?? otherPartyProfile.coverage?.[0]?.base_price;
                
                if (postMax != null && repRate != null) {
                  if (repRate > postMax) {
                    return (
                      <div className="flex items-center gap-2 px-2 py-1.5 bg-amber-500/10 border border-amber-500/30 rounded-md">
                        <span className="text-amber-600 text-sm font-medium">⚠ Rate above posted amount</span>
                        <span className="text-xs text-muted-foreground">
                          Rep base: ${repRate.toFixed(2)}/order · Your posted max: ${postMax.toFixed(2)}/order
                        </span>
                      </div>
                    );
                  } else if (repRate < postMax) {
                    return (
                      <div className="text-xs text-green-600">
                        ✓ Rep base rate (${repRate.toFixed(2)}) is below your posted max (${postMax.toFixed(2)})
                      </div>
                    );
                  } else {
                    return (
                      <div className="text-xs text-green-600">
                        ✓ Rep base rate matches your posted max (${postMax.toFixed(2)})
                      </div>
                    );
                  }
                }
                return null;
              })()}
              {conversationData.seeking_post.pay_notes && (
                <div className="text-xs text-muted-foreground">{conversationData.seeking_post.pay_notes}</div>
              )}
              
              {/* Connection and Assignment Status */}
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border mt-2">
                {vendorConnection?.status === "connected" && (
                  <Badge className="bg-green-500/20 text-green-500 border-green-500/30">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Connected
                  </Badge>
                )}
                {vendorConnection?.status === "pending" && (
                  <Badge variant="outline">
                    Pending connection
                  </Badge>
                )}
                {!vendorConnection && (
                  <Badge variant="outline" className="text-muted-foreground">
                    Not yet connected
                  </Badge>
                )}
                
                {/* Territory Assignment Status */}
                {pendingAssignment && (
                  <Badge variant="outline" className="text-amber-500 border-amber-500/30">
                    <Clock className="w-3 h-3 mr-1" />
                    Agreement pending
                  </Badge>
                )}
                {activeAssignment && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge variant="outline" className="text-xs">
                          Agreement on file
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Active since {format(parseISO(activeAssignment.effective_date), "MMM d, yyyy")}</p>
                        <p>${activeAssignment.agreed_rate}/order</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                {!activeAssignment && !pendingAssignment && agreement && (
                  <Badge variant="outline" className="text-xs">
                    Agreement on file
                  </Badge>
                )}
                
                {/* Declined status badge */}
                {repInterest?.status === "declined_by_vendor" && (
                  <Badge variant="outline" className="text-muted-foreground bg-muted/50">
                    <Ban className="w-3 h-3 mr-1" />
                    Declined for this request
                  </Badge>
                )}
                
                {/* Assign Territory Button - Vendor only, no connection required for Seeking Coverage conversations */}
                {isVendor && conversationData?.seeking_post && !pendingAssignment && !activeAssignment && repInterest?.status !== "declined_by_vendor" && (
                  <>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setShowAssignTerritoryDialog(true)}
                      className="ml-auto"
                    >
                      <ClipboardCheck className="w-4 h-4 mr-1" />
                      Assign this area to rep
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-muted-foreground hover:text-destructive hover:border-destructive"
                      onClick={() => setShowDeclineDialog(true)}
                    >
                      <Ban className="w-4 h-4 mr-1" />
                      Decline
                    </Button>
                  </>
                )}
                
                {/* Show active assignment date for vendor */}
                {isVendor && activeAssignment && (
                  <span className="text-xs text-muted-foreground ml-auto">
                    Active since {format(parseISO(activeAssignment.effective_date), "MMM d, yyyy")}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Rep declined banner */}
        {isRep && repInterest?.status === "declined_by_vendor" && (
          <Alert className="mb-4 border-muted">
            <Ban className="h-4 w-4" />
            <AlertDescription>
              <p className="font-medium">You were not selected for this request</p>
              <p className="text-sm text-muted-foreground mt-1">
                This doesn't affect your overall relationship with this vendor.
                {repInterest.declined_reason && (
                  <span className="block mt-1 italic">Reason: "{repInterest.declined_reason}"</span>
                )}
              </p>
            </AlertDescription>
          </Alert>
        )}

        {/* Messages list */}
        <Card className="mb-4">
          <CardContent className="p-4">
            <div className="h-[400px] overflow-y-auto space-y-4">
              {messages.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  No messages yet. Send the first message to start the conversation.
                </div>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.sender_id === user?.id ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[70%] rounded-lg px-4 py-2 ${
                        msg.sender_id === user?.id
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary"
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap">{msg.body}</p>
                      <p className={`text-xs mt-1 ${
                        msg.sender_id === user?.id ? "text-primary-foreground/70" : "text-muted-foreground"
                      }`}>
                        {formatDistanceToNow(parseISO(msg.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>
          </CardContent>
        </Card>

        {/* Message input */}
        <form onSubmit={handleSendMessage} className="space-y-4">
          <div className="flex gap-2">
            {isRep && effectiveUserId && (
              <TemplateSelector
                userId={effectiveUserId}
                userRole="rep"
                onTemplateSelect={(body) => setMessageText(body)}
                context={currentUserProfile ? {
                  profile: {
                    rep_anonymous_id: currentUserProfile.anonymous_id,
                    rep_state: currentUserProfile.state,
                    rep_systems: currentUserProfile.systems_used,
                    rep_inspection_types: currentUserProfile.inspection_types
                  }
                } : undefined}
              />
            )}
            {isVendor && effectiveUserId && (
              <TemplateSelector
                userId={effectiveUserId}
                userRole="vendor"
                onTemplateSelect={(body) => setMessageText(body)}
              />
            )}
          </div>
          <div className="flex gap-2">
            <Textarea
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder={isBlocked ? "Unblock this user to send messages..." : "Type your message..."}
              className="flex-1 min-h-[80px]"
              disabled={isBlocked}
            />
            <Button type="submit" disabled={sending || !messageText.trim() || isBlocked}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </form>
      </div>

      {/* Dialogs */}
      <PublicProfileDialog
        open={profileDialogOpen}
        onOpenChange={setProfileDialogOpen}
        targetUserId={otherParticipantId}
      />

      <AlertDialog open={showBlockDialog} onOpenChange={setShowBlockDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Block this user?</AlertDialogTitle>
            <AlertDialogDescription>
              Blocking this user will hide their messages and prevent them from contacting you. You can unblock them later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Textarea
              placeholder="Reason (optional)"
              value={blockReason}
              onChange={(e) => setBlockReason(e.target.value)}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleBlockUser} disabled={blocking}>
              {blocking ? "Blocking..." : "Block User"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ReportUserDialog
        open={showReportDialog}
        onOpenChange={setShowReportDialog}
        reporterUserId={user?.id || ""}
        reportedUserId={otherParticipantId}
        conversationId={conversationId}
        contextLabel="Message Thread"
      />

      <CreateAgreementDialog
        open={showAgreementDialog}
        onOpenChange={setShowAgreementDialog}
        repUserId={otherParticipantId}
        repName={otherParticipantName}
        onSave={handleCreateAgreement}
        saving={creatingAgreement}
      />

      {/* Assign Territory Dialog */}
      {conversationData?.seeking_post && effectiveUserId && (
        <AssignTerritoryDialog
          open={showAssignTerritoryDialog}
          onOpenChange={setShowAssignTerritoryDialog}
          vendorId={effectiveUserId}
          repId={otherParticipantId}
          repName={otherParticipantName}
          conversationId={conversationId || ""}
          seekingCoveragePost={{
            id: conversationData.seeking_post.id,
            title: conversationData.seeking_post.title,
            state_code: conversationData.seeking_post.state_code,
            county_id: conversationData.seeking_post.county_id,
            county_name: conversationData.seeking_post.us_counties?.county_name,
            inspection_types: conversationData.seeking_post.inspection_types,
            systems_required_array: conversationData.seeking_post.systems_required_array,
            pay_max: conversationData.seeking_post.pay_max,
            pay_min: conversationData.seeking_post.pay_min,
          }}
          onSuccess={() => {
            loadTerritoryAssignments();
            loadMessages();
          }}
        />
      )}

      {/* Decline Rep Dialog */}
      {repInterest && conversationData?.seeking_post && effectiveUserId && (
        <DeclineRepDialog
          open={showDeclineDialog}
          onOpenChange={setShowDeclineDialog}
          repInterestId={repInterest.id}
          repAnonymousId={otherParticipantName}
          postTitle={conversationData.seeking_post.title}
          vendorUserId={effectiveUserId}
          repUserId={otherParticipantId}
          onDeclined={() => {
            setShowDeclineDialog(false);
            loadConversationData();
          }}
        />
      )}
    </>
  );
}
