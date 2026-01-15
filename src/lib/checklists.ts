import { SupabaseClient } from "@supabase/supabase-js";
import {
  VENDOR_BETA_ONBOARDING_TEMPLATE_ID,
  isVendorStaff,
} from "@/lib/checklistOwnerResolver";

export interface ChecklistTemplate {
  id: string;
  name: string;
  role: 'field_rep' | 'vendor' | 'both';
  owner_type: 'system' | 'vendor';
  owner_id: string | null;
  is_default: boolean;
  requires_paid_plan: boolean;
  created_at: string;
  updated_at: string;
}

export interface ChecklistItemDefinition {
  id: string;
  template_id: string;
  title: string;
  description: string | null;
  sort_order: number;
  role: 'field_rep' | 'vendor' | 'both';
  auto_track_key: string | null;
  is_required: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserChecklistItem {
  id: string;
  assignment_id: string;
  item_id: string;
  status: 'pending' | 'completed';
  completed_at: string | null;
  completed_by: 'system' | 'user' | string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  item?: ChecklistItemDefinition;
}

export interface UserChecklistAssignment {
  id: string;
  user_id: string;
  template_id: string;
  assigned_at: string;
  created_at: string;
  updated_at: string;
  // Joined data
  template?: ChecklistTemplate;
  items?: UserChecklistItem[];
}

export interface ChecklistProgress {
  assignment: UserChecklistAssignment;
  template: ChecklistTemplate;
  items: Array<{
    definition: ChecklistItemDefinition;
    userItem: UserChecklistItem;
  }>;
  completedCount: number;
  requiredCount: number;
  totalCount: number;
  completedRequiredCount: number;
  percent: number;
}

// CTA mappings for checklist items
export const CHECKLIST_ITEM_CTAS: Record<string, { label: string; link: string }> = {
  password_reset: { label: "Change Password", link: "/settings?tab=security" },
  profile_completed: { label: "Complete Profile", link: "/rep/profile" },
  coverage_pricing_set: { label: "Set Pricing", link: "/work-setup" },
  first_community_post: { label: "Open Community", link: "/community" },
  first_community_reply: { label: "Open Community", link: "/community" },
  first_seeking_coverage_response: { label: "Find Work", link: "/rep/find-work" },
  first_route_alert_sent: { label: "Send Alert", link: "/rep/availability" },
  first_agreement_accepted: { label: "View Agreements", link: "/rep/my-vendors" },
  first_vendor_review_submitted: { label: "Leave Review", link: "/rep/my-vendors" },
  notification_settings_saved: { label: "Notification Settings", link: "/settings/notifications" },
  vendor_profile_completed: { label: "Complete Profile", link: "/vendor/profile" },
  first_seeking_coverage_post: { label: "Create Post", link: "/vendor/seeking-coverage" },
  first_rep_message_sent: { label: "View Interested Reps", link: "/vendor/interested-reps" },
  first_agreement_created: { label: "My Field Reps", link: "/vendor/my-reps" },
  first_agreement_activated: { label: "My Field Reps", link: "/vendor/my-reps" },
  vendor_pricing_saved: { label: "Set Coverage", link: "/work-setup" },
  first_rep_review_submitted: { label: "Leave Review", link: "/vendor/my-reps" },
  first_route_alert_acknowledged: { label: "View Alerts", link: "/community?tab=network" },
  vendor_calendar_updated: { label: "Update Calendar", link: "/vendor/availability" },
};

/**
 * Load user's checklist assignments with all items and definitions
 */
export async function loadUserChecklists(
  supabase: SupabaseClient,
  userId: string
): Promise<ChecklistProgress[]> {
  // First, get all assignments for the user
  const { data: assignments, error: assignError } = await supabase
    .from("user_checklist_assignments")
    .select(`
      *,
      template:checklist_templates(*)
    `)
    .eq("user_id", userId);

  if (assignError || !assignments) {
    console.error("Error loading checklist assignments:", assignError);
    return [];
  }

  return buildChecklistProgress(supabase, assignments);
}

/**
 * Load user's checklists with special handling for vendor onboarding (shared between owner and staff)
 */
export async function loadUserChecklistsForVendorOnboarding(
  supabase: SupabaseClient,
  currentUserId: string,
  resolvedOwnerUserId: string
): Promise<ChecklistProgress[]> {
  // Load assignments for current user (non-vendor-onboarding templates)
  const { data: userAssignments, error: userAssignError } = await supabase
    .from("user_checklist_assignments")
    .select(`
      *,
      template:checklist_templates(*)
    `)
    .eq("user_id", currentUserId)
    .neq("template_id", VENDOR_BETA_ONBOARDING_TEMPLATE_ID);

  if (userAssignError) {
    console.error("Error loading user checklist assignments:", userAssignError);
  }

  // Load vendor onboarding from owner (shared)
  const { data: ownerOnboardingAssignment, error: ownerAssignError } = await supabase
    .from("user_checklist_assignments")
    .select(`
      *,
      template:checklist_templates(*)
    `)
    .eq("user_id", resolvedOwnerUserId)
    .eq("template_id", VENDOR_BETA_ONBOARDING_TEMPLATE_ID)
    .maybeSingle();

  if (ownerAssignError) {
    console.error("Error loading vendor onboarding assignment:", ownerAssignError);
  }

  // Combine assignments
  const allAssignments = [
    ...(userAssignments || []),
    ...(ownerOnboardingAssignment ? [ownerOnboardingAssignment] : []),
  ];

  return buildChecklistProgress(supabase, allAssignments);
}

/**
 * Build ChecklistProgress objects from raw assignments
 */
async function buildChecklistProgress(
  supabase: SupabaseClient,
  assignments: Array<UserChecklistAssignment & { template: ChecklistTemplate | null }>
): Promise<ChecklistProgress[]> {
  const results: ChecklistProgress[] = [];

  for (const assignment of assignments) {
    const template = assignment.template as ChecklistTemplate;
    if (!template) continue;

    // Get all items for this template
    const { data: itemDefs, error: itemsError } = await supabase
      .from("checklist_items")
      .select("*")
      .eq("template_id", template.id)
      .order("sort_order", { ascending: true });

    if (itemsError || !itemDefs) continue;

    // Get user's item statuses for this assignment
    const { data: userItems, error: userItemsError } = await supabase
      .from("user_checklist_items")
      .select("*")
      .eq("assignment_id", assignment.id);

    if (userItemsError) continue;

    const userItemMap = new Map(
      (userItems || []).map(ui => [ui.item_id, ui])
    );

    const items = itemDefs.map((def: ChecklistItemDefinition) => ({
      definition: def,
      userItem: userItemMap.get(def.id) || {
        id: "",
        assignment_id: assignment.id,
        item_id: def.id,
        status: "pending" as const,
        completed_at: null,
        completed_by: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    }));

    const requiredItems = items.filter(i => i.definition.is_required);
    const completedItems = items.filter(i => i.userItem.status === "completed");
    const completedRequiredItems = requiredItems.filter(i => i.userItem.status === "completed");

    results.push({
      assignment,
      template,
      items,
      completedCount: completedItems.length,
      requiredCount: requiredItems.length,
      totalCount: items.length,
      completedRequiredCount: completedRequiredItems.length,
      percent: requiredItems.length > 0
        ? Math.round((completedRequiredItems.length / requiredItems.length) * 100)
        : 100,
    });
  }

  return results;
}

/**
 * Mark a checklist item as completed manually
 * Now accepts completedByUserId for audit trail (who actually completed it)
 */
export async function completeChecklistItem(
  supabase: SupabaseClient,
  userItemId: string,
  completedByUserId?: string
): Promise<boolean> {
  const { error } = await supabase
    .from("user_checklist_items")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      completed_by: completedByUserId || "user",
    })
    .eq("id", userItemId);

