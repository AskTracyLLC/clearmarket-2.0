/**
 * Support Category Utilities
 * 
 * Standardized parsing for support conversation categories.
 * 
 * Category formats:
 * - Singleton: "support:vendor_verification" (one thread per vendor)
 * - Case-based: "support:<topic>:<caseId>" (multiple threads per topic)
 *   - Examples: "support:billing:abc123", "support:support_ticket:xyz456"
 */

export interface ParsedSupportCategory {
  /** True if category starts with "support:" */
  isSupport: boolean;
  /** The topic after "support:" (e.g., "vendor_verification", "billing", "support_ticket") */
  topic: string | null;
  /** The case ID (UUID) if present after the second ":" */
  caseId: string | null;
  /** True if this is a singleton topic (no caseId allowed) */
  isSingleton: boolean;
  /** True if this is a case-based topic (has caseId) */
  isCaseBased: boolean;
}

/** Singleton topics - only one thread per vendor/user */
const SINGLETON_TOPICS = ["vendor_verification"] as const;

/**
 * Check if a category is a support category
 */
export function isSupportCategory(category?: string | null): boolean {
  return category?.startsWith("support:") ?? false;
}

/**
 * Parse a support category string into its components
 */
export function parseSupportCategory(category?: string | null): ParsedSupportCategory {
  if (!category || !category.startsWith("support:")) {
    return {
      isSupport: false,
      topic: null,
      caseId: null,
      isSingleton: false,
      isCaseBased: false,
    };
  }

  // Remove "support:" prefix
  const rest = category.slice(8); // "support:".length = 8
  
  // Split by ":" to get topic and optional caseId
  const parts = rest.split(":");
  const topic = parts[0] || null;
  const caseId = parts[1] || null;
  
  // Determine if singleton (vendor_verification has no caseId)
  const isSingleton = SINGLETON_TOPICS.includes(topic as typeof SINGLETON_TOPICS[number]) && !caseId;
  
  // Case-based if has a valid caseId
  const isCaseBased = !!caseId && caseId.length > 0;

  return {
    isSupport: true,
    topic,
    caseId,
    isSingleton,
    isCaseBased,
  };
}

/**
 * Format a support topic into a user-friendly label
 */
export function formatSupportTopicLabel(topic: string | null): string {
  if (!topic) return "Support";
  
  // Handle known topics explicitly
  const topicLabels: Record<string, string> = {
    vendor_verification: "Vendor Verification",
    billing: "Billing",
    support_ticket: "Support Ticket",
    user_report: "User Report",
    refund: "Refund",
    other: "Other",
    account: "Account",
    bug: "Bug Report",
    feature: "Feature Request",
  };
  
  if (topicLabels[topic]) {
    return topicLabels[topic];
  }
  
  // Fallback: convert snake_case to Title Case
  return topic
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Format a short case ID for display (first 8 characters)
 */
export function formatShortCaseId(caseId: string | null): string | null {
  if (!caseId) return null;
  // Take first 8 characters (typical UUID prefix)
  return caseId.slice(0, 8).toUpperCase();
}

/**
 * Build a support category string
 */
export function buildSupportCategory(topic: string, caseId?: string): string {
  if (caseId) {
    return `support:${topic}:${caseId}`;
  }
  return `support:${topic}`;
}

/**
 * Get the conversation filter for support conversations
 */
export function getSupportConversationFilter(): string {
  return "support:%";
}

/**
 * Check if a category should be excluded from conversation lists (e.g., archived)
 */
export function isArchivedCategory(category?: string | null): boolean {
  return category?.startsWith("archived:") ?? false;
}
