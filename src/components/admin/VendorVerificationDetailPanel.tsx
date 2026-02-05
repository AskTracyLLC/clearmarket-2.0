import { useState, useEffect, useCallback } from "react";
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
  AlertCircle,
  Check,
  X,
  Loader2,
  Plus,
  ChevronDown,
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { QueueItem, QueueStatus } from "@/hooks/useQueueItems";
import { cn } from "@/lib/utils";
import { formatCT } from "@/lib/formatTimezone";
import { parseSupportCategory, formatShortCaseId } from "@/lib/supportCategory";

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

interface StaffMember {
  id: string;
  full_name: string | null;
}

const STATUS_OPTIONS: { value: QueueStatus; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "Under Review" },
  { value: "waiting", label: "Waiting" },
  { value: "resolved", label: "Approved" },
  { value: "declined", label: "Declined" },
];

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  open: "destructive",
  in_progress: "default",
  waiting: "secondary",
  resolved: "outline",
  declined: "secondary",
};

const getStatusLabel = (status: string) => {
  return STATUS_OPTIONS.find(s => s.value === status)?.label || status;
};

// Get short admin ID (first 4 chars uppercase)
const getShortAdminId = (userId: string | null | undefined): string => {
  if (!userId) return "SYS";
  return userId.slice(0, 4).toUpperCase();
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
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
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
  
  // Second Look modal state
  const [showSecondLookDialog, setShowSecondLookDialog] = useState(false);
  const [secondLookMessage, setSecondLookMessage] = useState("");
  const [requestingSecondLook, setRequestingSecondLook] = useState(false);

  // Decline confirmation modal state
  const [showDeclineDialog, setShowDeclineDialog] = useState(false);
  const [declining, setDeclining] = useState(false);

  // Extract metadata
  const metadata = (item.metadata || {}) as Record<string, unknown>;
  const vendorUserId = metadata.vendor_user_id as string | undefined || metadata.user_id as string | undefined;
  const pocName = metadata.poc_name as string | undefined;
  const pocEmail = metadata.poc_email as string | undefined;
  const requestedCodeSuggested = metadata.requested_code_suggested as string | undefined || metadata.requested_code as string | undefined;
  const requestedCodeFinalMeta = metadata.requested_code_final as string | undefined;
  const submittedAt = metadata.verification_submitted_at as string | undefined || metadata.submitted_at as string | undefined;
  const awaitingVendorReply = metadata.awaiting_vendor_reply as boolean | undefined;
  const awaitingSince = metadata.awaiting_since as string | undefined;
  const lastVendorMessageAt = metadata.last_vendor_message_at as string | undefined;
  const lastAdminMessageAt = metadata.last_admin_message_at as string | undefined;
  const externalNudgeSentAt = metadata.external_nudge_sent_at as string | undefined;
  const externalNudgeCount = (metadata.external_nudge_count as number | undefined) || 0;
  const lastWaitingEmailSentTo = metadata.external_nudge_recipient_email as string | undefined;

  // Calculate if nudge is disabled (within 10 minutes)
  const nudgeDisabled = externalNudgeSentAt
    ? new Date().getTime() - new Date(externalNudgeSentAt).getTime() < 10 * 60 * 1000
    : false;

  // Current code to display
  const displayCode = requestedCodeFinalMeta || requestedCodeSuggested || "Not specified";

  // Extract Case # from metadata or conversation_id
  let caseId: string | null = null;
  if (typeof metadata.case_id === "string") {
    caseId = metadata.case_id;
  } else if (typeof metadata.support_category === "string") {
    const parsed = parseSupportCategory(metadata.support_category as string);
    if (parsed.caseId) caseId = parsed.caseId;
  } else if (item.conversation_id) {
    caseId = item.conversation_id;
  }
  // Vendor verification requests always come from vendors
  const shortCaseId = formatShortCaseId(caseId, "vendor");

  // Use formatCT from lib for proper timezone handling
  const formatTimestamp = useCallback((dateStr: string) => {
    return formatCT(dateStr);
  }, []);

  // Auto-assign on first open
  useEffect(() => {
    if (item.assigned_to === null && user) {
      onAssign(item.id, user.id);
      // Also set status to Under Review if currently Open
      if (item.status === "open") {
        onStatusChange(item.id, "in_progress");
      }
    }
  }, [item.id, item.assigned_to, item.status, user, onAssign, onStatusChange]);

  // Load staff members for assignment dropdown
  const loadStaffMembers = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name")
        .or("is_admin.eq.true,is_super_admin.eq.true,is_support.eq.true,is_moderator.eq.true");

      if (!error && data) {
        setStaffMembers(data as StaffMember[]);
      }
    } catch (err) {
      console.error("Error loading staff members:", err);
    }
  }, []);

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
    loadStaffMembers();
    setRequestedCodeFinal(requestedCodeFinalMeta || requestedCodeSuggested || "");
  }, [item.id, loadMessages, loadActions, loadInternalNotes, loadStaffMembers, requestedCodeFinalMeta, requestedCodeSuggested]);

  // Handle send message via RPC
  const handleSendMessage = async () => {
    if (!messageText.trim() || !user) return;
    
    // Check if conversation exists
    if (!item.conversation_id) {
      toast({ title: "No thread linked. Please link a thread first.", variant: "destructive" });
      return;
    }
    
    setSendingMessage(true);
    try {
      // Use the RPC function
      const { data, error } = await supabase.rpc("admin_send_vendor_verification_message", {
        p_queue_item_id: item.id,
        p_subject: "",
        p_body: messageText.trim(),
        p_vendor_reply_required: vendorResponseRequired,
      });

      if (error) throw error;

      setMessageText("");
      setVendorResponseRequired(false);
      loadMessages();
      loadActions();
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
        last_waiting_email_sent_at: new Date().toISOString(),
        last_waiting_email_sent_to: pocEmail,
        last_waiting_email_sent_by_admin_id: getShortAdminId(user?.id),
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

  // Handle Request Second Look
  const handleRequestSecondLook = async () => {
    if (!user || !secondLookMessage.trim()) return;

    setRequestingSecondLook(true);
    try {
      // Update queue item
      await supabase
        .from("support_queue_items")
        .update({
          second_look_requested_by: user.id,
          second_look_requested_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.id);

      // Add internal note with the request
      await supabase.from("support_queue_internal_notes").insert({
        queue_item_id: item.id,
        body: `🔍 Second Look Requested:\n${secondLookMessage.trim()}`,
        created_by: user.id,
      });

      // Log action
      await supabase.from("support_queue_actions").insert({
        queue_item_id: item.id,
        action_type: "second_look_requested",
        channel: "in_app",
        body: "Second look requested",
        created_by: user.id,
      });

      setShowSecondLookDialog(false);
      setSecondLookMessage("");
      loadActions();
      loadInternalNotes();
      onRefresh();
      toast({ title: "Second look requested" });
    } catch (err) {
      console.error("Error requesting second look:", err);
      toast({ title: "Failed to request second look", variant: "destructive" });
    } finally {
      setRequestingSecondLook(false);
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

  // Handle status change with display label
  const handleStatusSelect = async (status: QueueStatus) => {
    if (status === "resolved") {
      handleApprove();
    } else if (status === "declined") {
      setShowDeclineDialog(true);
    } else {
      await onStatusChange(item.id, status);
      onRefresh();
    }
  };

  // Handle decline confirmation
  const handleDeclineConfirm = async () => {
    if (!user) return;

    setDeclining(true);
    try {
      // Update queue item status to declined
      await onStatusChange(item.id, "declined");

      // Log action
      await supabase.from("support_queue_actions").insert({
        queue_item_id: item.id,
        action_type: "declined",
        channel: "in_app",
        body: "Vendor verification declined (ticket closed; resubmission allowed).",
        created_by: user.id,
      });

      setShowDeclineDialog(false);
      loadActions();
      onRefresh();
      toast({ title: "Verification declined", description: "The vendor can resubmit for verification." });
    } catch (err) {
      console.error("Error declining:", err);
      toast({ title: "Failed to decline", variant: "destructive" });
    } finally {
      setDeclining(false);
    }
  };

  // Handle assignment change
  const handleAssignmentChange = async (userId: string | null) => {
    await onAssign(item.id, userId);
    onRefresh();
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

  // Determine if user is staff for message styling
  const isStaffUser = (senderId: string) => {
    return staffMembers.some(s => s.id === senderId) || senderId === user?.id;
  };

  return (
    <div className="h-full flex flex-col">
      {/* A) PINNED HEADER ROW */}
      <div className="p-4 border-b flex-shrink-0 space-y-3">
        {/* Row 1: Title + Category Badge + Metadata */}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
              <Badge variant="outline" className="text-xs shrink-0">Vendor Verification</Badge>
            </div>
            <h2 className="font-semibold text-lg truncate">{item.title}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Code: <span className="font-mono">{displayCode}</span>
              {pocName && <> · {pocName}</>}
              {shortCaseId && <> · Case #{shortCaseId}</>}
            </p>
          </div>

          {/* Status Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="shrink-0 gap-1">
                <Badge variant={STATUS_VARIANTS[item.status] || "secondary"} className="mr-1">
                  {getStatusLabel(item.status)}
                </Badge>
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {STATUS_OPTIONS.map((opt) => (
                <DropdownMenuItem
                  key={opt.value}
                  onClick={() => handleStatusSelect(opt.value)}
                  disabled={item.status === opt.value}
                  className={cn(item.status === opt.value && "bg-accent")}
                >
                  {opt.label}
                  {opt.value === "resolved" && " ✓"}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Row 2: Assignment + Second Look */}
        <div className="flex items-center gap-3 text-sm flex-wrap">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Assigned:</span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-6 px-2 gap-1">
                  {item.assignee?.full_name || "Unassigned"}
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={() => handleAssignmentChange(null)}>
                  Unassign
                </DropdownMenuItem>
                {staffMembers.map((staff) => (
                  <DropdownMenuItem
                    key={staff.id}
                    onClick={() => handleAssignmentChange(staff.id)}
                    className={cn(item.assigned_to === staff.id && "bg-accent")}
                  >
                    {staff.full_name || `ADM: ${getShortAdminId(staff.id)}`}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => setShowSecondLookDialog(true)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Request Second Look</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Awaiting indicator */}
        {awaitingVendorReply && awaitingSince && (
          <div className="flex items-center gap-2 text-xs text-amber-400">
            <Clock className="h-3 w-3" />
            Awaiting vendor reply since {formatTimestamp(awaitingSince)}
          </div>
        )}
        {lastVendorMessageAt && !awaitingVendorReply && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <MessageSquare className="h-3 w-3" />
            Last vendor message: {formatTimestamp(lastVendorMessageAt)}
          </div>
        )}
      </div>

      {/* B) PINNED TIMELINE */}
      <div className="px-4 py-2 border-b flex-shrink-0 bg-muted/30">
        <h3 className="text-[10px] font-medium text-muted-foreground uppercase mb-1">Activity Timeline</h3>
        <div className="space-y-1 max-h-24 overflow-y-auto text-[11px]">
          {loadingActions ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : actions.length === 0 ? (
            <p className="text-muted-foreground">Created: {formatTimestamp(item.created_at)}</p>
          ) : (
            <>
              {actions.slice(0, 6).map((action) => (
                <div key={action.id} className="flex items-center gap-2 text-muted-foreground">
                  <span className="text-foreground">
                    {formatTimestamp(action.created_at)}
                  </span>
                  <span className="text-muted-foreground">|</span>
                  <span className="font-medium">ADM: {getShortAdminId(action.created_by)}</span>
                  <span className="text-muted-foreground">|</span>
                  <span className="capitalize">{action.action_type.replace(/_/g, " ")}</span>
                  {action.body && action.action_type === "email_nudge_sent" && (
                    <span className="text-muted-foreground truncate">to {lastWaitingEmailSentTo || pocEmail}</span>
                  )}
                </div>
              ))}
              <div className="flex items-center gap-2 text-muted-foreground">
                <span>{formatTimestamp(item.created_at)}</span>
                <span>|</span>
                <span>SYS</span>
                <span>|</span>
                <span>Ticket created</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* C) MAIN BODY - Tabs */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <Tabs defaultValue="thread" className="flex-1 flex flex-col">
          <TabsList className="w-full grid grid-cols-2 shrink-0 mx-4 mt-2" style={{ width: "calc(100% - 2rem)" }}>
            <TabsTrigger value="thread" className="text-xs">
              <MessageSquare className="h-3 w-3 mr-1" />
              Vendor Thread
            </TabsTrigger>
            <TabsTrigger value="internal" className="text-xs">
              <Users className="h-3 w-3 mr-1" />
              Internal Notes
            </TabsTrigger>
          </TabsList>

          {/* Vendor Thread Tab */}
          <TabsContent value="thread" className="flex-1 overflow-hidden flex flex-col mt-0 px-4 pb-4">
            {needsThreadLink ? (
              <div className="flex-1 flex flex-col items-center justify-center py-4">
                <AlertCircle className="h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground mb-3">No conversation thread linked</p>
                <Button size="sm" onClick={handleLinkThread}>
                  Link Thread
                </Button>
              </div>
            ) : (
              <>
                {/* Vendor Details */}
                <div className="py-2 border-b shrink-0">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground">POC:</span>
                      <span className="ml-1">{pocName || "—"}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Email:</span>
                      <span className="ml-1">{pocEmail || "—"}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Submitted:</span>
                      <span className="ml-1">{submittedAt ? formatTimestamp(submittedAt) : "—"}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-muted-foreground">Code:</span>
                      {editingCode ? (
                        <div className="flex items-center gap-1 ml-1">
                          <Input
                            value={requestedCodeFinal}
                            onChange={(e) => setRequestedCodeFinal(e.target.value.toUpperCase())}
                            className="h-5 w-20 text-xs px-1"
                            maxLength={10}
                          />
                          <Button size="sm" className="h-5 w-5 p-0" onClick={handleSaveCode} disabled={savingCode}>
                            {savingCode ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                          </Button>
                          <Button size="sm" variant="ghost" className="h-5 w-5 p-0" onClick={() => setEditingCode(false)}>
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <>
                          <span className="ml-1 font-mono">{displayCode}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-4 w-4 p-0 ml-1"
                            onClick={() => {
                              setRequestedCodeFinal(requestedCodeFinalMeta || requestedCodeSuggested || "");
                              setEditingCode(true);
                            }}
                          >
                            <Pencil className="h-2.5 w-2.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Messages ScrollArea */}
                <ScrollArea className="flex-1 my-2">
                  <div className="space-y-3 pr-2">
                    {loadingMessages ? (
                      <p className="text-xs text-muted-foreground">Loading messages...</p>
                    ) : messages.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-4">No messages yet</p>
                    ) : (
                      messages.map((msg) => {
                        const isStaff = isStaffUser(msg.sender_id);
                        return (
                          <div
                            key={msg.id}
                            className={cn(
                              "p-2 rounded-lg text-sm",
                              isStaff ? "bg-primary/10 ml-6" : "bg-muted mr-6"
                            )}
                          >
                            <div className="flex items-center gap-2 mb-1 text-[10px] text-muted-foreground">
                              <span className="font-medium">
                                {isStaff 
                                  ? `ADM: ${getShortAdminId(msg.sender_id)}`
                                  : (msg.sender as { full_name: string | null })?.full_name || "Vendor"
                                }
                              </span>
                              <span>{formatTimestamp(msg.created_at)}</span>
                            </div>
                            <p className="whitespace-pre-wrap text-xs">{msg.body}</p>
                          </div>
                        );
                      })
                    )}
                  </div>
                </ScrollArea>

                {/* Compose */}
                <div className="space-y-2 shrink-0 pt-2 border-t">
                  <Textarea
                    placeholder="Type a message..."
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    rows={2}
                    className="text-sm resize-none"
                  />
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-xs cursor-pointer">
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
                  <div className="mt-2 pt-2 border-t shrink-0">
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
                      <p className="text-[10px] text-muted-foreground mt-1 text-center">
                        Last sent: {formatTimestamp(externalNudgeSentAt)} to {lastWaitingEmailSentTo || pocEmail}
                        {nudgeDisabled && " (cooldown active)"}
                      </p>
                    )}
                  </div>
                )}
              </>
            )}
          </TabsContent>

          {/* Internal Notes Tab (2nd Look) */}
          <TabsContent value="internal" className="flex-1 overflow-hidden flex flex-col mt-0 px-4 pb-4">
            <ScrollArea className="flex-1 my-2">
              <div className="space-y-2 pr-2">
                {loadingNotes ? (
                  <p className="text-xs text-muted-foreground">Loading...</p>
                ) : internalNotes.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">No internal notes yet</p>
                ) : (
                  internalNotes.map((note) => (
                    <div key={note.id} className="p-2 bg-amber-900/20 rounded text-sm border border-amber-800/30">
                      <div className="flex items-center gap-2 mb-1 text-[10px] text-muted-foreground">
                        <span className="font-medium">
                          {(note.author as { full_name: string | null })?.full_name || `ADM: ${getShortAdminId(note.created_by)}`}
                        </span>
                        <span>{formatTimestamp(note.created_at)}</span>
                      </div>
                      <p className="whitespace-pre-wrap text-xs">{note.body}</p>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>

            {/* Add note */}
            <div className="space-y-2 shrink-0 pt-2 border-t">
              <Textarea
                placeholder="Add internal note (admin-only, not visible to vendor)..."
                value={internalNoteText}
                onChange={(e) => setInternalNoteText(e.target.value)}
                rows={2}
                className="text-sm resize-none"
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

      {/* Second Look Dialog */}
      <Dialog open={showSecondLookDialog} onOpenChange={setShowSecondLookDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Second Look</DialogTitle>
            <DialogDescription>
              Ask another admin to review this verification request. Your message will be added as an internal note.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium">What do you need help with? *</label>
              <Textarea
                placeholder="Describe what you need reviewed..."
                value={secondLookMessage}
                onChange={(e) => setSecondLookMessage(e.target.value)}
                rows={3}
                className="mt-2"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSecondLookDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleRequestSecondLook}
              disabled={requestingSecondLook || !secondLookMessage.trim()}
            >
              {requestingSecondLook ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Request Review
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Decline Confirmation Dialog */}
      <Dialog open={showDeclineDialog} onOpenChange={setShowDeclineDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              Decline Verification
            </DialogTitle>
            <DialogDescription>
              This will close this verification ticket without approving the vendor.
              The vendor will still be able to resubmit for verification in the future.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeclineDialog(false)} disabled={declining}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeclineConfirm}
              disabled={declining}
            >
              {declining ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Confirm Decline
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