  return !error;
}

/**
 * Complete a checklist item by auto_track_key (called when events occur)
 * Note: completedByUserId is reserved for future RPC enhancement for audit trail
 */
export async function completeChecklistByKey(
  supabase: SupabaseClient,
  userId: string,
  autoTrackKey: string,
  _completedByUserId?: string // Prefixed with _ as RPC doesn't yet support this param
): Promise<void> {
  // Note: The RPC marks completed_by as 'system' - consider updating RPC if audit needed
  await supabase.rpc("complete_checklist_item_by_key", {
    p_user_id: userId,
    p_auto_track_key: autoTrackKey,
  });
}

/**
 * Ensure vendor owner has the vendor beta onboarding checklist assigned
 * Used when staff accesses checklist before owner has been assigned
 */
export async function ensureVendorOwnerHasOnboarding(
  supabase: SupabaseClient,
  ownerUserId: string
): Promise<void> {
  // Check if owner already has the assignment
  const { data: existing } = await supabase
    .from("user_checklist_assignments")
    .select("id")
    .eq("user_id", ownerUserId)
    .eq("template_id", VENDOR_BETA_ONBOARDING_TEMPLATE_ID)
    .maybeSingle();

  if (existing) return; // Already assigned

  // Create assignment for owner
  const { data: assignment, error: assignError } = await supabase
    .from("user_checklist_assignments")
    .insert({
      user_id: ownerUserId,
      template_id: VENDOR_BETA_ONBOARDING_TEMPLATE_ID,
    })
    .select("id")
    .single();

  if (assignError || !assignment) {
    console.error("Error creating vendor onboarding assignment for owner:", assignError);
    return;
  }

  // Create user_checklist_items for the template
  const { data: templateItems } = await supabase
    .from("checklist_items")
    .select("id, auto_track_key")
    .eq("template_id", VENDOR_BETA_ONBOARDING_TEMPLATE_ID);

  if (templateItems && templateItems.length > 0) {
    const userItems = templateItems.map(item => ({
      assignment_id: assignment.id,
      item_id: item.id,
    }));

    await supabase.from("user_checklist_items").insert(userItems);
  }
}

