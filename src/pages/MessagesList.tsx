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

interface ConversationWithParticipant {
  id: string;
  last_message_at: string | null;
  last_message_preview: string | null;
  participant_one: string;
  participant_two: string;
  origin_type: string | null;
  origin_post_id: string | null;
  seeking_post?: {
    id: string;
    title: string;
    state_code: string | null;
  } | null;
  otherParticipantName: string;
  otherParticipantUserId: string;
  unreadCount: number;
}

interface PendingConnectionRequest {
  id: string;
  post_id: string;
  rep_id: string;
  vendor_id: string;
  vendor_anonymous_id: string;
  vendor_company_name: string;
  post_title: string;
  post_state_code: string | null;
}

export default function MessagesList() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<ConversationWithParticipant[]>([]);
  const [loading, setLoading] = useState(true);
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [selectedProfileUserId, setSelectedProfileUserId] = useState<string | null>(null);
  const [pendingRequests, setPendingRequests] = useState<PendingConnectionRequest[]>([]);
  const [isRep, setIsRep] = useState(false);
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    
    if (!user) {
      navigate("/signin");
      return;
    }

    loadUserRole();
    loadConversations();
    loadPendingRequests();
  }, [user, authLoading, navigate]);

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

    // Get rep profile ID
    const { data: repProfile } = await supabase
      .from("rep_profile")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!repProfile) return;

    // Fetch pending connection requests
    const { data: interests, error } = await supabase
      .from("rep_interest")
      .select(`
        id,
        post_id,
        rep_id,
        seeking_coverage_posts!inner (
          id,
          title,
          state_code,
          vendor_id,
          profiles!seeking_coverage_posts_vendor_id_fkey (
            id
          ),
          vendor_profile!vendor_profile_user_id_fkey (
            anonymous_id,
            company_name
          )
        )
      `)
      .eq("rep_id", repProfile.id)
      .eq("status", "pending_rep_confirm");

    if (error) {
      console.error("Error loading pending requests:", error);
      return;
    }

    const requests: PendingConnectionRequest[] = (interests || []).map((interest: any) => ({
      id: interest.id,
      post_id: interest.post_id,
      rep_id: interest.rep_id,
      vendor_id: interest.seeking_coverage_posts.profiles.id,
      vendor_anonymous_id: interest.seeking_coverage_posts.vendor_profile.anonymous_id,
      vendor_company_name: interest.seeking_coverage_posts.vendor_profile.company_name,
      post_title: interest.seeking_coverage_posts.title,
      post_state_code: interest.seeking_coverage_posts.state_code,
    }));

    setPendingRequests(requests);
  }

  async function handleAcceptRequest(requestId: string) {
    setProcessingRequestId(requestId);
    try {
      const { error } = await supabase
        .from("rep_interest")
        .update({ status: "connected" })
        .eq("id", requestId);

      if (error) throw error;

      toast({
        title: "Connection accepted",
        description: "This vendor is now in your My Vendors list.",
      });

      // Remove from pending requests
      setPendingRequests(prev => prev.filter(r => r.id !== requestId));
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
        .from("rep_interest")
        .update({ status: "declined" })
        .eq("id", requestId);

      if (error) throw error;

      toast({
        title: "Connection declined",
        description: "This connection request has been declined.",
      });

      // Remove from pending requests
      setPendingRequests(prev => prev.filter(r => r.id !== requestId));
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
          seeking_post:origin_post_id (
            id,
            title,
            state_code
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
      const conversationsWithNames = await Promise.all(
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
          };
        })
      );

      setConversations(conversationsWithNames);
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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              onClick={() => navigate("/dashboard")}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
            <h1 className="text-3xl font-bold text-foreground">Messages</h1>
          </div>
        </div>

        {/* Pending Connection Requests */}
        {isRep && pendingRequests.length > 0 && (
          <div className="space-y-3">
            {pendingRequests.map((request) => (
              <Alert key={request.id} className="border-amber-500/40 bg-amber-500/10">
                <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-sm">
                    <span className="font-semibold">{request.vendor_anonymous_id}</span> has requested to add you to their network
                    for <span className="font-medium">{request.post_title}</span>.
                    {" "}If you work well together, you can accept this connection so they appear in your "My Vendors" list.
                  </span>
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
        {conversations.length === 0 ? (
          <Card className="p-12 text-center">
            <MessageSquare className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h2 className="text-xl font-semibold text-foreground mb-2">
              No conversations yet
            </h2>
            <p className="text-muted-foreground">
              Your messages will appear here once you start a conversation.
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {conversations.map((conv) => {
              const isSeekingCoverage = conv.origin_type === "seeking_coverage" && conv.seeking_post;
              const mainTitle = isSeekingCoverage
                ? (conv.seeking_post.title || "Seeking Coverage Conversation")
                : conv.otherParticipantName;
              const subtitle = isSeekingCoverage ? `with ${conv.otherParticipantName}` : undefined;

              return (
                <Card
                  key={conv.id}
                  className="p-4 hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedProfileUserId(conv.otherParticipantUserId);
                            setProfileDialogOpen(true);
                          }}
                          className="font-semibold text-foreground hover:text-primary transition-colors inline-flex items-center gap-1"
                        >
                          {mainTitle}
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                        {conv.unreadCount > 0 && (
                          <Badge variant="secondary" className="ml-2 bg-orange-500/20 text-orange-500 hover:bg-orange-500/30">
                            {conv.unreadCount}
                          </Badge>
                        )}
                      </div>
                      {subtitle && (
                        <p className="text-xs text-muted-foreground mb-1">{subtitle}</p>
                      )}
                      {conv.last_message_preview && (
                        <p 
                          className="text-sm text-muted-foreground line-clamp-2 cursor-pointer"
                          onClick={() => navigate(`/messages/${conv.id}`)}
                        >
                          {conv.last_message_preview}
                        </p>
                      )}
                    </div>
                    {conv.last_message_at && (
                      <span className="text-xs text-muted-foreground whitespace-nowrap ml-4">
                        {formatDistanceToNow(new Date(conv.last_message_at), { addSuffix: true })}
                      </span>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
        
        <PublicProfileDialog
          open={profileDialogOpen}
          onOpenChange={setProfileDialogOpen}
          targetUserId={selectedProfileUserId}
        />
      </div>
    </div>
  );
}
