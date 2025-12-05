import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, MessageSquare, Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getUserDisplayName } from "@/lib/conversations";
import { formatDistanceToNow } from "date-fns";
import { PublicProfileDialog } from "@/components/PublicProfileDialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "@/hooks/use-toast";
import { fetchBlockedUserIds } from "@/lib/blocks";
import { useSectionCounts } from "@/hooks/useSectionCounts";

interface ConversationWithParticipant {
  id: string;
  last_message_at: string | null;
  last_message_preview: string | null;
  participant_one: string;
  participant_two: string;
  origin_type: string | null;
  origin_post_id: string | null;
  post_title_snapshot: string | null;
  hidden_for_one: boolean;
  hidden_for_two: boolean;
  seeking_post?: {
    id: string;
    title: string;
    state_code: string | null;
    status: string;
  } | null;
  otherParticipantName: string;
  otherParticipantUserId: string;
  unreadCount: number;
  hasPendingConnection?: boolean;
}

interface PendingConnectionRequest {
  id: string;
  vendor_id: string;
  field_rep_id: string;
  vendor_name: string;
  requested_at: string;
  conversation_id: string | null;
}

export default function MessagesList() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const sectionCounts = useSectionCounts();
  const [conversations, setConversations] = useState<ConversationWithParticipant[]>([]);
  const [loading, setLoading] = useState(true);
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [selectedProfileUserId, setSelectedProfileUserId] = useState<string | null>(null);
  const [pendingRequests, setPendingRequests] = useState<PendingConnectionRequest[]>([]);
  const [isRep, setIsRep] = useState(false);
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<"all" | "seeking" | "direct">("all");
  const [openPostsOnly, setOpenPostsOnly] = useState(false);
  const [blockedUserIds, setBlockedUserIds] = useState<string[]>([]);

  useEffect(() => {
    if (authLoading) return;
    
    if (!user) {
      navigate("/signin");
      return;
    }

    loadUserRole();
    loadBlockedUsers();
    loadConversations();
    loadPendingRequests();
  }, [user, authLoading, navigate]);

  async function loadBlockedUsers() {
    const blocked = await fetchBlockedUserIds();
    setBlockedUserIds(blocked);
  }

  async function loadUserRole() {
    if (!user) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("is_fieldrep")
      .eq("id", user.id)
      .maybeSingle();

    setIsRep(profile?.is_fieldrep || false);
  }

  async function loadPendingRequests() {
    if (!user) return;

    // Check if user is a rep
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_fieldrep")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile?.is_fieldrep) return;

    // Fetch pending vendor connections for this field rep
    const { data: connections, error } = await supabase
      .from("vendor_connections")
      .select(`
        id,
        vendor_id,
        field_rep_id,
        requested_at,
        conversation_id
      `)
      .eq("field_rep_id", user.id)
      .eq("status", "pending")
      .order("requested_at", { ascending: false });

    if (error) {
      console.error("Error loading pending requests:", error);
      return;
    }

    if (!connections || connections.length === 0) {
      setPendingRequests([]);
      return;
    }

    // Get unique vendor IDs
    const vendorIds = [...new Set(connections.map((c) => c.vendor_id))];

    // Fetch vendor profiles and base profiles
    const { data: vendorProfiles } = await supabase
      .from("vendor_profile")
      .select("user_id, anonymous_id, company_name")
      .in("user_id", vendorIds);

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", vendorIds);

    // Build maps
    const vendorProfileMap = new Map(
      (vendorProfiles || []).map((vp) => [vp.user_id, vp])
    );
    const profileMap = new Map(
      (profiles || []).map((p) => [p.id, p])
    );

    // Combine the data
    const requests: PendingConnectionRequest[] = connections.map((conn) => {
      const vendorProfile = vendorProfileMap.get(conn.vendor_id);
      const baseProfile = profileMap.get(conn.vendor_id);
      
      // Display name: prefer vendor company name, fallback to anonymous ID or full name
      let displayName = vendorProfile?.company_name || vendorProfile?.anonymous_id || "Vendor";
      if (!vendorProfile?.company_name && baseProfile?.full_name) {
        displayName = baseProfile.full_name;
      }

      return {
        id: conn.id,
        vendor_id: conn.vendor_id,
        field_rep_id: conn.field_rep_id,
        vendor_name: displayName,
        requested_at: conn.requested_at,
        conversation_id: conn.conversation_id,
      };
    });

    setPendingRequests(requests);
  }

  async function handleAcceptRequest(requestId: string) {
    setProcessingRequestId(requestId);
    try {
      const { error } = await supabase
        .from("vendor_connections")
        .update({ 
          status: "connected",
          responded_at: new Date().toISOString()
        })
        .eq("id", requestId);

      if (error) throw error;

      toast({
        title: "Connection accepted",
        description: "This vendor is now in your network.",
      });

      // Remove from pending requests
      setPendingRequests(prev => prev.filter(r => r.id !== requestId));
      
      // Reload conversations to update pending indicators
      await loadConversations();
    } catch (error) {
      console.error("Error accepting request:", error);
      toast({
        title: "Error",
        description: "Failed to accept connection request.",
        variant: "destructive",
      });
    } finally {
      setProcessingRequestId(null);
    }
  }

  async function handleDeclineRequest(requestId: string) {
    setProcessingRequestId(requestId);
    try {
      const { error } = await supabase
        .from("vendor_connections")
        .update({ 
          status: "declined",
          responded_at: new Date().toISOString()
        })
        .eq("id", requestId);

      if (error) throw error;

      toast({
        title: "Connection declined",
        description: "This connection request has been declined.",
      });

      // Remove from pending requests
      setPendingRequests(prev => prev.filter(r => r.id !== requestId));
      
      // Reload conversations to update pending indicators
      await loadConversations();
    } catch (error) {
      console.error("Error declining request:", error);
      toast({
        title: "Error",
        description: "Failed to decline connection request.",
        variant: "destructive",
      });
    } finally {
      setProcessingRequestId(null);
    }
  }

  async function handleArchive(conversationId: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!user) return;

    const conv = conversations.find((c) => c.id === conversationId);
    if (!conv) return;

    const isParticipantOne = conv.participant_one === user.id;
    
    try {
      const { error } = await supabase
        .from("conversations")
        .update(
          isParticipantOne ? { hidden_for_one: true } : { hidden_for_two: true }
        )
        .eq("id", conversationId);

      if (error) throw error;

      // Remove from local state
      setConversations((prev) => prev.filter((c) => c.id !== conversationId));

      toast({
        title: "Conversation archived",
        description: "The conversation has been hidden from your inbox.",
      });
    } catch (error) {
      console.error("Error archiving conversation:", error);
      toast({
        title: "Error",
        description: "Failed to archive conversation.",
        variant: "destructive",
      });
    }
  }

  async function loadConversations() {
    if (!user) return;

    setLoading(true);
    try {
      // Fetch all conversations where user is a participant
      const { data, error } = await supabase
        .from("conversations")
        .select(`
          id,
          participant_one,
          participant_two,
          last_message_at,
          last_message_preview,
          origin_type,
          origin_post_id,
          post_title_snapshot,
          hidden_for_one,
          hidden_for_two,
          seeking_post:origin_post_id (
            id,
            title,
            state_code,
            status
          )
        `)
        .or(`participant_one.eq.${user.id},participant_two.eq.${user.id}`)
        .order("last_message_at", { ascending: false, nullsFirst: false });

      if (error) {
        console.error("Error loading conversations:", error);
        return;
      }

      // Fetch unread counts for all conversations
      const { data: unreadMessages, error: unreadError } = await supabase
        .from("messages")
        .select("conversation_id")
        .eq("recipient_id", user.id)
        .eq("read", false);

      if (unreadError) {
        console.error("Error loading unread counts:", unreadError);
      }

      // Build unread counts map
      const unreadCounts: Record<string, number> = {};
      (unreadMessages || []).forEach((m) => {
        unreadCounts[m.conversation_id] = (unreadCounts[m.conversation_id] || 0) + 1;
      });

      // Get display names for other participants and attach unread counts
      const conversationsWithNames: ConversationWithParticipant[] = await Promise.all(
        (data || []).map(async (conv) => {
          const otherUserId = conv.participant_one === user.id 
            ? conv.participant_two 
            : conv.participant_one;
          
          const otherParticipantName = await getUserDisplayName(otherUserId);
          
          return {
            ...conv,
            otherParticipantName,
            otherParticipantUserId: otherUserId,
            unreadCount: unreadCounts[conv.id] || 0,
            hasPendingConnection: false, // Will be updated below if applicable
          };
        })
      );

      // Filter out archived conversations and blocked users
      const filteredConversations = conversationsWithNames.filter((conv) => {
        const isParticipantOne = conv.participant_one === user.id;
        const isArchived = isParticipantOne ? conv.hidden_for_one : conv.hidden_for_two;
        const isBlocked = blockedUserIds.includes(conv.otherParticipantUserId);
        return !isArchived && !isBlocked;
      });

      // Load pending connection states for field reps
      if (filteredConversations.length > 0) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("is_fieldrep")
          .eq("id", user.id)
          .maybeSingle();

        if (profile?.is_fieldrep) {
          // Get all vendor user IDs from conversations
          const vendorIds = filteredConversations.map(conv => conv.otherParticipantUserId);
          
          // Query vendor_connections for pending connections
          const { data: pendingConnections } = await supabase
            .from("vendor_connections")
            .select("vendor_id")
            .eq("field_rep_id", user.id)
            .eq("status", "pending")
            .in("vendor_id", vendorIds);

          // Build a set of vendor IDs with pending connections
          const pendingVendorIds = new Set(
            (pendingConnections || []).map(c => c.vendor_id)
          );

          // Mark conversations with pending connections
          filteredConversations.forEach(conv => {
            conv.hasPendingConnection = pendingVendorIds.has(conv.otherParticipantUserId);
          });
        }
      }

      setConversations(filteredConversations);
    } catch (error) {
      console.error("Unexpected error loading conversations:", error);
    } finally {
      setLoading(false);
    }
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-8">
        <div className="max-w-4xl mx-auto">
          <p className="text-muted-foreground">Loading messages...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-foreground">Messages</h1>
              {sectionCounts.unreadMessages > 0 && (
                <span className="text-sm text-muted-foreground">
                  ({sectionCounts.unreadMessages} conversation{sectionCounts.unreadMessages !== 1 ? "s" : ""} with unread messages)
                </span>
              )}
            </div>
          </div>
          
          {/* Primary Filter */}
          <div className="flex items-center gap-3">
            <div className="flex gap-2">
              <Button
                variant={filterMode === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilterMode("all")}
              >
                All
              </Button>
              <Button
                variant={filterMode === "seeking" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilterMode("seeking")}
              >
                Seeking Coverage
              </Button>
              <Button
                variant={filterMode === "direct" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilterMode("direct")}
              >
                Direct
              </Button>
            </div>
            
            {/* Secondary Filter - Open Posts Only */}
            {filterMode === "seeking" && (
              <div className="flex items-center gap-2 pl-3 border-l border-border">
                <Button
                  variant={openPostsOnly ? "default" : "outline"}
                  size="sm"
                  onClick={() => setOpenPostsOnly(!openPostsOnly)}
                >
                  Open Posts Only
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Pending Connection Requests */}
        {isRep && pendingRequests.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">
              Connection Requests ({pendingRequests.length})
            </h2>
            {pendingRequests.map((request) => (
              <Alert key={request.id} className="border-amber-500/40 bg-amber-500/10">
                <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <div className="text-sm">
                      <span className="font-semibold">{request.vendor_name}</span> has requested to connect with you.
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Request sent – {new Date(request.requested_at).toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                        hour12: true
                      })}
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button 
                      size="sm" 
                      onClick={() => handleAcceptRequest(request.id)}
                      disabled={processingRequestId === request.id}
                    >
                      {processingRequestId === request.id ? "Accepting..." : "Accept"}
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => handleDeclineRequest(request.id)}
                      disabled={processingRequestId === request.id}
                      className="text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground"
                    >
                      {processingRequestId === request.id ? "Declining..." : "Decline"}
                    </Button>
                  </div>
                </AlertDescription>
              </Alert>
            ))}
          </div>
        )}

        {/* Conversations List */}
        {(() => {
          // Apply filters in order: primary filter, then secondary filter
          let filteredConversations = conversations;

          // 1. Apply primary filter (All / Seeking Coverage / Direct)
          if (filterMode === "seeking") {
            // Only Seeking Coverage conversations
            filteredConversations = filteredConversations.filter((conv) => 
              conv.origin_type === "seeking_coverage" && conv.origin_post_id
            );
          } else if (filterMode === "direct") {
            // Only Direct conversations (not tied to Seeking Coverage)
            filteredConversations = filteredConversations.filter((conv) => 
              conv.origin_type !== "seeking_coverage" || !conv.origin_post_id
            );
          }
          // filterMode === "all" → no additional filtering

          // 2. Apply secondary filter (Open Posts Only) - only affects Seeking Coverage
          if (filterMode === "seeking" && openPostsOnly) {
            filteredConversations = filteredConversations.filter((conv) => {
              // Only show conversations whose posts are still open/active
              if (!conv.seeking_post) return false;
              return conv.seeking_post.status === "active";
            });
          }

          if (filteredConversations.length === 0) {
            let emptyTitle = "No conversations yet";
            let emptyMessage = "Your messages will appear here once you start a conversation.";

            if (filterMode === "seeking") {
              emptyTitle = openPostsOnly 
                ? "No conversations with open posts" 
                : "No Seeking Coverage conversations";
              emptyMessage = openPostsOnly
                ? "Turn off 'Open Posts Only' to see conversations for closed posts."
                : "Conversations about Seeking Coverage work will appear here.";
            } else if (filterMode === "direct") {
              emptyTitle = "No direct conversations";
              emptyMessage = "Direct conversations not tied to Seeking Coverage posts will appear here.";
            }

            return (
              <Card className="p-12 text-center">
                <MessageSquare className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                <h2 className="text-xl font-semibold text-foreground mb-2">
                  {emptyTitle}
                </h2>
                <p className="text-muted-foreground">
                  {emptyMessage}
                </p>
              </Card>
            );
          }

          return (
            <div className="space-y-3">
              {filteredConversations.map((conv) => {
              const isSeekingCoverage = conv.origin_type === "seeking_coverage";
              const mainTitle = isSeekingCoverage
                ? (conv.post_title_snapshot || conv.seeking_post?.title || "Seeking Coverage Conversation")
                : conv.otherParticipantName;
              const subtitle = isSeekingCoverage ? `with ${conv.otherParticipantName}` : undefined;

              return (
                <Card
                  key={conv.id}
                  className="p-4 hover:bg-accent/50 transition-colors cursor-pointer"
                  onClick={() => navigate(`/messages/${conv.id}`)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-foreground">
                          {mainTitle}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedProfileUserId(conv.otherParticipantUserId);
                            setProfileDialogOpen(true);
                          }}
                          className="text-muted-foreground hover:text-primary transition-colors"
                          title="View profile"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                        {conv.unreadCount > 0 && (
                          <Badge variant="secondary" className="ml-2 bg-orange-500/20 text-orange-500 hover:bg-orange-500/30">
                            {conv.unreadCount}
                          </Badge>
                        )}
                        {conv.hasPendingConnection && (
                          <Badge variant="outline" className="ml-2 bg-amber-500/10 text-amber-500 border-amber-500/30 text-xs">
                            Connection Request Pending
                          </Badge>
                        )}
                      </div>
                      {subtitle && (
                        <p className="text-xs text-muted-foreground mb-1">{subtitle}</p>
                      )}
                      {conv.last_message_preview && (
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {conv.last_message_preview}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      {conv.last_message_at && (
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatDistanceToNow(new Date(conv.last_message_at), { addSuffix: true })}
                        </span>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => handleArchive(conv.id, e)}
                        className="h-8 px-3 text-xs shrink-0"
                        title="Archive conversation"
                      >
                        Archive
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
          );
        })()}
        
        <PublicProfileDialog
          open={profileDialogOpen}
          onOpenChange={setProfileDialogOpen}
          targetUserId={selectedProfileUserId}
        />
      </div>
    </div>
  );
}