/**
 * Assign default checklists to a new user based on their role
 * For vendor staff, skips the vendor onboarding template (uses owner's)
 */
export async function assignDefaultChecklists(
  supabase: SupabaseClient,
  userId: string,
  role: "field_rep" | "vendor"
): Promise<void> {
  // Check if user is vendor staff
  const userIsStaff = role === "vendor" && await isVendorStaff(supabase, userId);
  
  if (userIsStaff) {
    // For vendor staff, don't assign vendor onboarding - they use owner's
    // We can still assign other vendor checklists if any exist
    // For now, just return - staff will load owner's onboarding via loadUserChecklistsForVendorOnboarding
    console.log(`[assignDefaultChecklists] Skipping vendor onboarding for staff user ${userId}`);
    return;
  }
  
  // Normal assignment for non-staff users
  await supabase.rpc("assign_default_checklists", {
    p_user_id: userId,
    p_role: role,
  });
}

/**
 * Create a vendor-owned checklist template
 */
export async function createVendorTemplate(
  supabase: SupabaseClient,
  vendorId: string,
  name: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("checklist_templates")
    .insert({
      name,
      role: "field_rep",
      owner_type: "vendor",
      owner_id: vendorId,
      is_default: false,
      requires_paid_plan: true,
    })
    .select("id")
    .single();

  if (error) {
    console.error("Error creating vendor template:", error);
    return null;
  }

  return data.id;
}

/**
 * Add an item to a vendor-owned template
 */
export async function addTemplateItem(
  supabase: SupabaseClient,
  templateId: string,
  title: string,
  description: string,
  sortOrder: number,
  isRequired: boolean
): Promise<string | null> {
  const { data, error } = await supabase
    .from("checklist_items")
    .insert({
      template_id: templateId,
      title,
      description,
      sort_order: sortOrder,
      role: "field_rep",
      is_required: isRequired,
    })
    .select("id")
    .single();

  if (error) {
    console.error("Error adding template item:", error);
    return null;
  }

  return data.id;
}

export type ChecklistAssignmentSource = 'auto_on_connect' | 'manual_vendor' | 'manual_admin';

export interface AssignmentLogParams {
  source: ChecklistAssignmentSource;
  vendorId?: string | null;
  assignedBy?: string | null;
  notes?: string | null;
}

/**
 * Log a checklist assignment event for audit purposes
 */
export async function logChecklistAssignmentEvent(
  supabase: SupabaseClient,
  templateId: string,
  userId: string,
  params: AssignmentLogParams
): Promise<void> {
  try {
    await supabase.from("checklist_assignment_events").insert({
      template_id: templateId,
      user_id: userId,
      vendor_id: params.vendorId || null,
      assigned_by: params.assignedBy || null,
      source: params.source,
      notes: params.notes || null,
    });
  } catch (error) {
    // Don't let logging failures break the assignment flow
    console.error("Error logging checklist assignment event:", error);
  }
}

