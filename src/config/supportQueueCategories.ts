import { LucideIcon, Star, ShieldAlert, CreditCard, Headphones, CheckCircle2, MoreHorizontal, UserRoundCog } from "lucide-react";

export type QueueCategory = 
  | "reviews" 
  | "violation_review"
  | "billing" 
  | "support_tickets" 
  | "vendor_verification"
  | "dual_role_requests"
  | "other";

// Safety: max fields per config
const MAX_SUMMARY_FIELDS = 2;
const MAX_PRIMARY_ACTIONS = 5;

export type QueueStatus = "open" | "in_progress" | "waiting" | "resolved" | "declined";
export type QueuePriority = "normal" | "urgent";

export interface CategoryField {
  key: string;
  label: string;
  metadataPath?: string; // e.g. "target_name" or "ratings.quality"
}

export interface PrimaryAction {
  key: string;
  label: string;
  variant?: "default" | "secondary" | "outline" | "destructive";
  targetStatus?: QueueStatus;
  requiresConfirmation?: boolean;
}

export interface CategoryConfig {
  key: QueueCategory;
  label: string;
  icon: LucideIcon;
  color: string;
  summaryFields: CategoryField[]; // Max 2 fields shown under title in list view
  detailFields: CategoryField[]; // Key/value list in detail panel
  primaryActions: PrimaryAction[];
  resolveLabel?: string; // Custom label for resolve action (default: "Resolve")
  emptyStateCopy?: string;
}

export const STATUS_OPTIONS: { value: QueueStatus; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In Progress" },
  { value: "waiting", label: "Waiting" },
  { value: "resolved", label: "Resolved" },
  { value: "declined", label: "Declined" },
];

export const STATUS_VARIANTS: Record<QueueStatus, "default" | "secondary" | "outline" | "destructive"> = {
  open: "destructive",
  in_progress: "default",
  waiting: "secondary",
  resolved: "outline",
  declined: "secondary",
};

