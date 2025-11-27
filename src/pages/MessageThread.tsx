import { useEffect, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Send, Eye } from "lucide-react";
import { getUserDisplayName } from "@/lib/conversations";
import { toast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { PublicProfileDialog } from "@/components/PublicProfileDialog";

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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);

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
    // Scroll to bottom when messages change
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function loadConversationData() {
    if (!user || !conversationId) return;

    setLoading(true);
    try {
      // Load conversation to verify access and get other participant
      const { data: conversation, error: convError } = await supabase
        .from("conversations")
        .select("participant_one, participant_two")
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

      // Determine other participant
      const otherId = conversation.participant_one === user.id 
        ? conversation.participant_two 
        : conversation.participant_one;
      
      setOtherParticipantId(otherId);
      
      // Get other participant's display name
      const name = await getUserDisplayName(otherId);
      setOtherParticipantName(name);

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

  async function loadMessages() {
    if (!conversationId) return;

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
  }

  async function handleSendMessage() {
    if (!messageText.trim() || !user || !conversationId || !otherParticipantId) return;

    setSending(true);
    try {
      // Insert message
      const { error: insertError } = await supabase
        .from("messages")
        .insert({
          conversation_id: conversationId,
          sender_id: user.id,
          recipient_id: otherParticipantId,
          body: messageText.trim(),
        });

      if (insertError) {
        console.error("Error sending message:", insertError);
        toast({
          title: "Error",
          description: "Failed to send message",
          variant: "destructive",
        });
        return;
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
          <Button
            variant="outline"
            onClick={() => navigate("/messages")}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Messages
          </Button>
          <div>
            <h1 className="text-lg text-muted-foreground mb-1">
              Conversation with
            </h1>
            <button
              onClick={() => setProfileDialogOpen(true)}
              className="text-2xl font-bold text-foreground hover:text-primary transition-colors inline-flex items-center gap-2"
            >
              {otherParticipantName}
              <Eye className="h-5 w-5" />
            </button>
          </div>
        </div>

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
                return (
                  <div
                    key={message.id}
                    className={`flex ${isCurrentUser ? "justify-end" : "justify-start"}`}
                  >
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
                        {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
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
          <p className="text-xs text-muted-foreground mt-2">
            Press Enter to send, Shift+Enter for new line
          </p>
        </Card>

        <PublicProfileDialog
          open={profileDialogOpen}
          onOpenChange={setProfileDialogOpen}
          targetUserId={otherParticipantId}
        />
      </div>
    </div>
  );
}
