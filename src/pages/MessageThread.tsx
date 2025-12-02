import { useEffect, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, Send, Eye, CheckCircle2 } from "lucide-react";
import { getUserDisplayName } from "@/lib/conversations";
import { toast } from "@/hooks/use-toast";
import { formatDistanceToNow, format } from "date-fns";
import { PublicProfileDialog } from "@/components/PublicProfileDialog";
import { TemplateSelector } from "@/components/TemplateSelector";
import { ExitReviewDialog } from "@/components/ExitReviewDialog";
import { CreateAgreementDialog } from "@/components/CreateAgreementDialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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
  }, [user, authLoading, conversationId, navigate]);

  useEffect(() => {
    // Load agreement when we have user and other participant
    if (user && otherParticipantId) {
      loadAgreement();
    }
  }, [user, otherParticipantId]);

  useEffect(() => {
    // Scroll to bottom when messages change
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function loadConversationData() {
    if (!user || !conversationId) return;

    setLoading(true);
    try {
      // Check if current user is a vendor or rep
      const { data: profile } = await supabase
        .from("profiles")
        .select("is_vendor_admin, is_fieldrep")
        .eq("id", user.id)
        .single();
      
      setIsVendor(profile?.is_vendor_admin || false);
      setIsRep(profile?.is_fieldrep || false);

      // Load current user's profile for templates
      if (profile?.is_fieldrep) {
        const { data: repProfile } = await supabase
          .from("rep_profile")
          .select("*")
          .eq("user_id", user.id)
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

      // Verify user is a participant
      if (conversation.participant_one !== user.id && conversation.participant_two !== user.id) {
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
      const otherId = conversation.participant_one === user.id 
        ? conversation.participant_two 
        : conversation.participant_one;
      
      setOtherParticipantId(otherId);
      
      // Get other participant's display name
      const name = await getUserDisplayName(otherId);
      setOtherParticipantName(name);

      // If this is a Seeking Coverage conversation, load other party's public profile and rep_interest
      if (conversation.origin_type === "seeking_coverage") {
        await loadOtherPartyProfile(otherId);
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
        .select("id, status, rep_id, post_id")
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

  async function loadOtherPartyProfile(userId: string) {
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
        if (conversationData?.seeking_post?.state_code) {
          const { data: coverage } = await supabase
            .from("rep_coverage_areas")
            .select(`
              county_name,
              base_price,
              rush_price,
              us_counties:county_id (
                county_name,
                state_code,
                state_name
              )
            `)
            .eq("user_id", userId);
          
          // Filter by state in JS since state_code is unreliable
          coverageData = coverage?.filter(c => 
            c.us_counties?.state_code === conversationData.seeking_post.state_code
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
    if (!conversationId || !user) return;

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
      .eq("recipient_id", user.id)
      .eq("read", false);
  }

  async function loadAgreement() {
    if (!user || !otherParticipantId) return;

    try {
      // Check if agreement exists between this vendor and rep
      const { data, error } = await supabase
        .from("vendor_rep_agreements")
        .select("*")
        .or(`and(vendor_id.eq.${user.id},field_rep_id.eq.${otherParticipantId}),and(vendor_id.eq.${otherParticipantId},field_rep_id.eq.${user.id})`)
        .maybeSingle();

      if (!error && data) {
        setAgreement(data);
      }
    } catch (error) {
      console.error("Error loading agreement:", error);
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

  async function handleArchiveConversation() {
    if (!user || !conversationData) return;

    const isParticipantOne = conversationData.participant_one === user.id;
    
    setArchiving(true);
    try {
      const { error } = await supabase
        .from("conversations")
        .update(
          isParticipantOne ? { hidden_for_one: true } : { hidden_for_two: true }
        )
        .eq("id", conversationId);

      if (error) throw error;

      toast({
        title: "Conversation archived",
        description: "The conversation has been hidden from your inbox.",
      });

      navigate("/messages");
    } catch (error) {
      console.error("Error archiving conversation:", error);
      toast({
        title: "Error",
        description: "Failed to archive conversation.",
        variant: "destructive",
      });
    } finally {
      setArchiving(false);
    }
  }

  async function handleSendMessage() {
    if (!messageText.trim() || !user || !conversationId || !otherParticipantId) return;

    setSending(true);
    try {
      // First, unarchive conversation for both participants
      await supabase
        .from("conversations")
        .update({
          hidden_for_one: false,
          hidden_for_two: false,
        })
        .eq("id", conversationId);
      // Insert message
      const { data: newMessage, error: insertError } = await supabase
        .from("messages")
        .insert({
          conversation_id: conversationId,
          sender_id: user.id,
          recipient_id: otherParticipantId,
          body: messageText.trim(),
        })
        .select()
        .single();

      if (insertError) {
        console.error("Error sending message:", insertError);
        toast({
          title: "Error",
          description: "Failed to send message",
          variant: "destructive",
        });
        return;
      }

      // Create notification for recipient
      if (newMessage) {
        await supabase.from("notifications").insert({
          user_id: otherParticipantId,
          type: "message",
          ref_id: newMessage.id,
          title: "New message",
          body: `You have a new message from ${otherParticipantName}`,
        });
      }

      // Update conversation metadata
      const preview = messageText.trim().substring(0, 100);
      await supabase
        .from("conversations")
        .update({
          last_message_at: new Date().toISOString(),
          last_message_preview: preview,
        })
        .eq("id", conversationId);

      // Clear input and reload messages
      setMessageText("");
      await loadMessages();
    } catch (error) {
      console.error("Unexpected error sending message:", error);
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  }

  function handleTemplateInsert(templateBody: string) {
    setMessageText(templateBody);
  }

  async function handleConnect() {
    if (!repInterest || !user) return;

    setConnectingStatus(true);
    try {
      const { error } = await supabase
        .from("rep_interest")
        .update({ status: "pending_rep_confirm" })
        .eq("id", repInterest.id);

      if (error) throw error;

      // Update local state
      setRepInterest({ ...repInterest, status: "pending_rep_confirm" });
      toast({
        title: "Connection Request Sent",
        description: "The rep will need to confirm before they appear in your My Reps list.",
      });
    } catch (error: any) {
      console.error("Error requesting connection:", error);
      toast({
        title: "Error",
        description: "Failed to send connection request",
        variant: "destructive",
      });
    } finally {
      setConnectingStatus(false);
    }
  }

  async function handleAcceptConnection() {
    if (!repInterest || !user) return;

    setConnectingStatus(true);
    try {
      const { error } = await supabase
        .from("rep_interest")
        .update({ 
          status: "connected",
          connected_at: new Date().toISOString()
        })
        .eq("id", repInterest.id);

      if (error) throw error;

      // Update local state
      setRepInterest({ ...repInterest, status: "connected" });
      toast({
        title: "Connection Accepted",
        description: "This vendor is now in your My Vendors list.",
      });
    } catch (error: any) {
      console.error("Error accepting connection:", error);
      toast({
        title: "Error",
        description: "Failed to accept connection",
        variant: "destructive",
      });
    } finally {
      setConnectingStatus(false);
    }
  }

  async function handleDeclineConnection() {
    if (!repInterest || !user) return;

    setConnectingStatus(true);
    try {
      const { error } = await supabase
        .from("rep_interest")
        .update({ 
          status: "declined",
          connected_at: null
        })
        .eq("id", repInterest.id);

      if (error) throw error;

      // Update local state
      setRepInterest({ ...repInterest, status: "declined" });
      toast({
        title: "Connection Declined",
        description: "Connection request has been declined.",
      });
    } catch (error: any) {
      console.error("Error declining connection:", error);
      toast({
        title: "Error",
        description: "Failed to decline connection",
        variant: "destructive",
      });
    } finally {
      setConnectingStatus(false);
    }
  }

  async function handleDisconnect() {
    if (!repInterest || !user) return;

    setDisconnecting(true);
    try {
      const { error } = await supabase
        .from("rep_interest")
        .update({ 
          status: "disconnected",
          connected_at: null
        })
        .eq("id", repInterest.id);

      if (error) throw error;

      // Update local state
      setRepInterest({ ...repInterest, status: "disconnected" });
      setShowDisconnectDialog(false);

      // Determine rep and vendor user IDs based on user roles
      // isRep means current user is the rep, otherParticipantId is the vendor
      // isVendor means current user is the vendor, otherParticipantId is the rep
      const repUserId = isRep ? user.id : otherParticipantId;
      const vendorUserId = isVendor ? user.id : otherParticipantId;

      // Trigger Exit Review flow
      setPendingDisconnectData({
        repInterestId: repInterest.id,
        repUserId,
        vendorUserId,
        postId: conversationData?.seeking_post?.id || null,
      });
      setShowExitReviewDialog(true);
    } catch (error: any) {
      console.error("Error disconnecting:", error);
      toast({
        title: "Error",
        description: "Failed to update connection status",
        variant: "destructive",
      });
    } finally {
      setDisconnecting(false);
    }
  }

  function handleExitReviewComplete() {
    // Exit review completed or skipped
    setPendingDisconnectData(null);
  }

  async function loadVendorConnection(otherId: string, currentIsVendor?: boolean, currentIsRep?: boolean) {
    if (!user) return;

    try {
      const effectiveIsVendor = currentIsVendor ?? isVendor;
      const effectiveIsRep = currentIsRep ?? isRep;

      // Try loading vendor connection based on roles, independent of conversation
      let connection = null;
      
      if (effectiveIsVendor) {
        // Current user is vendor, other is field rep
        const { data } = await supabase
          .from("vendor_connections")
          .select("*")
          .eq("vendor_id", user.id)
          .eq("field_rep_id", otherId)
          .maybeSingle();
        
        connection = data;
      } else if (effectiveIsRep) {
        // Current user is field rep, other is vendor
        const { data } = await supabase
          .from("vendor_connections")
          .select("*")
          .eq("vendor_id", otherId)
          .eq("field_rep_id", user.id)
          .maybeSingle();
        
        connection = data;
      }

      setVendorConnection(connection);
    } catch (error) {
      console.error("Error loading vendor connection:", error);
    }
  }

  async function handleVendorConnectRequest() {
    if (!user || !otherParticipantId || !conversationId) return;

    // Verify current user is vendor using already-loaded flags
    if (!isVendor) {
      toast({
        title: "Error",
        description: "Only vendors can send connection requests",
        variant: "destructive",
      });
      return;
    }

    setLoadingVendorConnection(true);
    try {
      const vendorId = user.id;
      const fieldRepId = otherParticipantId;

      // Check if connection already exists
      const { data: existingConnection } = await supabase
        .from("vendor_connections")
        .select("*")
        .eq("vendor_id", vendorId)
        .eq("field_rep_id", fieldRepId)
        .maybeSingle();

      if (existingConnection) {
        // Connection already exists, update local state
        setVendorConnection(existingConnection);
        toast({
          title: "Connection Already Exists",
          description: `This connection is currently ${existingConnection.status}.`,
        });
        setLoadingVendorConnection(false);
        return;
      }

      // Insert vendor connection request
      const { data: newConnection, error } = await supabase
        .from("vendor_connections")
        .insert({
          vendor_id: vendorId,
          field_rep_id: fieldRepId,
          status: "pending",
          requested_by: "vendor",
          conversation_id: conversationId
        })
        .select()
        .single();

      if (error) throw error;

      setVendorConnection(newConnection);

      // Send system message
      await supabase.from("messages").insert({
        conversation_id: conversationId,
        sender_id: user.id,
        recipient_id: otherParticipantId,
        body: `${otherParticipantName} has requested to connect with you. You can accept or decline this request.`,
      });

      // Create notification for rep
      const { data: vendorProfile } = await supabase
        .from("vendor_profile")
        .select("anonymous_id")
        .eq("user_id", vendorId)
        .single();

      await supabase.from("notifications").insert({
        user_id: fieldRepId,
        type: "connection_request",
        ref_id: newConnection.id,
        title: "New connection request",
        body: `${vendorProfile?.anonymous_id || "A vendor"} wants to add you to their network.`,
      });

      // Reload messages
      await loadMessages();

      toast({
        title: "Connection Request Sent",
        description: "The rep will be notified of your request.",
      });
    } catch (error: any) {
      console.error("Error creating vendor connection:", error);
      
      // Handle duplicate key error gracefully
      if (error.code === '23505') {
        // Reload the connection state for this vendor/rep pair
        await loadVendorConnection(otherParticipantId, isVendor, isRep);
        toast({
          title: "Connection Already Exists",
          description: "A connection request was already sent to this rep.",
        });
      } else {
        toast({
          title: "Error",
          description: error.message || "Failed to send connection request",
          variant: "destructive",
        });
      }
    } finally {
      setLoadingVendorConnection(false);
    }
  }

  async function handleAcceptVendorConnection() {
    if (!vendorConnection || !user || !conversationId) return;

    setLoadingVendorConnection(true);
    try {
      const { error } = await supabase
        .from("vendor_connections")
        .update({
          status: "connected",
          responded_at: new Date().toISOString()
        })
        .eq("id", vendorConnection.id);

      if (error) throw error;

      setVendorConnection({ ...vendorConnection, status: "connected" });

      // Send system message
      await supabase.from("messages").insert({
        conversation_id: conversationId,
        sender_id: user.id,
        recipient_id: otherParticipantId,
        body: `You are now connected with ${otherParticipantName}.`,
      });

      // Reload messages
      await loadMessages();

      toast({
        title: "Connection Accepted",
        description: "You are now connected with this vendor.",
      });
    } catch (error) {
      console.error("Error accepting vendor connection:", error);
      toast({
        title: "Error",
        description: "Failed to accept connection",
        variant: "destructive",
      });
    } finally {
      setLoadingVendorConnection(false);
    }
  }

  async function handleDeclineVendorConnection() {
    if (!vendorConnection || !user || !conversationId) return;

    setLoadingVendorConnection(true);
    try {
      const { error } = await supabase
        .from("vendor_connections")
        .update({
          status: "declined",
          responded_at: new Date().toISOString()
        })
        .eq("id", vendorConnection.id);

      if (error) throw error;

      setVendorConnection({ ...vendorConnection, status: "declined" });

      // Send system message
      await supabase.from("messages").insert({
        conversation_id: conversationId,
        sender_id: user.id,
        recipient_id: otherParticipantId,
        body: `You declined the connection request from ${otherParticipantName}.`,
      });

      // Reload messages
      await loadMessages();

      toast({
        title: "Connection Declined",
        description: "Connection request has been declined.",
      });
    } catch (error) {
      console.error("Error declining vendor connection:", error);
      toast({
        title: "Error",
        description: "Failed to decline connection",
        variant: "destructive",
      });
    } finally {
      setLoadingVendorConnection(false);
    }
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-8">
        <div className="max-w-4xl mx-auto">
          <p className="text-muted-foreground">Loading conversation...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => navigate("/messages")}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Messages
            </Button>
            <Button
              variant="outline"
              onClick={handleArchiveConversation}
              disabled={archiving}
            >
              {archiving ? "Archiving..." : "Archive Conversation"}
            </Button>
          </div>
          <div>
            {(() => {
              const isSeekingCoverage = conversationData?.origin_type === "seeking_coverage";
              const headerTitle = isSeekingCoverage
                ? (conversationData.post_title_snapshot || conversationData.seeking_post?.title || "Seeking Coverage Conversation")
                : `Conversation with ${otherParticipantName}`;
              const headerSubtitle = isSeekingCoverage
                ? `Conversation with ${otherParticipantName}`
                : undefined;

              return (
                <>
                  <button
                    onClick={() => setProfileDialogOpen(true)}
                    className="text-2xl font-bold text-foreground hover:text-primary transition-colors inline-flex items-center gap-2"
                  >
                    {headerTitle}
                    <Eye className="h-5 w-5" />
                  </button>
                  {headerSubtitle && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {headerSubtitle}
                    </p>
                  )}
                  {/* Connection Status Chip */}
                  {vendorConnection && (
                    <div className="mt-2">
                      {vendorConnection.status === 'pending' && (
                        <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/30 text-xs">
                          Status: Pending connection
                        </Badge>
                      )}
                      {vendorConnection.status === 'connected' && (
                        <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/30 text-xs">
                          Status: Connected {agreement ? '· Agreement on file' : '· Agreement pending'}
                        </Badge>
                      )}
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </div>

        {/* Pinned Seeking Coverage Header with Other Party Snapshot */}
        {conversationData?.origin_type === "seeking_coverage" && conversationData?.seeking_post && (
          <Card className="bg-card border-primary/30">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between text-base">
                <span>Connected via Seeking Coverage</span>
                <Badge variant="outline" className="text-xs">Post Context</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
              {/* Connection Status & Connect Button */}
              {repInterest && (
                <div className="mb-4 pb-4 border-b border-border">
                  {repInterest.status === "connected" ? (
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 text-sm text-green-500">
                        <CheckCircle2 className="h-4 w-4" />
                        <span>✓ Status: Connected on this Seeking Coverage post</span>
                      </div>
                      <Button
                        onClick={() => setShowDisconnectDialog(true)}
                        variant="outline"
                        size="sm"
                        className="text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground"
                      >
                        Disconnect
                      </Button>
                    </div>
                  ) : repInterest.status === "disconnected" ? (
                    <div className="text-sm text-muted-foreground">
                      Status: Disconnected on this Seeking Coverage post
                    </div>
                  ) : repInterest.status === "pending_rep_confirm" ? (
                    <div className="space-y-2">
                      <div className="text-sm text-amber-500">
                        Status: Pending rep confirmation
                      </div>
                      {isRep && (
                        <div className="flex gap-2">
                          <Button
                            onClick={handleAcceptConnection}
                            disabled={connectingStatus}
                            size="sm"
                            variant="default"
                          >
                            {connectingStatus ? "Accepting..." : "Accept Connection"}
                          </Button>
                          <Button
                            onClick={handleDeclineConnection}
                            disabled={connectingStatus}
                            size="sm"
                            variant="outline"
                            className="text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground"
                          >
                            {connectingStatus ? "Declining..." : "Decline"}
                          </Button>
                        </div>
                      )}
                      {isVendor && (
                        <p className="text-xs text-muted-foreground">Waiting for rep to confirm...</p>
                      )}
                    </div>
                  ) : repInterest.status === "declined" ? (
                    <div className="text-sm text-muted-foreground">
                      Status: Declined
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Status: Not connected yet</span>
                      {isVendor && (
                        <Button
                          onClick={handleConnect}
                          disabled={connectingStatus}
                          size="sm"
                        >
                          {connectingStatus ? "Requesting..." : "Request Connection"}
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Create Agreement Button for Vendors (only when connected) */}
              {isVendor && repInterest?.status === "connected" && !agreement && (
                <div className="mt-4 pt-4 border-t border-border">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          onClick={() => setShowAgreementDialog(true)}
                          disabled={creatingAgreement}
                          className="w-full"
                        >
                          Add to My Field Reps
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Create an agreement with this Field Rep, including coverage and pricing.</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              )}

              {agreement && (
                <div className="mt-4 pt-4 border-t border-border">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span>Active agreement established</span>
                  </div>
                  {agreement.coverage_summary && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Coverage: {agreement.coverage_summary}
                    </p>
                  )}
                  {agreement.pricing_summary && (
                    <p className="text-xs text-muted-foreground">
                      Pricing: {agreement.pricing_summary}
                    </p>
                  )}
                </div>
              )}

              <div className="grid md:grid-cols-2 gap-6">
                {/* Left: Post Context */}
                <div className="space-y-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Post Title</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold">{conversationData.seeking_post.title}</p>
                      {conversationData.seeking_post.status !== "active" && (
                        <Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/30 text-xs">
                          Post closed
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Location</p>
                    <p>
                      {conversationData.seeking_post.us_counties?.county_name && 
                        `${conversationData.seeking_post.us_counties.county_name}, `}
                      {conversationData.seeking_post.us_counties?.state_code || 
                       conversationData.seeking_post.state_code}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Offered Pricing</p>
                    <p className="font-semibold text-primary">
                      {conversationData.seeking_post.pay_type === "fixed"
                        ? `$${conversationData.seeking_post.pay_min?.toFixed(2)} / order`
                        : `$${conversationData.seeking_post.pay_min?.toFixed(2)} – $${conversationData.seeking_post.pay_max?.toFixed(2)} / order`}
                    </p>
                    {conversationData.seeking_post.pay_notes && (
                      <p className="text-xs text-muted-foreground italic mt-1">
                        {conversationData.seeking_post.pay_notes}
                      </p>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground pt-2 border-t border-border">
                    This conversation was started from this Seeking Coverage request.
                  </p>
                </div>

                {/* Right: Other Party Snapshot */}
                <div className="space-y-3 text-sm border-l border-border pl-6">
                  {otherPartyProfile ? (
                    <>
                      <div className="flex items-center justify-between">
                        <button
                          onClick={() => setProfileDialogOpen(true)}
                          className="text-base font-semibold text-foreground hover:text-primary transition-colors inline-flex items-center gap-2"
                        >
                          {otherPartyProfile.anonymous_id}
                          <Eye className="h-4 w-4" />
                        </button>
                      </div>

                      {otherPartyProfile.type === "rep" ? (
                        <>
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Field Rep</p>
                            <p className="font-medium">
                              {otherPartyProfile.full_name?.split(' ')[0]} {otherPartyProfile.full_name?.split(' ')[1]?.[0]}.
                            </p>
                            <p className="text-muted-foreground">
                              {otherPartyProfile.city}, {otherPartyProfile.state}
                            </p>
                          </div>
                          
                          {otherPartyProfile.systems_used?.length > 0 && (
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Systems</p>
                              <div className="flex flex-wrap gap-1">
                                {otherPartyProfile.systems_used.slice(0, 3).map((system: string) => (
                                  <Badge key={system} variant="secondary" className="text-xs">
                                    {system}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}

                          {otherPartyProfile.inspection_types?.length > 0 && (
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Types</p>
                              <div className="flex flex-wrap gap-1">
                                {otherPartyProfile.inspection_types.slice(0, 3).map((type: string) => (
                                  <Badge key={type} variant="outline" className="text-xs">
                                    {type}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}

                          <p className="text-xs text-muted-foreground">
                            Accepting new vendors: {otherPartyProfile.is_accepting_new_vendors ? "Yes" : "No"}
                          </p>
                        </>
                      ) : (
                        <>
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Vendor</p>
                            <p className="font-medium">{otherPartyProfile.company_name}</p>
                            <p className="text-muted-foreground">
                              {otherPartyProfile.city}, {otherPartyProfile.state}
                            </p>
                          </div>

                          {otherPartyProfile.systems_used?.length > 0 && (
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Systems</p>
                              <div className="flex flex-wrap gap-1">
                                {otherPartyProfile.systems_used.slice(0, 3).map((system: string) => (
                                  <Badge key={system} variant="secondary" className="text-xs">
                                    {system}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}

                          {otherPartyProfile.primary_inspection_types?.length > 0 && (
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Types</p>
                              <div className="flex flex-wrap gap-1">
                                {otherPartyProfile.primary_inspection_types.slice(0, 3).map((type: string) => (
                                  <Badge key={type} variant="outline" className="text-xs">
                                    {type}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}

                          <p className="text-xs text-muted-foreground">
                            Accepting new reps: {otherPartyProfile.is_accepting_new_reps ? "Yes" : "No"}
                          </p>
                        </>
                      )}
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">
                      Public profile not completed yet
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Vendor Connection State (works for all vendor-rep conversations) */}
        {isVendor && otherParticipantId && (
          <>
            {/* Show button only when no connection or declined */}
            {(!vendorConnection || vendorConnection.status === 'declined') && (
              <div className="flex items-center justify-between p-4 border border-border rounded-lg bg-card">
                <div>
                  <p className="font-semibold">Connect with this Field Rep</p>
                  <p className="text-sm text-muted-foreground">
                    Send a connection request to add them to your network
                  </p>
                </div>
                <Button 
                  onClick={handleVendorConnectRequest}
                  disabled={loadingVendorConnection}
                >
                  {loadingVendorConnection ? "Sending..." : "Send Connection Request"}
                </Button>
              </div>
            )}

            {/* Show additional info when pending (header chip shows status) */}
            {vendorConnection?.status === 'pending' && (
              <div className="p-4 border border-amber-500/30 rounded-lg bg-amber-500/10">
                <p className="text-sm text-muted-foreground">
                  Waiting for Field Rep to respond · Request sent {format(new Date(vendorConnection.requested_at), 'MMM d, yyyy')}
                </p>
              </div>
            )}
          </>
        )}

        {/* Rep-side Pending Vendor Connection Request Banner */}
        {isRep && 
         vendorConnection?.status === "pending" && (
          <Alert className="border-amber-500/40 bg-amber-500/10">
            <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-sm">
                <span className="font-semibold">{otherParticipantName}</span> has requested to connect with you.
                {" "}You can accept or decline this request.
              </span>
              <div className="flex gap-2 shrink-0">
                <Button 
                  size="sm" 
                  onClick={handleAcceptVendorConnection}
                  disabled={loadingVendorConnection}
                >
                  {loadingVendorConnection ? "Accepting..." : "Accept"}
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={handleDeclineVendorConnection}
                  disabled={loadingVendorConnection}
                  className="text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground"
                >
                  {loadingVendorConnection ? "Declining..." : "Decline"}
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Rep-side Pending Connection Request Banner (for Seeking Coverage) */}
        {isRep && 
         conversationData?.origin_type === "seeking_coverage" && 
         repInterest?.status === "pending_rep_confirm" && 
         otherPartyProfile?.type === "vendor" && (
          <Alert className="border-amber-500/40 bg-amber-500/10">
            <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-sm">
                <span className="font-semibold">{otherPartyProfile.anonymous_id}</span> has requested to add you to their network
                for <span className="font-medium">{conversationData.seeking_post?.title}</span>.
                {" "}If you work well together, you can accept this connection so they appear in your "My Vendors" list.
              </span>
              <div className="flex gap-2 shrink-0">
                <Button 
                  size="sm" 
                  onClick={handleAcceptConnection}
                  disabled={connectingStatus}
                >
                  {connectingStatus ? "Accepting..." : "Accept"}
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={handleDeclineConnection}
                  disabled={connectingStatus}
                  className="text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground"
                >
                  {connectingStatus ? "Declining..." : "Decline"}
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Messages Area */}
        <Card className="p-6 min-h-[500px] max-h-[600px] overflow-y-auto flex flex-col">
          <div className="flex-1 space-y-4">
            {messages.length === 0 ? (
              <div className="text-center text-muted-foreground py-12">
                No messages yet. Start the conversation!
              </div>
            ) : (
              messages.map((message) => {
                const isCurrentUser = message.sender_id === user?.id;
                const senderLabel = isCurrentUser ? "You" : otherParticipantName;
                
                return (
                  <div
                    key={message.id}
                    className={`flex flex-col ${isCurrentUser ? "items-end" : "items-start"}`}
                  >
                    <p className="text-[10px] text-muted-foreground mb-1 px-1">
                      {senderLabel}
                    </p>
                    <div
                      className={`max-w-[70%] rounded-lg p-3 ${
                        isCurrentUser
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-foreground"
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap break-words">
                        {message.body}
                      </p>
                      <span className="text-xs opacity-70 mt-1 block">
                        {new Date(message.created_at).toLocaleString('en-US', {
                          timeZone: 'America/Chicago',
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                          hour12: true
                        })} CST
                      </span>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>
        </Card>

        {/* Compose Area */}
        <Card className="p-4">
          <div className="space-y-3">
            {/* Template Selector - show for both vendors and reps in Seeking Coverage conversations */}
            {conversationData?.origin_type === "seeking_coverage" && (isVendor || isRep) && (
              <div className="flex items-center gap-2">
                <TemplateSelector
                  userId={user!.id}
                  userRole={isVendor ? "vendor" : "rep"}
                  onTemplateSelect={handleTemplateInsert}
                  context={
                    isVendor
                      ? {
                          post: {
                            title: conversationData?.seeking_post?.title,
                            state_code: conversationData?.seeking_post?.state_code,
                            county_name: conversationData?.seeking_post?.us_counties?.county_name,
                            pay_type: conversationData?.seeking_post?.pay_type,
                            pay_min: conversationData?.seeking_post?.pay_min,
                            pay_max: conversationData?.seeking_post?.pay_max,
                          },
                          profile: otherPartyProfile?.type === "rep" ? {
                            rep_anonymous_id: otherPartyProfile?.anonymous_id,
                            rep_full_name: otherPartyProfile?.full_name,
                            rep_city: otherPartyProfile?.city,
                            rep_state: otherPartyProfile?.state,
                            rep_systems: otherPartyProfile?.systems_used,
                            rep_inspection_types: otherPartyProfile?.inspection_types,
                          } : undefined,
                        }
                      : {
                          post: {
                            title: conversationData?.seeking_post?.title,
                            state_code: conversationData?.seeking_post?.state_code,
                            county_name: conversationData?.seeking_post?.us_counties?.county_name,
                            pay_type: conversationData?.seeking_post?.pay_type,
                            pay_min: conversationData?.seeking_post?.pay_min,
                            pay_max: conversationData?.seeking_post?.pay_max,
                          },
                          profile: {
                            // Rep's own profile for rep templates
                            rep_anonymous_id: currentUserProfile?.anonymous_id,
                            rep_state: currentUserProfile?.state,
                            rep_systems: currentUserProfile?.systems_used,
                            rep_inspection_types: currentUserProfile?.inspection_types,
                            // Vendor info (the other party)
                            vendor_anonymous_id: otherPartyProfile?.anonymous_id,
                            vendor_company_name: otherPartyProfile?.company_name,
                            vendor_full_name: otherPartyProfile?.full_name,
                            vendor_city: otherPartyProfile?.city,
                            vendor_state: otherPartyProfile?.state,
                            vendor_systems: otherPartyProfile?.systems_used,
                            vendor_inspection_types: otherPartyProfile?.primary_inspection_types,
                          },
                        }
                  }
                />
                <span className="text-xs text-muted-foreground">
                  Insert a template to speed up your response
                </span>
              </div>
            )}

            <div className="flex gap-2">
              <Textarea
                placeholder="Type your message..."
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                className="min-h-[80px] resize-none"
                disabled={sending}
              />
              <Button
                onClick={handleSendMessage}
                disabled={!messageText.trim() || sending}
                size="lg"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Press Enter to send, Shift+Enter for new line
            </p>
          </div>
        </Card>

        <PublicProfileDialog
          open={profileDialogOpen}
          onOpenChange={setProfileDialogOpen}
          targetUserId={otherParticipantId}
        />

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
            reviewerRole={isVendor ? "vendor" : "rep"}
            source="disconnect"
            onComplete={handleExitReviewComplete}
          />
        )}

        {/* Create Agreement Dialog */}
        {conversationData?.seeking_post && otherPartyProfile && (
          <CreateAgreementDialog
            open={showAgreementDialog}
            onOpenChange={setShowAgreementDialog}
            repUserId={otherParticipantId}
            repName={`${otherPartyProfile.full_name?.split(' ')[0]} ${otherPartyProfile.full_name?.split(' ')[1]?.[0]}.`}
            defaultCoverage={
              conversationData.seeking_post.us_counties?.county_name
                ? `${conversationData.seeking_post.us_counties.state_code} – ${conversationData.seeking_post.us_counties.county_name}`
                : conversationData.seeking_post.state_code || ""
            }
            defaultPricing={
              conversationData.seeking_post.pay_type === "fixed"
                ? `$${conversationData.seeking_post.pay_min?.toFixed(2)} / order`
                : `$${conversationData.seeking_post.pay_min?.toFixed(2)} – $${conversationData.seeking_post.pay_max?.toFixed(2)} / order`
            }
            defaultBaseRate={conversationData.seeking_post.pay_max || conversationData.seeking_post.pay_min}
            onSave={handleCreateAgreement}
            saving={creatingAgreement}
          />
        )}
      </div>
    </div>
  );
}