export const SUPPORT_QUEUE_CATEGORIES: CategoryConfig[] = [
  {
    key: "reviews",
    label: "Reviews",
    icon: Star,
    color: "text-amber-400",
    summaryFields: [
      { key: "target", label: "Target", metadataPath: "target_name" },
      { key: "ratings", label: "Ratings", metadataPath: "ratings_summary" },
    ],
    detailFields: [
      { key: "review_type", label: "Review Type", metadataPath: "review_type" },
      { key: "target_name", label: "Target Name", metadataPath: "target_name" },
      { key: "target_id", label: "Target ID", metadataPath: "target_id" },
      { key: "rating_on_time", label: "On-Time Rating", metadataPath: "rating_on_time" },
      { key: "rating_quality", label: "Quality Rating", metadataPath: "rating_quality" },
      { key: "rating_communication", label: "Communication Rating", metadataPath: "rating_communication" },
      { key: "review_text", label: "Review Text", metadataPath: "summary_comment" },
      { key: "dispute_status", label: "Dispute Status", metadataPath: "dispute_status" },
      { key: "is_flagged", label: "Flagged", metadataPath: "is_flagged" },
    ],
    primaryActions: [
      { key: "in_progress", label: "Mark In Progress", targetStatus: "in_progress" },
      { key: "resolve", label: "Approve", targetStatus: "resolved" },
      { key: "hide", label: "Hide Review", variant: "destructive", requiresConfirmation: true },
      { key: "note", label: "Add Note", variant: "outline" },
    ],
    resolveLabel: "Approve",
  },
  {
    key: "violation_review",
    label: "Violation Review",
    icon: ShieldAlert,
    color: "text-red-400",
    summaryFields: [
      { key: "report_type", label: "Type", metadataPath: "target_type" },
      { key: "target", label: "Target", metadataPath: "target_name" },
    ],
    detailFields: [
      { key: "report_type", label: "Report Type", metadataPath: "target_type" },
      { key: "target_name", label: "Target Name", metadataPath: "target_name" },
      { key: "target_id", label: "Target ID", metadataPath: "target_id" },
      { key: "description", label: "Report Description", metadataPath: "description" },
      { key: "content_excerpt", label: "Content Excerpt", metadataPath: "content_excerpt" },
      { key: "report_reasons", label: "Report Reasons", metadataPath: "report_reasons" },
      { key: "reporter_name", label: "Reporter", metadataPath: "reporter_name" },
      { key: "evidence", label: "Evidence/Attachments", metadataPath: "evidence_urls" },
      { key: "target_profile_url", label: "Target Profile", metadataPath: "target_profile_url" },
    ],
    primaryActions: [
      { key: "in_progress", label: "Mark In Progress", targetStatus: "in_progress" },
      { key: "resolve", label: "Resolve", targetStatus: "resolved" },
      { key: "remove", label: "Remove Content", variant: "destructive", requiresConfirmation: true },
      { key: "escalate", label: "Escalate", variant: "secondary" },
      { key: "note", label: "Add Note", variant: "outline" },
    ],
    emptyStateCopy: "Review flagged content and user-submitted safety violations.",
  },
  // Background Checks removed - managed at /admin/background-checks only
  {
    key: "billing",
    label: "Billing",
    icon: CreditCard,
    color: "text-green-400",
    summaryFields: [
      { key: "issue", label: "Issue", metadataPath: "issue_type" },
      { key: "amount", label: "Amount", metadataPath: "amount" },
    ],
    detailFields: [
      { key: "issue_type", label: "Issue Type", metadataPath: "issue_type" },
      { key: "amount", label: "Amount", metadataPath: "amount" },
      { key: "stripe_id", label: "Stripe ID", metadataPath: "stripe_payment_intent_id" },
      { key: "pack_type", label: "Pack Type", metadataPath: "pack_type" },
      { key: "credits", label: "Credits", metadataPath: "credits_amount" },
      { key: "user_name", label: "User/Vendor", metadataPath: "user_name" },
      { key: "user_id", label: "User ID", metadataPath: "user_id" },
      { key: "date", label: "Date/Time", metadataPath: "transaction_date" },
      { key: "status", label: "Payment Status", metadataPath: "payment_status" },
    ],
    primaryActions: [
      { key: "in_progress", label: "Mark In Progress", targetStatus: "in_progress" },
      { key: "resolve", label: "Resolve", targetStatus: "resolved" },
      { key: "note", label: "Add Note", variant: "outline" },
    ],
    emptyStateCopy: "No billing issues in queue",
  },
  {
    key: "support_tickets",
    label: "Support Tickets",
    icon: Headphones,
    color: "text-purple-400",
    summaryFields: [
      { key: "from", label: "From", metadataPath: "user_name" },
      { key: "subject", label: "Subject", metadataPath: "subject" },
    ],
    detailFields: [
      { key: "user_name", label: "From", metadataPath: "user_name" },
      { key: "user_email", label: "Contact Email", metadataPath: "user_email" },
      { key: "subject", label: "Subject", metadataPath: "subject" },
      { key: "message", label: "Full Message", metadataPath: "message_body" },
      { key: "category", label: "Category", metadataPath: "ticket_category" },
      { key: "attachments", label: "Attachments", metadataPath: "attachment_urls" },
      { key: "priority", label: "Priority", metadataPath: "priority" },
    ],
    primaryActions: [
      { key: "in_progress", label: "Mark In Progress", targetStatus: "in_progress" },
      { key: "waiting", label: "Waiting on User", targetStatus: "waiting" },
      { key: "resolve", label: "Resolve/Close", targetStatus: "resolved" },
      { key: "note", label: "Add Note", variant: "outline" },
    ],
    resolveLabel: "Resolve/Close",
  },
  {
    key: "vendor_verification",
    label: "Vendor Verification",
    icon: CheckCircle2,
    color: "text-emerald-400",
    summaryFields: [
      { key: "code", label: "Code", metadataPath: "requested_code_suggested" },
      { key: "poc", label: "POC", metadataPath: "poc_name" },
    ],
    detailFields: [
      { key: "poc_name", label: "POC Name", metadataPath: "poc_name" },
      { key: "poc_email", label: "POC Email", metadataPath: "poc_email" },
      { key: "requested_code", label: "Requested Code", metadataPath: "requested_code_suggested" },
      { key: "final_code", label: "Final Code", metadataPath: "requested_code_final" },
      { key: "submitted_at", label: "Submitted", metadataPath: "verification_submitted_at" },
      { key: "vendor_user_id", label: "Vendor User ID", metadataPath: "vendor_user_id" },
    ],
    primaryActions: [
      { key: "in_progress", label: "Under Review", targetStatus: "in_progress" },
      { key: "waiting", label: "Waiting", targetStatus: "waiting" },
      { key: "approve", label: "Approve", targetStatus: "resolved" },
      { key: "note", label: "Add Note", variant: "outline" },
    ],
    resolveLabel: "Approved",
  },
  {
    key: "dual_role_requests",
    label: "Dual Role Requests",
    icon: UserRoundCog,
    color: "text-violet-400",
    summaryFields: [
      { key: "requester", label: "Requester", metadataPath: "requester_name" },
      { key: "business", label: "Business", metadataPath: "business_name" },
      { key: "requested_code", label: "Code", metadataPath: "requested_code" },
    ],
    detailFields: [
      { key: "requester_name", label: "Requester", metadataPath: "requester_name" },
      { key: "requester_email", label: "Email", metadataPath: "requester_email" },
      { key: "business_name", label: "Business Name", metadataPath: "business_name" },
      { key: "requested_code", label: "Requested Code", metadataPath: "requested_code" },
      { key: "office_email", label: "Office Email", metadataPath: "office_email" },
      { key: "office_phone", label: "Office Phone", metadataPath: "office_phone" },
      { key: "location", label: "Location", metadataPath: "location" },
      { key: "gl_status", label: "GL Status", metadataPath: "gl_status" },
      { key: "gl_expires_on", label: "GL Expires", metadataPath: "gl_expires_on" },
      { key: "submitted_at", label: "Submitted", metadataPath: "submitted_at" },
    ],
    primaryActions: [
      { key: "in_progress", label: "Under Review", targetStatus: "in_progress" },
      { key: "approve", label: "Approve", targetStatus: "resolved" },
      { key: "deny", label: "Deny", variant: "destructive", requiresConfirmation: true },
      { key: "note", label: "Add Note", variant: "outline" },
    ],
    resolveLabel: "Approve",
    emptyStateCopy: "No dual role requests yet. When a Field Rep submits a Dual Role Access Request, it will appear here automatically.",
  },
  {
    key: "other",
    label: "Other",
    icon: MoreHorizontal,
    color: "text-muted-foreground",
    summaryFields: [
      { key: "source_type", label: "Source", metadataPath: "source_type" },
      { key: "preview", label: "Preview", metadataPath: "preview" },
    ],
    detailFields: [
      { key: "source_type", label: "Source Type", metadataPath: "source_type" },
      { key: "source_id", label: "Source ID", metadataPath: "source_id" },
      { key: "target_url", label: "Target URL", metadataPath: "target_url" },
      { key: "description", label: "Description", metadataPath: "description" },
    ],
    primaryActions: [
      { key: "in_progress", label: "Mark In Progress", targetStatus: "in_progress" },
      { key: "resolve", label: "Resolve", targetStatus: "resolved" },
      { key: "note", label: "Add Note", variant: "outline" },
    ],
  },
];

