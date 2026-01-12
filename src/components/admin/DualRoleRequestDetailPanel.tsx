import { useState, useEffect, useCallback } from "react";
import {
  User,
  Clock,
  ChevronDown,
  Loader2,
  Plus,
  ExternalLink,
  Building2,
  Phone,
  Mail,
  MapPin,
  Globe,
  Linkedin,
  Calendar,
  Shield,
  Hash,
  Check,
  X,
  MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
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
import { format } from "date-fns";
import {
  getCategoryConfig,
  STATUS_OPTIONS,
  STATUS_VARIANTS,
  getStatusLabel,
  getShortAdminId,
  QueueCategory,
  QueueStatus,
} from "@/config/supportQueueCategories";

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

interface StaffMember {
  id: string;
  full_name: string | null;
}

interface DualRoleRequest {
  id: string;
  user_id: string;
  business_name: string;
  office_email: string;
  office_phone: string;
  business_city: string | null;
  business_state: string | null;
  website_url: string | null;
  linkedin_url: string | null;
  year_established: number | null;
  ein_last4: string | null;
  entity_type: string | null;
  message: string | null;
  requested_code: string | null;
  status: string;
  gl_status: string | null;
  gl_expires_on: string | null;
  gl_decision_note: string | null;
  decision_note: string | null;
  reviewed_at: string | null;
  created_at: string;
  profiles?: {
    full_name: string | null;
    email: string | null;
  } | null;
}

interface DualRoleRequestDetailPanelProps {
  item: QueueItem;
  onStatusChange: (itemId: string, status: QueueStatus) => Promise<boolean>;
  onAssign: (itemId: string, userId: string | null) => Promise<boolean>;
  onRefresh: () => void;
}

function parseBbbUrl(message: string | null): string | null {
  if (!message) return null;
  const match = message.match(/BBB:\s*(https?:\/\/\S+)/i);
  return match ? match[1] : null;
}

function getEntityTypeLabel(entityType: string | null): string {
  if (!entityType) return "—";
  // Handle both old lowercase values and new exact-case values
  const labels: Record<string, string> = {
    llc: "LLC",
    LLC: "LLC",
    corporation: "Corporation",
    Corporation: "Corporation",
    sole_proprietor: "Sole Proprietor",
    "Sole Proprietor": "Sole Proprietor",
    partnership: "Partnership",
    Partnership: "Partnership",
    other: "Other",
    Other: "Other",
  };
  return labels[entityType] || entityType;
}

export function DualRoleRequestDetailPanel({
  item,
  onStatusChange,
  onAssign,
  onRefresh,
}: DualRoleRequestDetailPanelProps) {
  const { user } = useAuth();
  const { toast } = useToast();

  const categoryConfig = getCategoryConfig(item.category as QueueCategory);
  const IconComponent = categoryConfig.icon;

  // State
  const [actions, setActions] = useState<ActionLog[]>([]);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [loadingActions, setLoadingActions] = useState(false);
  const [dualRoleRequest, setDualRoleRequest] = useState<DualRoleRequest | null>(null);
  const [loadingRequest, setLoadingRequest] = useState(true);

  // Decision form state
  const [decisionNote, setDecisionNote] = useState("");
  const [verifyGl, setVerifyGl] = useState(false);
  const [glNote, setGlNote] = useState("");
  const [processing, setProcessing] = useState(false);

  // Second Look modal state
  const [showSecondLookDialog, setShowSecondLookDialog] = useState(false);
  const [secondLookMessage, setSecondLookMessage] = useState("");
  const [requestingSecondLook, setRequestingSecondLook] = useState(false);

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

  // Load staff members
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

  // Load the actual dual role request data
  const loadDualRoleRequest = useCallback(async () => {
    if (!item.source_id) return;
    
    setLoadingRequest(true);
    try {
      const { data, error } = await supabase
        .from("dual_role_access_requests")
        .select(`
          *,
          profiles!dual_role_access_requests_user_id_fkey (
            full_name,
            email
          )
        `)
        .eq("id", item.source_id)
        .single();

      if (error) throw error;
      setDualRoleRequest(data);
    } catch (err) {
      console.error("Error loading dual role request:", err);
    } finally {
      setLoadingRequest(false);
    }
  }, [item.source_id]);

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

  useEffect(() => {
    loadDualRoleRequest();
    loadActions();
    loadStaffMembers();
  }, [item.id, loadDualRoleRequest, loadActions, loadStaffMembers]);

  // Handle status change
  const handleStatusSelect = async (status: QueueStatus) => {
    const success = await onStatusChange(item.id, status);
    if (success) {
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

  // Handle assignment change
  const handleAssignmentChange = async (userId: string | null) => {
    await onAssign(item.id, userId);
    onRefresh();
  };

  // Handle approve/deny decision
  const handleDecision = async (decision: "approved" | "denied") => {
    if (!dualRoleRequest || !user) return;

    setProcessing(true);
    try {
      const { error } = await supabase.rpc("review_dual_role_access_request", {
        p_request_id: dualRoleRequest.id,
        p_decision: decision,
        p_decision_note: decisionNote.trim() || null,
        p_verify_gl: verifyGl,
        p_gl_note: glNote.trim() || null,
      });

      if (error) {
        toast({ title: "Failed to process request", description: error.message, variant: "destructive" });
        return;
      }

      // Log action
      await supabase.from("support_queue_actions").insert({
        queue_item_id: item.id,
        action_type: decision === "approved" ? "dual_role_approved" : "dual_role_denied",
        channel: "in_app",
        body: `Request ${decision}${decisionNote ? `: ${decisionNote}` : ""}`,
        created_by: user.id,
      });

      // Update queue item status to resolved
      await onStatusChange(item.id, "resolved");

      toast({
        title: decision === "approved" ? "Request approved" : "Request denied",
        description: decision === "approved" 
          ? "User now has Dual Role access."
          : "User has been notified of the decision.",
      });

      setDecisionNote("");
      setVerifyGl(false);
      setGlNote("");
      loadDualRoleRequest();
      loadActions();
      onRefresh();
    } finally {
      setProcessing(false);
    }
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
      onRefresh();
      toast({ title: "Second look requested" });
    } catch (err) {
      console.error("Error requesting second look:", err);
      toast({ title: "Failed to request second look", variant: "destructive" });
    } finally {
      setRequestingSecondLook(false);
    }
  };

  const isPending = dualRoleRequest?.status === "pending";
  const hasGlExpiration = !!dualRoleRequest?.gl_expires_on;
  const bbbUrl = parseBbbUrl(dualRoleRequest?.message ?? null);

  const resolveLabel = categoryConfig.resolveLabel || "Resolve";

  return (
    <div className="h-full flex flex-col">
      {/* A) PINNED HEADER ROW */}
      <div className="p-4 border-b flex-shrink-0 space-y-3">
        {/* Row 1: Title + Category Badge + Priority + Status */}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={categoryConfig.color}>
                <IconComponent className="h-4 w-4" />
              </span>
              <Badge variant="outline" className="text-xs shrink-0">
                {categoryConfig.label}
              </Badge>
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
                  <span className="text-foreground">{formatTimestamp(action.created_at)}</span>
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
          {loadingRequest ? (
            <p className="text-sm text-muted-foreground">Loading request details...</p>
          ) : !dualRoleRequest ? (
            <p className="text-sm text-muted-foreground">Request not found</p>
          ) : (
            <div className="space-y-6">
              {/* Requester Info */}
              <div className="space-y-3">
                <h4 className="text-xs font-medium text-muted-foreground uppercase">Requester</h4>
                <div className="p-3 bg-muted/50 rounded-lg space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Name:</span>
                    <span>{dualRoleRequest.profiles?.full_name || "—"}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Account Email:</span>
                    <span>{dualRoleRequest.profiles?.email || "—"}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm font-mono">
                    <span className="text-muted-foreground">User ID:</span>
                    <span className="text-xs">{dualRoleRequest.user_id}</span>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Business Details */}
              <div className="space-y-3">
                <h4 className="text-xs font-medium text-muted-foreground uppercase">Business Information</h4>
                <div className="grid gap-3">
                  <div className="flex items-start gap-3">
                    <Building2 className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium">{dualRoleRequest.business_name}</p>
                      {dualRoleRequest.entity_type && (
                        <p className="text-xs text-muted-foreground">{getEntityTypeLabel(dualRoleRequest.entity_type)}</p>
                      )}
                    </div>
                  </div>

                  {dualRoleRequest.requested_code && (
                    <div className="flex items-center gap-3">
                      <Hash className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="flex items-center gap-2">
                        <span className="text-sm">Requested Code:</span>
                        <Badge variant="outline" className="font-mono">
                          {dualRoleRequest.requested_code}
                        </Badge>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-3">
                    <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-sm">{dualRoleRequest.office_phone}</span>
                  </div>

                  <div className="flex items-center gap-3">
                    <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-sm">{dualRoleRequest.office_email}</span>
                  </div>

                  {(dualRoleRequest.business_city || dualRoleRequest.business_state) && (
                    <div className="flex items-center gap-3">
                      <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-sm">
                        {dualRoleRequest.business_city && dualRoleRequest.business_state
                          ? `${dualRoleRequest.business_city}, ${dualRoleRequest.business_state}`
                          : dualRoleRequest.business_city || dualRoleRequest.business_state}
                      </span>
                    </div>
                  )}

                  {dualRoleRequest.website_url && (
                    <div className="flex items-center gap-3">
                      <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
                      <a 
                        href={dualRoleRequest.website_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline flex items-center gap-1"
                      >
                        {dualRoleRequest.website_url}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  )}

                  {dualRoleRequest.linkedin_url && (
                    <div className="flex items-center gap-3">
                      <Linkedin className="h-4 w-4 text-muted-foreground shrink-0" />
                      <a 
                        href={dualRoleRequest.linkedin_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline flex items-center gap-1"
                      >
                        LinkedIn Profile
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  )}

                  {dualRoleRequest.year_established && (
                    <div className="flex items-center gap-3">
                      <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-sm">Established {dualRoleRequest.year_established}</span>
                    </div>
                  )}

                  {dualRoleRequest.ein_last4 && (
                    <div className="flex items-center gap-3">
                      <Hash className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-sm">EIN: ••••••{dualRoleRequest.ein_last4}</span>
                    </div>
                  )}
                </div>
              </div>

              <Separator />

              {/* BBB Profile */}
              <div className="space-y-3">
                <h4 className="text-xs font-medium text-muted-foreground uppercase">BBB Profile</h4>
                {bbbUrl ? (
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <a 
                      href={bbbUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline flex items-center gap-1 break-all"
                    >
                      {bbbUrl}
                      <ExternalLink className="h-3 w-3 shrink-0" />
                    </a>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">—</p>
                )}
              </div>

              <Separator />

              {/* GL Insurance */}
              <div className="space-y-3">
                <h4 className="text-xs font-medium text-muted-foreground uppercase flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  GL Insurance
                </h4>
                <div className="p-3 bg-muted/50 rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">GL Status:</span>
                    {dualRoleRequest.gl_status === "none" || !dualRoleRequest.gl_status ? (
                      <span className="text-sm">Not submitted</span>
                    ) : dualRoleRequest.gl_status === "submitted" ? (
                      <Badge variant="secondary">Submitted</Badge>
                    ) : dualRoleRequest.gl_status === "verified" ? (
                      <Badge variant="default" className="bg-green-600">Verified</Badge>
                    ) : (
                      <Badge variant="destructive">Rejected</Badge>
                    )}
                  </div>
                  {dualRoleRequest.gl_expires_on && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Expiration:</span>
                      <span className="text-sm">{format(new Date(dualRoleRequest.gl_expires_on), "MMMM d, yyyy")}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Message */}
              {dualRoleRequest.message && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase flex items-center gap-2">
                      <MessageSquare className="h-4 w-4" />
                      Additional Message
                    </h4>
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <p className="text-sm whitespace-pre-wrap">{dualRoleRequest.message}</p>
                    </div>
                  </div>
                </>
              )}

              {/* Review History (if already reviewed) */}
              {dualRoleRequest.reviewed_at && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase">Review History</h4>
                    <div className="p-3 bg-muted/50 rounded-lg space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Reviewed:</span>
                        <span className="text-sm">{format(new Date(dualRoleRequest.reviewed_at), "MMMM d, yyyy")}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Decision:</span>
                        {dualRoleRequest.status === "approved" ? (
                          <Badge variant="default" className="bg-green-600"><Check className="h-3 w-3 mr-1" />Approved</Badge>
                        ) : dualRoleRequest.status === "denied" ? (
                          <Badge variant="destructive"><X className="h-3 w-3 mr-1" />Denied</Badge>
                        ) : (
                          <Badge variant="outline">{dualRoleRequest.status}</Badge>
                        )}
                      </div>
                      {dualRoleRequest.decision_note && (
                        <div>
                          <span className="text-sm text-muted-foreground">Decision Note:</span>
                          <p className="text-sm mt-1">{dualRoleRequest.decision_note}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}

              {/* Admin Decision Form (only if pending) */}
              {isPending && (
                <>
                  <Separator />
                  <div className="space-y-4">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase">Review Decision</h4>

                    <div className="space-y-2">
                      <Label htmlFor="decisionNote">Decision Note (optional)</Label>
                      <Textarea
                        id="decisionNote"
                        value={decisionNote}
                        onChange={(e) => setDecisionNote(e.target.value)}
                        placeholder="Add a note about your decision..."
                        rows={2}
                      />
                    </div>

                    <div className="space-y-3 p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-start space-x-3">
                        <Switch
                          id="verifyGl"
                          checked={verifyGl}
                          onCheckedChange={setVerifyGl}
                          disabled={!hasGlExpiration}
                        />
                        <div className="space-y-1">
                          <Label htmlFor="verifyGl" className={!hasGlExpiration ? "text-muted-foreground" : ""}>
                            Verify GL (adds GL Insured badge)
                          </Label>
                          {!hasGlExpiration && (
                            <p className="text-xs text-muted-foreground">
                              No expiration date submitted.
                            </p>
                          )}
                        </div>
                      </div>

                      {verifyGl && hasGlExpiration && (
                        <div className="space-y-2 pl-10">
                          <Label htmlFor="glNote">GL Note (optional)</Label>
                          <Textarea
                            id="glNote"
                            value={glNote}
                            onChange={(e) => setGlNote(e.target.value)}
                            placeholder="Add a note about GL verification..."
                            rows={2}
                          />
                        </div>
                      )}
                    </div>

                    {/* Approve/Deny Buttons */}
                    <div className="flex gap-2">
                      <Button
                        variant="destructive"
                        onClick={() => handleDecision("denied")}
                        disabled={processing}
                        className="flex-1"
                      >
                        {processing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <X className="h-4 w-4 mr-1" />}
                        Deny
                      </Button>
                      <Button
                        onClick={() => handleDecision("approved")}
                        disabled={processing}
                        className="flex-1"
                      >
                        {processing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Check className="h-4 w-4 mr-1" />}
                        Approve
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Second Look Dialog */}
      <Dialog open={showSecondLookDialog} onOpenChange={setShowSecondLookDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Second Look</DialogTitle>
            <DialogDescription>
              Ask another admin to review this request. Your message will be added as an internal note.
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