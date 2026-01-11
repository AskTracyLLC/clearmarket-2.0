import { useState, useEffect, useCallback } from "react";
import { format, addHours } from "date-fns";
import { Json } from "@/integrations/supabase/types";
import {
  CheckCircle2,
  Clock,
  User,
  Pencil,
  Send,
  Users,
  Mail,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Check,
  X,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { QueueItem, QueueStatus } from "@/hooks/useQueueItems";
import { cn } from "@/lib/utils";

interface VendorVerificationDetailPanelProps {
  item: QueueItem;
  onStatusChange: (itemId: string, status: QueueStatus) => Promise<boolean>;
  onAssign: (itemId: string, userId: string | null) => Promise<boolean>;
  onRefresh: () => void;
}

interface InternalNote {
  id: string;
  body: string;
  created_at: string;
  created_by: string;
  author?: { full_name: string | null };
}

interface ActionLog {
  id: string;
  action_type: string;
  channel: string;
  direction: string | null;
  body: string | null;
  created_at: string;
  created_by: string | null;
  author?: { full_name: string | null };
}

interface Message {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
  sender?: { full_name: string | null };
}

const STATUS_LABELS: Record<string, string> = {
  open: "Open",
  in_progress: "Under Review",
  waiting: "Waiting",
  resolved: "Approved",
};

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  open: "destructive",
  in_progress: "default",
  waiting: "secondary",
  resolved: "outline",
};