// Helper to get category config by key
export function getCategoryConfig(category: QueueCategory): CategoryConfig {
  return SUPPORT_QUEUE_CATEGORIES.find(c => c.key === category) || SUPPORT_QUEUE_CATEGORIES[SUPPORT_QUEUE_CATEGORIES.length - 1];
}

// Helper to get status label
export function getStatusLabel(status: QueueStatus): string {
  return STATUS_OPTIONS.find(s => s.value === status)?.label || status;
}

// Helper to safely get nested metadata value
export function getMetadataValue(metadata: Record<string, unknown>, path: string): string {
  if (!metadata || !path) return "—";
  
  const parts = path.split(".");
  let value: unknown = metadata;
  
  for (const part of parts) {
    if (value && typeof value === "object" && part in value) {
      value = (value as Record<string, unknown>)[part];
    } else {
      return "—";
    }
  }
  
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.length > 0 ? value.join(", ") : "—";
  
  return String(value) || "—";
}

// Get short admin ID (first 4 chars uppercase)
export function getShortAdminId(userId: string | null | undefined): string {
  if (!userId) return "SYS";
  return userId.slice(0, 4).toUpperCase();
}

// ========== SAFETY CHECKS (dev-time) ==========

// Validate category config keys are unique
function validateCategoryKeys(): void {
  const keys = SUPPORT_QUEUE_CATEGORIES.map(c => c.key);
  const uniqueKeys = new Set(keys);
  if (keys.length !== uniqueKeys.size) {
    console.error("[supportQueueCategories] Duplicate category keys detected:", 
      keys.filter((k, i) => keys.indexOf(k) !== i));
  }
}

// Validate field limits
function validateFieldLimits(): void {
  for (const cat of SUPPORT_QUEUE_CATEGORIES) {
    if (cat.summaryFields.length > MAX_SUMMARY_FIELDS) {
      console.warn(`[supportQueueCategories] Category "${cat.key}" has ${cat.summaryFields.length} summaryFields (max ${MAX_SUMMARY_FIELDS})`);
    }
    if (cat.primaryActions.length > MAX_PRIMARY_ACTIONS) {
      console.warn(`[supportQueueCategories] Category "${cat.key}" has ${cat.primaryActions.length} primaryActions (max ${MAX_PRIMARY_ACTIONS})`);
    }
  }
}

// Run safety checks on module load (dev only)
if (typeof window !== "undefined" && import.meta.env?.DEV) {
  validateCategoryKeys();
  validateFieldLimits();
}

// Export list of category keys for iteration (excludes "all" filter)
export const QUEUE_CATEGORY_KEYS: QueueCategory[] = SUPPORT_QUEUE_CATEGORIES.map(c => c.key);
