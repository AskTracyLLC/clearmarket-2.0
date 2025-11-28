import { useEffect, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Send, Eye } from "lucide-react";
import { getUserDisplayName } from "@/lib/conversations";
import { toast } from "@/hooks/use-toast";
import { formatDistanceToNow, format } from "date-fns";
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
  const [conversationData, setConversationData] = useState<any>(null);
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
      // Load conversation with Seeking Coverage origin data
      const { data: conversation, error: convError } = await supabase
        .from("conversations")
        .select(`
          participant_one,
          participant_two,
          origin_type,
          origin_post_id,
          seeking_post:origin_post_id (
            id,
            title,
            state_code,
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
            {(() => {
              const isSeekingCoverage = conversationData?.origin_type === "seeking_coverage" && conversationData?.seeking_post;
              const headerTitle = isSeekingCoverage
                ? (conversationData.seeking_post.title || "Seeking Coverage Conversation")
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
                </>
              );
            })()}
          </div>
        </div>

        {/* Pinned Seeking Coverage Header */}
        {conversationData?.origin_type === "seeking_coverage" && conversationData?.seeking_post && (
          <Card className="bg-card border-primary/30">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between text-base">
                <span>Connected via Seeking Coverage</span>
                <Badge variant="outline" className="text-xs">Post Context</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm pb-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Post Title</p>
                  <p className="font-semibold">{conversationData.seeking_post.title}</p>
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
                This conversation was started from this Seeking Coverage request so both sides know what this thread is about.
              </p>
            </CardContent>
          </Card>
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