/**
 * Assign a vendor template to a field rep
 */
export async function assignTemplateToRep(
  supabase: SupabaseClient,
  templateId: string,
  repUserId: string,
  logParams?: AssignmentLogParams
): Promise<string | null> {
  // Create assignment
  const { data: assignment, error: assignError } = await supabase
    .from("user_checklist_assignments")
    .insert({
      user_id: repUserId,
      template_id: templateId,
    })
    .select("id")
    .single();

  if (assignError) {
    console.error("Error creating assignment:", assignError);
    return null;
  }

  // Get all items for template (including auto_track_key for sync)
  const { data: items } = await supabase
    .from("checklist_items")
    .select("id, auto_track_key")
    .eq("template_id", templateId);

  if (items && items.length > 0) {
    // Create user item records
    const userItems = items.map(item => ({
      assignment_id: assignment.id,
      item_id: item.id,
    }));

    await supabase.from("user_checklist_items").insert(userItems);

    // Retroactively check auto-tracked items and mark complete if already done
    const itemsWithAutoTrack = items.filter(i => i.auto_track_key);
    if (itemsWithAutoTrack.length > 0) {
      const { evaluateAutoTrackKeyForUser } = await import("@/lib/checklistTracking");
      
      for (const item of itemsWithAutoTrack) {
        if (!item.auto_track_key) continue;
        
        const isAlreadyDone = await evaluateAutoTrackKeyForUser(supabase, repUserId, item.auto_track_key);
        
        if (isAlreadyDone) {
          await supabase
            .from("user_checklist_items")
            .update({
              status: "completed",
              completed_at: new Date().toISOString(),
              completed_by: "system",
            })
            .eq("assignment_id", assignment.id)
            .eq("item_id", item.id);
        }
      }
    }
  }

  // Log the assignment event if params provided
  if (logParams) {
    await logChecklistAssignmentEvent(supabase, templateId, repUserId, logParams);
  }

  return assignment.id;
}

/**
 * Load vendor's created templates
 */
export async function loadVendorTemplates(
  supabase: SupabaseClient,
  vendorId: string
): Promise<ChecklistTemplate[]> {
  const { data, error } = await supabase
    .from("checklist_templates")
    .select("*")
    .eq("owner_type", "vendor")
    .eq("owner_id", vendorId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error loading vendor templates:", error);
    return [];
  }

  return data || [];
}

/**
 * Load template items for a given template
 */
export async function loadTemplateItems(
  supabase: SupabaseClient,
  templateId: string
): Promise<ChecklistItemDefinition[]> {
  const { data, error } = await supabase
    .from("checklist_items")
    .select("*")
    .eq("template_id", templateId)
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("Error loading template items:", error);
    return [];
  }

  return data || [];
}

/**
 * Load reps assigned to a vendor's template with their progress
 * Only shows field reps connected to the vendor
 */
export async function loadTemplateAssignees(
  supabase: SupabaseClient,
  templateId: string,
  vendorId?: string
): Promise<Array<{
  userId: string;
  anonymousId: string;
  fullName: string | null;
  completedCount: number;
  totalCount: number;
  percent: number;
}>> {
  // First check if this is a vendor template and get owner
  const { data: template } = await supabase
    .from("checklist_templates")
    .select("owner_type, owner_id")
    .eq("id", templateId)
    .single();

  const effectiveVendorId = vendorId || (template?.owner_type === "vendor" ? template.owner_id : null);

  // If vendor template, get connected rep IDs
  let connectedRepIds: Set<string> | null = null;
  if (effectiveVendorId) {
    const { data: connections } = await supabase
      .from("vendor_connections")
      .select("field_rep_id")
      .eq("vendor_id", effectiveVendorId)
      .eq("status", "connected");
    
    connectedRepIds = new Set(connections?.map(c => c.field_rep_id) || []);
  }

  const { data: assignments, error } = await supabase
    .from("user_checklist_assignments")
    .select(`
      user_id,
      user_checklist_items(status)
    `)
    .eq("template_id", templateId);

  if (error || !assignments) return [];

  // Get total items count for template
  const { count: totalItems } = await supabase
    .from("checklist_items")
    .select("*", { count: "exact", head: true })
    .eq("template_id", templateId);

  const results = [];

  for (const assignment of assignments) {
    // Filter to connected reps only if vendor context
    if (connectedRepIds && !connectedRepIds.has(assignment.user_id)) {
      continue;
    }

    // Get rep profile
    const { data: repProfile } = await supabase
      .from("rep_profile")
      .select("anonymous_id")
      .eq("user_id", assignment.user_id)
      .maybeSingle();

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, is_fieldrep")
      .eq("id", assignment.user_id)
      .maybeSingle();

    // For vendor templates, only show field reps
    if (effectiveVendorId && !profile?.is_fieldrep) {
      continue;
    }

    const items = assignment.user_checklist_items as Array<{ status: string }> || [];
    const completedCount = items.filter(i => i.status === "completed").length;
    const total = totalItems || items.length;

    results.push({
      userId: assignment.user_id,
      anonymousId: repProfile?.anonymous_id || "FieldRep#???",
      fullName: profile?.full_name || null,
      completedCount,
      totalCount: total,
      percent: total > 0 ? Math.round((completedCount / total) * 100) : 0,
    });
  }

  return results;
}

