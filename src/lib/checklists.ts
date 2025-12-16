import { SupabaseClient } from "@supabase/supabase-js";

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
  completed_by: 'system' | 'user' | null;
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
  password_reset: { label: "Reset Password", link: "/settings" },
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
 */
export async function completeChecklistItem(
  supabase: SupabaseClient,
  userItemId: string
): Promise<boolean> {
  const { error } = await supabase
    .from("user_checklist_items")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      completed_by: "user",
    })
    .eq("id", userItemId);

  return !error;
}

/**
 * Complete a checklist item by auto_track_key (called when events occur)
 */
export async function completeChecklistByKey(
  supabase: SupabaseClient,
  userId: string,
  autoTrackKey: string
): Promise<void> {
  await supabase.rpc("complete_checklist_item_by_key", {
    p_user_id: userId,
    p_auto_track_key: autoTrackKey,
  });
}

/**
 * Assign default checklists to a new user based on their role
 */
export async function assignDefaultChecklists(
  supabase: SupabaseClient,
  userId: string,
  role: "field_rep" | "vendor"
): Promise<void> {
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

  // Get all items for template
  const { data: items } = await supabase
    .from("checklist_items")
    .select("id")
    .eq("template_id", templateId);

  if (items && items.length > 0) {
    // Create user item records
    const userItems = items.map(item => ({
      assignment_id: assignment.id,
      item_id: item.id,
    }));

    await supabase.from("user_checklist_items").insert(userItems);
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
