import { useState, useEffect, useCallback } from "react";
import {
  User,
  Clock,
  ChevronDown,
  Loader2,
  Plus,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import { cn } from "@/lib/utils";
import { formatCT } from "@/lib/formatTimezone";
import {
  getCategoryConfig,
  getMetadataValue,
  STATUS_OPTIONS,
  STATUS_VARIANTS,
  getStatusLabel,
  getShortAdminId,
  QueueCategory,
  QueueStatus,
  SUPPORT_QUEUE_CATEGORIES,
} from "@/config/supportQueueCategories";
import { parseSupportCategory, formatShortCaseId } from "@/lib/supportCategory";
import { Hash } from "lucide-react";

// Categories that support_case items can be moved to
const SUPPORT_CASE_CATEGORIES: { value: QueueCategory; label: string }[] = [
  { value: "billing", label: "Billing" },
  { value: "support_tickets", label: "Support Tickets" },
  { value: "user_reports", label: "User Reports" },
  { value: "other", label: "Other" },
];

interface QueueItem {
  id: string;
  category: string;
  source_type: string;
  source_id: string;
  title: string;
  preview: string | null;
  priority: "normal" | "urgent";
  status: string;
  assigned_to: string | null;
  target_url: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
  conversation_id: string | null;
  assignee?: {
    id: string;
    full_name: string | null;
  } | null;
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

interface InternalNote {
  id: string;
  body: string;
  created_at: string;
  created_by: string;
  author?: { full_name: string | null };
}

interface StaffMember {
  id: string;
  full_name: string | null;
}

interface SupportQueueItemDetailProps {
  item: QueueItem;
  onStatusChange: (itemId: string, status: QueueStatus) => Promise<boolean>;
  onAssign: (itemId: string, userId: string | null) => Promise<boolean>;
  onRefresh: () => void;
  onCategoryChange?: (itemId: string, newCategory: QueueCategory) => void;
}

export function SupportQueueItemDetail({
  item,
  onStatusChange,
  onAssign,
  onRefresh,
  onCategoryChange,
}: SupportQueueItemDetailProps) {
  const { user } = useAuth();
  const { toast } = useToast();

  const categoryConfig = getCategoryConfig(item.category as QueueCategory);
  const IconComponent = categoryConfig.icon;
  const metadata = (item.metadata || {}) as Record<string, unknown>;

  // Extract Case # from metadata
  let caseId: string | null = null;
  if (typeof metadata.case_id === "string") {
    caseId = metadata.case_id;
  } else if (typeof metadata.support_category === "string") {
    const parsed = parseSupportCategory(metadata.support_category as string);
    if (parsed.caseId) caseId = parsed.caseId;
  } else if (item.conversation_id) {
    // Fallback: use conversation_id if it looks like a case ID
    caseId = item.conversation_id;
  }
  // Get requester role for Case # prefix (F = Field Rep, V = Vendor)
  const requesterRole = (metadata.requester_role as string | undefined) || 
                        (metadata.user_role as string | undefined) ||
                        (item.category === "vendor_verification" ? "vendor" : null);
  const shortCaseId = formatShortCaseId(caseId, requesterRole);

  // Check if this is a support case item that can be re-categorized
  // Only allow for support_case source_type AND when current category is one of the allowed buckets
  const allowedCategories: QueueCategory[] = ["billing", "support_tickets", "user_reports", "other"];
  const canRecategorize = 
    item.source_type === "support_case" && 
    allowedCategories.includes(item.category as QueueCategory);

  // State
  const [actions, setActions] = useState<ActionLog[]>([]);
  const [internalNotes, setInternalNotes] = useState<InternalNote[]>([]);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [loadingActions, setLoadingActions] = useState(false);
  const [loadingNotes, setLoadingNotes] = useState(false);

  const [internalNoteText, setInternalNoteText] = useState("");
  const [sendingNote, setSendingNote] = useState(false);

  // Second Look modal state
  const [showSecondLookDialog, setShowSecondLookDialog] = useState(false);
  const [secondLookMessage, setSecondLookMessage] = useState("");
  const [requestingSecondLook, setRequestingSecondLook] = useState(false);

  // Category change state
  const [changingCategory, setChangingCategory] = useState(false);

  // Use formatCT from lib for proper timezone handling
  const formatTimestamp = useCallback((dateStr: string) => {
    return formatCT(dateStr);
  }, []);

  // Auto-assign on first open if unassigned
  useEffect(() => {
    if (item.assigned_to === null && user) {
      onAssign(item.id, user.id);
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

  // Load actions timeline
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

  // Load internal notes
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
    loadActions();
    loadInternalNotes();
    loadStaffMembers();
  }, [item.id, loadActions, loadInternalNotes, loadStaffMembers]);

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

      // Log action
      await supabase.from("support_queue_actions").insert({
        queue_item_id: item.id,
        action_type: "note_added",
        channel: "in_app",
        body: "Internal note added",
        created_by: user.id,
      });

      setInternalNoteText("");
      loadInternalNotes();
      loadActions();
      toast({ title: "Note added" });
    } catch (err) {
      console.error("Error adding note:", err);
      toast({ title: "Failed to add note", variant: "destructive" });
    } finally {
      setSendingNote(false);
    }
  };

  // Handle status change
  const handleStatusSelect = async (status: QueueStatus) => {
    const success = await onStatusChange(item.id, status);
    if (success) {
      // Log action
      await supabase.from("support_queue_actions").insert({
        queue_item_id: item.id,
        action_type: `status_${status}`,
        channel: "in_app",
        body: `Status changed to ${getStatusLabel(status)}`,
        created_by: user?.id,
      });
      loadActions();
      onRefresh();
    }
  };

  // Handle category change (for support cases only)
  const handleCategoryChange = async (newCategory: QueueCategory) => {
    if (!user || newCategory === item.category) return;
    
    const oldCategoryLabel = getCategoryConfig(item.category as QueueCategory).label;
    const newCategoryLabel = getCategoryConfig(newCategory).label;
    
    setChangingCategory(true);
    try {
      // Update the category
      const { error } = await supabase
        .from("support_queue_items")
        .update({
          category: newCategory,
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.id);
      
      if (error) throw error;
      
      // Log the action
      await supabase.from("support_queue_actions").insert({
        queue_item_id: item.id,
        action_type: "category_changed",
        channel: "in_app",
        body: `Category changed: ${oldCategoryLabel} → ${newCategoryLabel}`,
        created_by: user.id,
      });
      
      toast({ title: `Moved to ${newCategoryLabel}` });
      loadActions();
      onRefresh();
      
      // Notify parent to switch filter if needed
      if (onCategoryChange) {
        onCategoryChange(item.id, newCategory);
      }
    } catch (err) {
      console.error("Error changing category:", err);
      toast({ title: "Failed to change category", variant: "destructive" });
    } finally {
      setChangingCategory(false);
    }
  };

  // Handle assignment change
  const handleAssignmentChange = async (userId: string | null) => {
    await onAssign(item.id, userId);
    onRefresh();
  };

  // Handle Request Second Look
  const handleRequestSecondLook = async () => {
    if (!user || !secondLookMessage.trim()) return;

    setRequestingSecondLook(true);
    try {
      await supabase
        .from("support_queue_items")
        .update({
          second_look_requested_by: user.id,
          second_look_requested_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.id);

      await supabase.from("support_queue_internal_notes").insert({
        queue_item_id: item.id,
        body: `🔍 Second Look Requested:\n${secondLookMessage.trim()}`,
        created_by: user.id,
      });

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

  // Get resolve button label from config
  const resolveLabel = categoryConfig.resolveLabel || "Resolve";

  return (
    <div className="h-full flex flex-col">
      {/* A) PINNED HEADER ROW */}
      <div className="p-4 border-b flex-shrink-0 space-y-3">
        {/* Row 1: Title + Category Badge/Dropdown + Priority + Status */}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={categoryConfig.color}>
                <IconComponent className="h-4 w-4" />
              </span>
              {/* Category: Dropdown for support cases, read-only badge otherwise */}
              {canRecategorize ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-6 px-2 gap-1 text-xs"
                      disabled={changingCategory}
                    >
                      {changingCategory ? (
                        <Loader2 className="h-3 w-3 animate-spin mr-1" />
                      ) : null}
                      {categoryConfig.label}
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    {SUPPORT_CASE_CATEGORIES.map((cat) => (
                      <DropdownMenuItem
                        key={cat.value}
                        onClick={() => handleCategoryChange(cat.value)}
                        className={cn(item.category === cat.value && "bg-accent")}
                        disabled={item.category === cat.value}
                      >
                        {cat.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Badge variant="outline" className="text-xs shrink-0">
                  {categoryConfig.label}
                </Badge>
              )}
              {item.priority === "urgent" && (
                <Badge variant="destructive" className="text-xs shrink-0">
                  Urgent
                </Badge>
              )}
            </div>
            <h2 className="font-semibold text-lg truncate">{item.title}</h2>
            {item.preview && (
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                {item.preview}
              </p>
            )}
            {shortCaseId && (
              <div className="flex items-center gap-1.5 mt-1">
                <Hash className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Case #</span>
                <Badge variant="outline" className="text-xs font-mono">
                  {shortCaseId}
                </Badge>
              </div>
            )}
          </div>

          {/* Status Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="shrink-0 gap-1">
                <Badge variant={STATUS_VARIANTS[item.status as QueueStatus] || "secondary"} className="mr-1">
                  {getStatusLabel(item.status as QueueStatus)}
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
                  {opt.value === "resolved" ? resolveLabel : opt.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Row 2: Assignment + Category (for support cases) + Second Look */}
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

          {item.target_url && (
            <a
              href={item.target_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              <ExternalLink className="h-3 w-3" />
              View Source
            </a>
          )}
        </div>
      </div>

      {/* B) PINNED ACTIVITY TIMELINE */}
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

      {/* C) SCROLLABLE CONTENT */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <ScrollArea className="flex-1 px-4 py-3">
          {/* Details Section */}
          <div className="mb-6">
            <h3 className="text-xs font-medium text-muted-foreground uppercase mb-3">Details</h3>
            <div className="grid grid-cols-1 gap-2">
              {categoryConfig.detailFields.map((field) => {
                const value = field.metadataPath ? getMetadataValue(metadata, field.metadataPath) : "—";
                // Skip fields with no value
                if (value === "—") return null;
                
                return (
                  <div key={field.key} className="flex gap-2 text-sm">
                    <span className="text-muted-foreground shrink-0 min-w-[120px]">{field.label}:</span>
                    <span className="text-foreground break-words">{value}</span>
                  </div>
                );
              })}
              
              {/* Always show timeline info */}
              <div className="flex gap-2 text-sm">
                <span className="text-muted-foreground shrink-0 min-w-[120px]">Created:</span>
                <span className="text-foreground">{formatTimestamp(item.created_at)}</span>
              </div>
              {item.resolved_at && (
                <div className="flex gap-2 text-sm">
                  <span className="text-muted-foreground shrink-0 min-w-[120px]">Resolved:</span>
                  <span className="text-foreground">{formatTimestamp(item.resolved_at)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Internal Notes Section */}
          <div className="mb-4">
            <h3 className="text-xs font-medium text-muted-foreground uppercase mb-3">Internal Notes</h3>
            <div className="space-y-2">
              {loadingNotes ? (
                <p className="text-xs text-muted-foreground">Loading...</p>
              ) : internalNotes.length === 0 ? (
                <p className="text-xs text-muted-foreground">No internal notes yet</p>
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
          </div>
        </ScrollArea>

        {/* Add Note Input */}
        <div className="px-4 py-3 border-t flex-shrink-0 space-y-2">
          <Textarea
            placeholder="Add internal note (admin-only)..."
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
            Add Note
          </Button>
        </div>
      </div>

      {/* Second Look Dialog */}
      <Dialog open={showSecondLookDialog} onOpenChange={setShowSecondLookDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Second Look</DialogTitle>
            <DialogDescription>
              Ask another admin to review this item. Your message will be added as an internal note.
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
    </div>
  );
}
