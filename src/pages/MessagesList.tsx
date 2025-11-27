import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, MessageSquare, Eye } from "lucide-react";
import { getUserDisplayName } from "@/lib/conversations";
import { formatDistanceToNow } from "date-fns";
import { PublicProfileDialog } from "@/components/PublicProfileDialog";

interface ConversationWithParticipant {
  id: string;
  last_message_at: string | null;
  last_message_preview: string | null;
  participant_one: string;
  participant_two: string;
  otherParticipantName: string;
  otherParticipantUserId: string;
}

export default function MessagesList() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<ConversationWithParticipant[]>([]);
  const [loading, setLoading] = useState(true);
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [selectedProfileUserId, setSelectedProfileUserId] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    
    if (!user) {
      navigate("/signin");
      return;
    }

    loadConversations();
  }, [user, authLoading, navigate]);

  async function loadConversations() {
    if (!user) return;

    setLoading(true);
    try {
      // Fetch all conversations where user is a participant
      const { data, error } = await supabase
        .from("conversations")
        .select("id, participant_one, participant_two, last_message_at, last_message_preview")
        .or(`participant_one.eq.${user.id},participant_two.eq.${user.id}`)
        .order("last_message_at", { ascending: false, nullsFirst: false });

      if (error) {
        console.error("Error loading conversations:", error);
        return;
      }

      // Get display names for other participants
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
            {conversations.map((conv) => (
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
                        {conv.otherParticipantName}
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                    </div>
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
            ))}
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
