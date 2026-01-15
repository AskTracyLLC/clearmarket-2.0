import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useMimic } from "@/hooks/useMimic";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MessageSquare, Eye, Headphones } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { batchGetUserDisplayNames } from "@/lib/conversations";
import { formatDistanceToNow } from "date-fns";
import { PublicProfileDialog } from "@/components/PublicProfileDialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "@/hooks/use-toast";
import { fetchBlockedUserIds } from "@/lib/blocks";
import { useSectionCounts } from "@/hooks/useSectionCounts";
import { PageHeader } from "@/components/PageHeader";
import { 
  isSupportCategory, 
  parseSupportCategory, 
  formatSupportTopicLabel,
  formatShortCaseId,
  isArchivedCategory 
} from "@/lib/supportCategory";
import { usePagination } from "@/hooks/usePagination";
import { PaginationControls } from "@/components/PaginationControls";
import { DataFreshnessNotice } from "@/components/DataFreshnessNotice";


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
  category: string | null;
  conversation_type: string | null;
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
  const { effectiveUserId } = useMimic();
  const navigate = useNavigate();
  const sectionCounts = useSectionCounts();
  const [conversations, setConversations] = useState<ConversationWithParticipant[]>([]);
  const [loading, setLoading] = useState(true);
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [selectedProfileUserId, setSelectedProfileUserId] = useState<string | null>(null);
  const [pendingRequests, setPendingRequests] = useState<PendingConnectionRequest[]>([]);
  const [isRep, setIsRep] = useState(false);
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<"all" | "seeking" | "direct" | "support">("all");
  const [openPostsOnly, setOpenPostsOnly] = useState(false);
  const [blockedUserIds, setBlockedUserIds] = useState<string[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Pagination - 20 conversations per page
  const pagination = usePagination({ pageSize: 20 });

  // Helper functions need to be defined before useEffect that uses them
  const loadBlockedUsers = useCallback(async () => {
    const blocked = await fetchBlockedUserIds();
    setBlockedUserIds(blocked);
  }, []);

  const loadUserRole = useCallback(async () => {
    if (!effectiveUserId) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("is_fieldrep")
      .eq("id", effectiveUserId)
      .maybeSingle();

    setIsRep(profile?.is_fieldrep || false);
  }, [effectiveUserId]);

  const loadPendingRequests = useCallback(async () => {
    if (!effectiveUserId) return;

    // Check if user is a rep
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_fieldrep")
      .eq("id", effectiveUserId)
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
      .eq("field_rep_id", effectiveUserId)
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
  }, [effectiveUserId]);

  async function handleAcceptRequest(requestId: string) {
    setProcessingRequestId(requestId);
    try {
      // Get the connection to find vendor_id
      const { data: connData } = await supabase
        .from("vendor_connections")
        .select("vendor_id")
        .eq("id", requestId)
        .single();

      const { error } = await supabase
        .from("vendor_connections")
        .update({ 
          status: "connected",
          responded_at: new Date().toISOString()
        })
        .eq("id", requestId);

      if (error) throw error;

      // Auto-assign vendor onboarding checklists to rep
      if (connData?.vendor_id && user) {
        const { autoAssignVendorChecklists } = await import("@/lib/checklists");
        await autoAssignVendorChecklists(supabase, connData.vendor_id, user.id);
      }

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
    if (!effectiveUserId) return;

    const conv = conversations.find((c) => c.id === conversationId);
    if (!conv) return;

    const isParticipantOne = conv.participant_one === effectiveUserId;
    
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

  const loadConversations = useCallback(async () => {
    if (!effectiveUserId) return;

    setLoading(true);
    try {
      // First, get viewer's profile to determine if they're a vendor
      const { data: viewerProfile } = await supabase
        .from("profiles")
        .select("is_vendor_admin, is_fieldrep")
        .eq("id", effectiveUserId)
        .maybeSingle();

      const viewerIsVendor = viewerProfile?.is_vendor_admin ?? false;

      // Get total count first for pagination
      const { count: totalCount, error: countError } = await supabase
        .from("conversations")
        .select("id", { count: "exact", head: true })
        .or(`participant_one.eq.${effectiveUserId},participant_two.eq.${effectiveUserId}`);

      if (countError) {
        console.error("Error getting conversation count:", countError);
      }

      if (totalCount !== null) {
        pagination.setTotalItems(totalCount);
      }

      // Fetch paginated conversations where user is a participant
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
          category,
          conversation_type,
          seeking_post:origin_post_id (
            id,
            title,
            state_code,
            status
          )
        `)
        .or(`participant_one.eq.${effectiveUserId},participant_two.eq.${effectiveUserId}`)
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .range(pagination.range[0], pagination.range[1]);

      if (error) {
        console.error("Error loading conversations:", error);
        return;
      }

      // Fetch unread counts for all conversations
      const { data: unreadMessages, error: unreadError } = await supabase
        .from("messages")
        .select("conversation_id")
        .eq("recipient_id", effectiveUserId)
        .eq("read", false);

      if (unreadError) {
        console.error("Error loading unread counts:", unreadError);
      }

      // Build unread counts map
      const unreadCounts: Record<string, number> = {};
      (unreadMessages || []).forEach((m) => {
        unreadCounts[m.conversation_id] = (unreadCounts[m.conversation_id] || 0) + 1;
      });

      // Collect all other participant IDs for batch name fetching
      const otherParticipantIds = (data || []).map(conv => 
        conv.participant_one === effectiveUserId ? conv.participant_two : conv.participant_one
      );

      // Batch fetch display names respecting connection status
      const displayNames = await batchGetUserDisplayNames(
        otherParticipantIds,
        effectiveUserId,
        viewerIsVendor
      );

      // Build conversations with names
      const conversationsWithNames: ConversationWithParticipant[] = (data || []).map((conv) => {
        const otherUserId = conv.participant_one === effectiveUserId 
          ? conv.participant_two 
          : conv.participant_one;
        
        // For support conversations, show "ClearMarket Support" instead of participant name
        const isSupport = (conv.category?.startsWith("support:") ?? false) || conv.conversation_type === "support";
        const otherParticipantName = isSupport 
          ? "ClearMarket Support" 
          : (displayNames[otherUserId] || "User");
        
        return {
          ...conv,
          otherParticipantName,
          otherParticipantUserId: otherUserId,
          unreadCount: unreadCounts[conv.id] || 0,
          hasPendingConnection: false, // Will be updated below if applicable
        };
      });

      // Filter out archived conversations (unless they have unread messages), blocked users, and archived categories
      const filteredConversations = conversationsWithNames.filter((conv) => {
        const isParticipantOne = conv.participant_one === effectiveUserId;
        const isArchived = isParticipantOne ? conv.hidden_for_one : conv.hidden_for_two;
        const isBlocked = blockedUserIds.includes(conv.otherParticipantUserId);
        const hasArchivedCategory = isArchivedCategory(conv.category);
        // Show archived conversations if they have unread messages
        const hasUnread = conv.unreadCount > 0;
        return (!isArchived || hasUnread) && !isBlocked && !hasArchivedCategory;
      });

      // Load pending connection states for field reps
      if (filteredConversations.length > 0) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("is_fieldrep")
          .eq("id", effectiveUserId)
          .maybeSingle();

        if (profile?.is_fieldrep) {
          // Get all vendor user IDs from conversations
          const vendorIds = filteredConversations.map(conv => conv.otherParticipantUserId);
          
          // Query vendor_connections for pending connections
          const { data: pendingConnections } = await supabase
            .from("vendor_connections")
            .select("vendor_id")
            .eq("field_rep_id", effectiveUserId)
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
      setLastUpdated(new Date());
    } catch (error) {
      console.error("Unexpected error loading conversations:", error);
    } finally {
      setLoading(false);
    }
  }, [effectiveUserId, blockedUserIds, pagination.range]);

  // Effects - after all function definitions
  useEffect(() => {
    if (authLoading) return;
    
    if (!user) {
      navigate("/signin");
      return;
    }

    if (!effectiveUserId) return;

    loadUserRole();
    loadBlockedUsers();
    loadPendingRequests();
  }, [user, authLoading, navigate, effectiveUserId, loadUserRole, loadBlockedUsers, loadPendingRequests]);

  // Separate effect for loading conversations (depends on pagination)
  useEffect(() => {
    if (!effectiveUserId || authLoading) return;
    loadConversations();
  }, [effectiveUserId, authLoading, loadConversations, pagination.currentPage]);

  if (authLoading || loading) {
    return (
      <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-8">
        <div className="max-w-4xl mx-auto">
          <p className="text-muted-foreground">Loading messages...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Header */}
          <PageHeader
            title="Messages"
            subtitle={sectionCounts.unreadMessages > 0 
              ? `${sectionCounts.unreadMessages} conversation${sectionCounts.unreadMessages !== 1 ? "s" : ""} with unread messages`
              : undefined
            }
            showBackToDashboard
          />
          
          {/* Data Freshness Notice */}
          <DataFreshnessNotice
            mode="manual"
            lastUpdated={lastUpdated}
            onRefresh={loadConversations}
            isRefreshing={loading}
          />
          
          {/* Primary Filter */}
          <div className="flex items-center gap-3 flex-wrap">
          <div className="flex gap-2 flex-wrap">
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
              <Button
                variant={filterMode === "support" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilterMode("support")}
              >
                Support
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
                    <div className="text-xs text-muted-foreground italic">
                      By accepting, you're sharing your business contact details with this vendor.
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

          // 1. Apply primary filter (All / Seeking Coverage / Direct / Support)
          if (filterMode === "seeking") {
            // Only Seeking Coverage conversations (exclude support)
            filteredConversations = filteredConversations.filter((conv) => 
              conv.origin_type === "seeking_coverage" && conv.origin_post_id && 
              !isSupportCategory(conv.category) && conv.conversation_type !== "support"
            );
          } else if (filterMode === "direct") {
            // Only Direct conversations (not tied to Seeking Coverage, and not support)
            filteredConversations = filteredConversations.filter((conv) => 
              (conv.origin_type !== "seeking_coverage" || !conv.origin_post_id) && 
              !isSupportCategory(conv.category) && conv.conversation_type !== "support"
            );
          } else if (filterMode === "support") {
            // Only Support conversations (check both category and conversation_type for safety)
            filteredConversations = filteredConversations.filter((conv) => 
              isSupportCategory(conv.category) || conv.conversation_type === "support"
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
            } else if (filterMode === "support") {
              emptyTitle = "No support conversations";
              emptyMessage = "Conversations with ClearMarket Support will appear here.";
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
              const parsed = parseSupportCategory(conv.category);
              const isSupport = parsed.isSupport || conv.conversation_type === "support";
              
              // Determine main title and subtitle based on conversation type
              let mainTitle: string;
              let topicLabel: string | undefined;
              let previewText: string | undefined;
              let shortCaseId: string | null = null;
              
              if (isSupport) {
                mainTitle = "ClearMarket Support";
                topicLabel = formatSupportTopicLabel(parsed.topic);
                shortCaseId = formatShortCaseId(parsed.caseId);
                // For support threads, prefer post_title_snapshot (case subject), then last_message_preview
                previewText = conv.post_title_snapshot || conv.last_message_preview || undefined;
              } else if (isSeekingCoverage) {
                mainTitle = conv.post_title_snapshot || conv.seeking_post?.title || "Seeking Coverage Conversation";
                topicLabel = `with ${conv.otherParticipantName}`;
                previewText = conv.last_message_preview || undefined;
              } else {
                mainTitle = conv.otherParticipantName;
                topicLabel = undefined;
                previewText = conv.last_message_preview || undefined;
              }

              return (
                <Card
                  key={conv.id}
                  className="p-4 hover:bg-accent/50 transition-colors cursor-pointer"
                  onClick={() => navigate(`/messages/${conv.id}`)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {isSupport && (
                          <Headphones className="h-4 w-4 text-primary shrink-0" />
                        )}
                        <span className="font-semibold text-foreground">
                          {mainTitle}
                        </span>
                        {isSupport && topicLabel && (
                          <Badge variant="outline" className="text-xs text-muted-foreground border-muted-foreground/30">
                            {topicLabel}
                          </Badge>
                        )}
                        {isSupport && shortCaseId && (
                          <span className="text-xs text-muted-foreground">
                            Case #{shortCaseId}
                          </span>
                        )}
                        {!isSupport && (
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
                        )}
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
                      {!isSupport && topicLabel && (
                        <p className="text-xs text-muted-foreground mb-1">{topicLabel}</p>
                      )}
                      {previewText && (
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {previewText}
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

        {/* Pagination Controls */}
        {pagination.totalPages > 1 && (
          <PaginationControls
            currentPage={pagination.currentPage}
            totalPages={pagination.totalPages}
            onPageChange={pagination.setPage}
            hasNextPage={pagination.hasNextPage}
            hasPrevPage={pagination.hasPrevPage}
            showingFrom={(pagination.currentPage - 1) * pagination.pageSize + 1}
            showingTo={Math.min(pagination.currentPage * pagination.pageSize, pagination.totalItems)}
            totalItems={pagination.totalItems}
          />
        )}
        
        <PublicProfileDialog
          open={profileDialogOpen}
          onOpenChange={setProfileDialogOpen}
          targetUserId={selectedProfileUserId}
        />
      </div>
    </>
  );
}