export function VendorVerificationDetailPanel({
  item,
  onStatusChange,
  onAssign,
  onRefresh,
}: VendorVerificationDetailPanelProps) {
  const { user } = useAuth();
  const { toast } = useToast();

  // State
  const [messages, setMessages] = useState<Message[]>([]);
  const [actions, setActions] = useState<ActionLog[]>([]);
  const [internalNotes, setInternalNotes] = useState<InternalNote[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingActions, setLoadingActions] = useState(false);
  const [loadingNotes, setLoadingNotes] = useState(false);

  const [messageText, setMessageText] = useState("");
  const [vendorResponseRequired, setVendorResponseRequired] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);

  const [internalNoteText, setInternalNoteText] = useState("");
  const [sendingNote, setSendingNote] = useState(false);

  const [editingCode, setEditingCode] = useState(false);
  const [requestedCodeFinal, setRequestedCodeFinal] = useState("");
  const [savingCode, setSavingCode] = useState(false);

  const [sendingNudge, setSendingNudge] = useState(false);
  const [timelineOpen, setTimelineOpen] = useState(true);

  // Extract metadata
  const metadata = (item.metadata || {}) as Record<string, unknown>;
  const vendorUserId = metadata.vendor_user_id as string | undefined || metadata.user_id as string | undefined;
  const pocName = metadata.poc_name as string | undefined;
  const pocEmail = metadata.poc_email as string | undefined;
  const requestedCodeSuggested = metadata.requested_code_suggested as string | undefined || metadata.requested_code as string | undefined;
  const requestedCodeFinalMeta = metadata.requested_code_final as string | undefined;
  const submittedAt = metadata.verification_submitted_at as string | undefined || metadata.submitted_at as string | undefined;
  const awaitingVendorReply = metadata.awaiting_vendor_reply as boolean | undefined;
  const externalNudgeSentAt = metadata.external_nudge_sent_at as string | undefined;
  const externalNudgeCount = (metadata.external_nudge_count as number | undefined) || 0;

  // Calculate if nudge is disabled (within 24 hours)
  const nudgeDisabled = externalNudgeSentAt
    ? new Date().getTime() - new Date(externalNudgeSentAt).getTime() < 24 * 60 * 60 * 1000
    : false;

  // Current code to display
  const displayCode = requestedCodeFinalMeta || requestedCodeSuggested || "Not specified";

  // Auto-assign on first open
  useEffect(() => {
    if (item.assigned_to === null && user) {
      onAssign(item.id, user.id);
    }
  }, [item.id, item.assigned_to, user, onAssign]);

  // Load data
  const loadMessages = useCallback(async () => {
    if (!item.conversation_id) return;
    setLoadingMessages(true);
    try {
      const { data, error } = await supabase
        .from("messages")
        .select("id, sender_id, body, created_at, sender:profiles!messages_sender_id_fkey(full_name)")
        .eq("conversation_id", item.conversation_id)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setMessages((data || []) as Message[]);
    } catch (err) {
      console.error("Error loading messages:", err);
    } finally {
      setLoadingMessages(false);
    }
  }, [item.conversation_id]);

  const loadActions = useCallback(async () => {
    setLoadingActions(true);
    try {
      const { data, error } = await supabase
        .from("support_queue_actions")
        .select("id, action_type, channel, direction, body, created_at, created_by, author:profiles!support_queue_actions_created_by_fkey(full_name)")
        .eq("queue_item_id", item.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setActions((data || []) as ActionLog[]);
    } catch (err) {
      console.error("Error loading actions:", err);
    } finally {
      setLoadingActions(false);
    }
  }, [item.id]);

  const loadInternalNotes = useCallback(async () => {
    setLoadingNotes(true);
    try {
      const { data, error } = await supabase
        .from("support_queue_internal_notes")
        .select("id, body, created_at, created_by, author:profiles!support_queue_internal_notes_created_by_fkey(full_name)")
        .eq("queue_item_id", item.id)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setInternalNotes((data || []) as InternalNote[]);
    } catch (err) {
      console.error("Error loading internal notes:", err);
    } finally {
      setLoadingNotes(false);
    }
  }, [item.id]);

  useEffect(() => {
    loadMessages();
    loadActions();
    loadInternalNotes();
    setRequestedCodeFinal(requestedCodeFinalMeta || requestedCodeSuggested || "");
  }, [item.id, loadMessages, loadActions, loadInternalNotes, requestedCodeFinalMeta, requestedCodeSuggested]);

  // Handle send message
  const handleSendMessage = async () => {
    if (!messageText.trim() || !user || !item.conversation_id) return;
    
    setSendingMessage(true);
    try {
      // Get conversation to find recipient
      const { data: conv } = await supabase
        .from("conversations")
        .select("participant_one, participant_two")
        .eq("id", item.conversation_id)
        .single();

      if (!conv) throw new Error("Conversation not found");

      const recipientId = conv.participant_one === user.id ? conv.participant_two : conv.participant_one;

      // Insert message
      const { error: msgError } = await supabase.from("messages").insert({
        conversation_id: item.conversation_id,
        sender_id: user.id,
        recipient_id: recipientId,
        body: messageText.trim(),
      });

      if (msgError) throw msgError;

      // Update conversation last message
      await supabase
        .from("conversations")
        .update({
          last_message_at: new Date().toISOString(),
          last_message_preview: messageText.trim().slice(0, 100),
        })
        .eq("id", item.conversation_id);

      // Update queue item status/metadata based on checkbox
      if (vendorResponseRequired) {
        const newMetadata = {
          ...metadata,
          awaiting_vendor_reply: true,
          awaiting_since: new Date().toISOString(),
        };
        
        await supabase
          .from("support_queue_items")
          .update({
            status: "waiting",
            metadata: newMetadata as Json,
            updated_at: new Date().toISOString(),
          })
          .eq("id", item.id);
      } else {
        // Just ensure we're in Under Review if not already resolved
        if (item.status !== "resolved") {
          await supabase
            .from("support_queue_items")
            .update({
              status: "in_progress",
              updated_at: new Date().toISOString(),
            })
            .eq("id", item.id);
        }
      }

      setMessageText("");
      setVendorResponseRequired(false);
      loadMessages();
      onRefresh();
      toast({ title: "Message sent" });
    } catch (err) {
      console.error("Error sending message:", err);
      toast({ title: "Failed to send message", variant: "destructive" });
    } finally {
      setSendingMessage(false);
    }
  };

  // Handle internal note
  const handleSendInternalNote = async () => {
    if (!internalNoteText.trim() || !user) return;

    setSendingNote(true);
    try {
      const { error } = await supabase.from("support_queue_internal_notes").insert({
        queue_item_id: item.id,
        body: internalNoteText.trim(),
        created_by: user.id,
      });

      if (error) throw error;

      setInternalNoteText("");
      loadInternalNotes();
      toast({ title: "Internal note added" });
    } catch (err) {
      console.error("Error adding internal note:", err);
      toast({ title: "Failed to add note", variant: "destructive" });
    } finally {
      setSendingNote(false);
    }
  };

  // Handle code edit
  const handleSaveCode = async () => {
    if (!requestedCodeFinal.trim()) return;

    setSavingCode(true);
    try {
      const newMetadata = {
        ...metadata,
        requested_code_suggested: requestedCodeSuggested,
        requested_code_final: requestedCodeFinal.trim().toUpperCase(),
      };

      const { error } = await supabase
        .from("support_queue_items")
        .update({
          metadata: newMetadata,
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.id);

      if (error) throw error;

      // Log action
      await supabase.from("support_queue_actions").insert({
        queue_item_id: item.id,
        action_type: "code_revised",
        channel: "in_app",
        body: `Code revised from "${requestedCodeSuggested || 'none'}" to "${requestedCodeFinal.trim().toUpperCase()}"`,
        created_by: user?.id,
      });

      setEditingCode(false);
      loadActions();
      onRefresh();
      toast({ title: "Requested code updated" });
    } catch (err) {
      console.error("Error saving code:", err);
      toast({ title: "Failed to save code", variant: "destructive" });
    } finally {
      setSavingCode(false);
    }
  };

  // Handle email nudge
  const handleSendNudge = async () => {
    if (!pocEmail || nudgeDisabled) return;

    setSendingNudge(true);
    try {
      // Call edge function to send email
      const { error: fnError } = await supabase.functions.invoke("send-vendor-verification-nudge", {
        body: {
          queueItemId: item.id,
          recipientEmail: pocEmail,
          recipientName: pocName,
        },
      });

      if (fnError) throw fnError;

      // Update metadata
      const newMetadata = {
        ...metadata,
        external_nudge_sent_at: new Date().toISOString(),
        external_nudge_count: externalNudgeCount + 1,
        external_nudge_last_channel: "email",
        external_nudge_recipient_email: pocEmail,
        external_nudge_last_admin_id: user?.id,
      };

      await supabase
        .from("support_queue_items")
        .update({ metadata: newMetadata, updated_at: new Date().toISOString() })
        .eq("id", item.id);

      // Log action
      await supabase.from("support_queue_actions").insert({
        queue_item_id: item.id,
        action_type: "email_nudge_sent",
        channel: "email",
        direction: "outbound",
        body: `Waiting on Reply email sent to ${pocEmail}`,
        created_by: user?.id,
      });

      loadActions();
      onRefresh();
      toast({ title: "Email nudge sent" });
    } catch (err) {
      console.error("Error sending nudge:", err);
      toast({ title: "Failed to send email nudge", variant: "destructive" });
    } finally {
      setSendingNudge(false);
    }
  };

  // Handle Request 2nd Opinion
  const handleRequest2ndOpinion = async () => {
    if (!user) return;

    try {
      await supabase
        .from("support_queue_items")
        .update({
          second_look_requested_by: user.id,
          second_look_requested_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.id);

      // Log action
      await supabase.from("support_queue_actions").insert({
        queue_item_id: item.id,
        action_type: "second_look_requested",
        channel: "in_app",
        body: "2nd opinion requested",
        created_by: user.id,
      });

      loadActions();
      onRefresh();
      toast({ title: "2nd opinion requested" });
    } catch (err) {
      console.error("Error requesting 2nd opinion:", err);
      toast({ title: "Failed to request 2nd opinion", variant: "destructive" });
    }
  };

  // Handle approval
  const handleApprove = async () => {
    if (!user) return;

    try {
      // Get the final code to use
      const codeToUse = requestedCodeFinalMeta || requestedCodeSuggested;

      // Update vendor_profile to verified
      if (vendorUserId) {
        const updateData: Record<string, unknown> = {
          vendor_verification_status: "verified",
          verified_at: new Date().toISOString(),
        };
        
        if (codeToUse) {
          updateData.vendor_public_code = codeToUse;
        }

        await supabase
          .from("vendor_profile")
          .update(updateData)
          .eq("user_id", vendorUserId);
      }

      // Update queue item to resolved
      await onStatusChange(item.id, "resolved");

      // Log action
      await supabase.from("support_queue_actions").insert({
        queue_item_id: item.id,
        action_type: "approved",
        channel: "in_app",
        body: `Vendor verification approved${codeToUse ? ` with code: ${codeToUse}` : ""}`,
        created_by: user.id,
      });

      loadActions();
      toast({ title: "Vendor verification approved" });
    } catch (err) {
      console.error("Error approving:", err);
      toast({ title: "Failed to approve", variant: "destructive" });
    }
  };

  // Format timestamp for CST display (approximate CST: UTC-6)
  const formatCST = (dateStr: string) => {
    try {
      const utcDate = new Date(dateStr);
      // CST is UTC-6 hours
      const cstDate = addHours(utcDate, -6 + utcDate.getTimezoneOffset() / 60);
      return format(cstDate, "MM/dd/yy - h:mm a") + " CST";
    } catch {
      return format(new Date(dateStr), "MM/dd/yy - h:mm a");
    }
  };

  // Determine if we need to show Link Thread button
  const needsThreadLink = !item.conversation_id;

  const handleLinkThread = async () => {
    try {
      const { data, error } = await supabase.rpc("link_vendor_verification_conversation", {
        p_queue_item_id: item.id,
      });

      if (error) throw error;

      const result = data as { success?: boolean; error?: string } | null;
      if (result?.success) {
        onRefresh();
        toast({ title: "Thread linked successfully" });
      } else {
        toast({ title: result?.error || "Failed to link thread", variant: "destructive" });
      }
    } catch (err) {
      console.error("Error linking thread:", err);
      toast({ title: "Failed to link thread", variant: "destructive" });
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b flex-shrink-0">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              <Badge variant="outline" className="text-xs">Vendor Verification</Badge>
            </div>
            <h2 className="font-semibold text-lg">{item.title}</h2>
          </div>
          <Badge variant={STATUS_VARIANTS[item.status] || "secondary"}>
            {STATUS_LABELS[item.status] || item.status}
          </Badge>
        </div>

        {/* Status Controls */}
        <div className="flex flex-wrap gap-2 mb-3">
          {(["open", "in_progress", "waiting"] as const).map((status) => (
            <Button
              key={status}
              variant={item.status === status ? "default" : "outline"}
              size="sm"
              onClick={() => onStatusChange(item.id, status)}
              disabled={item.status === status || item.status === "resolved"}
            >
              {STATUS_LABELS[status]}
            </Button>
          ))}
          <Button
            variant={item.status === "resolved" ? "default" : "outline"}
            size="sm"
            onClick={handleApprove}
            disabled={item.status === "resolved"}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <Check className="h-3 w-3 mr-1" />
            Approve
          </Button>
        </div>

        {/* Assignment */}
        <div className="flex items-center gap-2 text-sm">
          <User className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">Assigned:</span>
          {item.assignee ? (
            <span>{item.assignee.full_name || "Staff"}</span>
          ) : (
            <span className="text-muted-foreground italic">Unassigned</span>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 ml-2"
            onClick={handleRequest2ndOpinion}
          >
            <Users className="h-3 w-3 mr-1" />
            Request 2nd Opinion
          </Button>
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* Timeline/Activity Section */}
          <Collapsible open={timelineOpen} onOpenChange={setTimelineOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between p-0 h-auto mb-2">
                <h3 className="text-xs font-medium text-muted-foreground uppercase">Timeline / Activity</h3>
                {timelineOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="space-y-2 text-sm max-h-40 overflow-y-auto">
                {loadingActions ? (
                  <p className="text-muted-foreground text-xs">Loading...</p>
                ) : actions.length === 0 ? (
                  <p className="text-muted-foreground text-xs">No activity yet</p>
                ) : (
                  actions.slice(0, 10).map((action) => (
                    <div key={action.id} className="flex items-start gap-2 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3 mt-0.5 shrink-0" />
                      <div>
                        <span className="font-medium text-foreground">{action.action_type.replace(/_/g, " ")}</span>
                        {action.body && <span className="ml-1">— {action.body.slice(0, 80)}</span>}
                        <span className="ml-2">{formatCST(action.created_at)}</span>
                      </div>
                    </div>
                  ))
                )}
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  Created: {formatCST(item.created_at)}
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          <Separator />

          {/* Details Panel */}
          <div>
            <h3 className="text-xs font-medium text-muted-foreground uppercase mb-2">Vendor Details</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">POC Name:</span>
                <span className="ml-2">{pocName || "—"}</span>
              </div>
              <div>
                <span className="text-muted-foreground">POC Email:</span>
                <span className="ml-2">{pocEmail || "—"}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Submitted:</span>
                <span className="ml-2">{submittedAt ? formatCST(submittedAt) : "—"}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">Requested Code:</span>
                {editingCode ? (
                  <div className="flex items-center gap-1 ml-2">
                    <Input
                      value={requestedCodeFinal}
                      onChange={(e) => setRequestedCodeFinal(e.target.value.toUpperCase())}
                      className="h-6 w-24 text-xs"
                      maxLength={10}
                    />
                    <Button size="sm" className="h-6 px-2" onClick={handleSaveCode} disabled={savingCode}>
                      {savingCode ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                    </Button>
                    <Button size="sm" variant="ghost" className="h-6 px-2" onClick={() => setEditingCode(false)}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <span className="ml-2 font-mono">{displayCode}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 w-5 p-0 ml-1"
                      onClick={() => {
                        setRequestedCodeFinal(requestedCodeFinalMeta || requestedCodeSuggested || "");
                        setEditingCode(true);
                      }}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>

          <Separator />

          {/* Tabs for Thread and 2nd Look */}
          <Tabs defaultValue="thread" className="w-full">
            <TabsList className="w-full grid grid-cols-2">
              <TabsTrigger value="thread" className="text-xs">
                <MessageSquare className="h-3 w-3 mr-1" />
                Message Thread
              </TabsTrigger>
              <TabsTrigger value="internal" className="text-xs">
                <Users className="h-3 w-3 mr-1" />
                2nd Look
              </TabsTrigger>
            </TabsList>

            <TabsContent value="thread" className="mt-3">
              {needsThreadLink ? (
                <div className="text-center py-4">
                  <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground mb-3">No conversation thread linked</p>
                  <Button size="sm" onClick={handleLinkThread}>
                    Link Thread
                  </Button>
                </div>
              ) : (
                <>
                  {/* Messages */}
                  <div className="space-y-3 max-h-60 overflow-y-auto mb-3">
                    {loadingMessages ? (
                      <p className="text-xs text-muted-foreground">Loading messages...</p>
                    ) : messages.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No messages yet</p>
                    ) : (
                      messages.map((msg) => {
                        const isStaff = msg.sender_id === user?.id;
                        return (
                          <div
                            key={msg.id}
                            className={cn(
                              "p-2 rounded-lg text-sm",
                              isStaff ? "bg-primary/10 ml-4" : "bg-muted mr-4"
                            )}
                          >
                            <div className="flex items-center gap-2 mb-1 text-xs text-muted-foreground">
                              <span className="font-medium">
                                {isStaff ? "You" : (msg.sender as { full_name: string | null })?.full_name || "Vendor"}
                              </span>
                              <span>{format(new Date(msg.created_at), "MMM d, h:mm a")}</span>
                            </div>
                            <p className="whitespace-pre-wrap">{msg.body}</p>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Compose */}
                  <div className="space-y-2">
                    <Textarea
                      placeholder="Type a message..."
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      rows={2}
                      className="text-sm"
                    />
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 text-xs">
                        <Checkbox
                          checked={vendorResponseRequired}
                          onCheckedChange={(checked) => setVendorResponseRequired(!!checked)}
                        />
                        Vendor response required
                      </label>
                      <Button size="sm" onClick={handleSendMessage} disabled={sendingMessage || !messageText.trim()}>
                        {sendingMessage ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Send className="h-3 w-3 mr-1" />}
                        Send
                      </Button>
                    </div>
                  </div>

                  {/* Email Nudge - only show in Waiting status */}
                  {item.status === "waiting" && pocEmail && (
                    <div className="mt-3 pt-3 border-t">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleSendNudge}
                        disabled={nudgeDisabled || sendingNudge}
                        className="w-full"
                      >
                        {sendingNudge ? (
                          <Loader2 className="h-3 w-3 animate-spin mr-1" />
                        ) : (
                          <Mail className="h-3 w-3 mr-1" />
                        )}
                        Send Waiting on Reply (email)
                      </Button>
                      {externalNudgeSentAt && (
                        <p className="text-xs text-muted-foreground mt-1 text-center">
                          Sent: {formatCST(externalNudgeSentAt)}
                        </p>
                      )}
                    </div>
                  )}
                </>
              )}
            </TabsContent>

            <TabsContent value="internal" className="mt-3">
              {/* Internal Notes */}
              <div className="space-y-2 max-h-40 overflow-y-auto mb-3">
                {loadingNotes ? (
                  <p className="text-xs text-muted-foreground">Loading...</p>
                ) : internalNotes.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No internal notes yet</p>
                ) : (
                  internalNotes.map((note) => (
                    <div key={note.id} className="p-2 bg-amber-900/20 rounded text-sm border border-amber-800/30">
                      <div className="flex items-center gap-2 mb-1 text-xs text-muted-foreground">
                        <span className="font-medium">{(note.author as { full_name: string | null })?.full_name || "Admin"}</span>
                        <span>{format(new Date(note.created_at), "MMM d, h:mm a")}</span>
                      </div>
                      <p className="whitespace-pre-wrap">{note.body}</p>
                    </div>
                  ))
                )}
              </div>

              {/* Add note */}
              <div className="space-y-2">
                <Textarea
                  placeholder="Add internal note (admin-only)..."
                  value={internalNoteText}
                  onChange={(e) => setInternalNoteText(e.target.value)}
                  rows={2}
                  className="text-sm"
                />
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleSendInternalNote}
                  disabled={sendingNote || !internalNoteText.trim()}
                  className="w-full"
                >
                  {sendingNote ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                  Add Internal Note
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </ScrollArea>
    </div>
  );
}