/**
 * Auto-assign vendor onboarding checklists when a rep connects to a vendor
 * Called when vendor_connections status becomes 'connected'
 */
export async function autoAssignVendorChecklists(
  supabase: SupabaseClient,
  vendorId: string,
  repUserId: string
): Promise<void> {
  // Get vendor templates that have auto_assign_on_connect enabled
  const { data: templates, error } = await supabase
    .from("checklist_templates")
    .select("id")
    .eq("owner_type", "vendor")
    .eq("owner_id", vendorId)
    .eq("auto_assign_on_connect", true);

  if (error || !templates || templates.length === 0) {
    return;
  }

  for (const template of templates) {
    // Check if already assigned
    const { data: existing } = await supabase
      .from("user_checklist_assignments")
      .select("id")
      .eq("user_id", repUserId)
      .eq("template_id", template.id)
      .maybeSingle();

    if (existing) {
      continue; // Skip if already assigned
    }

    // Assign the template with audit logging
    await assignTemplateToRep(supabase, template.id, repUserId, {
      source: 'auto_on_connect',
      vendorId,
      assignedBy: null, // System/auto assignment
    });
  }
}

/**
 * Sync auto-tracked checklist items for a user
 * Checks if any pending auto-tracked items are already satisfied and marks them complete
 * This enables retroactive completion for work done before checklist was assigned
 */
export async function syncAutoTrackedItems(
  client: SupabaseClient,
  userId: string
): Promise<number> {
  // Import evaluator dynamically to avoid circular dependency
  const { evaluateAutoTrackKeyForUser } = await import("@/lib/checklistTracking");
  
  // Get all user's assignments
  const { data: assignments, error: assignError } = await client
    .from("user_checklist_assignments")
    .select("id, template_id")
    .eq("user_id", userId);

  if (assignError || !assignments || assignments.length === 0) {
    return 0;
  }

  let syncedCount = 0;

  for (const assignment of assignments) {
    // Get items with auto_track_key that are still pending
    const { data: pendingItems, error: itemsError } = await client
      .from("user_checklist_items")
      .select(`
        id,
        item_id,
        status,
        checklist_items!inner(auto_track_key)
      `)
      .eq("assignment_id", assignment.id)
      .eq("status", "pending")
      .not("checklist_items.auto_track_key", "is", null);

    if (itemsError || !pendingItems || pendingItems.length === 0) {
      continue;
    }

    for (const item of pendingItems) {
      // Handle the joined checklist_items data - it comes as an object when using inner join
      const checklistItem = item.checklist_items as unknown as { auto_track_key: string | null } | null;
      const autoTrackKey = checklistItem?.auto_track_key;
      if (!autoTrackKey) continue;

      // Evaluate if condition is already met
      const isAlreadyDone = await evaluateAutoTrackKeyForUser(client, userId, autoTrackKey);

      if (isAlreadyDone) {
        // Mark as completed
        const { error: updateError } = await client
          .from("user_checklist_items")
          .update({
            status: "completed",
            completed_at: new Date().toISOString(),
            completed_by: "system",
          })
          .eq("id", item.id);

        if (!updateError) {
          syncedCount++;
        }
      }
    }
  }

  return syncedCount;
}
