import { supabase } from "@/integrations/supabase/client";
import { checklist } from "./checklistTracking";
import { autoAssignVendorChecklists } from "./checklists";

export interface TerritoryAssignment {
  id: string;
  vendor_id: string;
  rep_id: string;
  seeking_coverage_post_id: string | null;
  conversation_id: string | null;
  state_code: string;
  state_name: string;
  county_id: string | null;
  county_name: string | null;
  inspection_types: string[];
  systems_required: string[];
  agreed_rate: number;
  effective_date: string;
  notes: string | null;
  status: 'pending_rep' | 'active' | 'declined';
  decline_reason: string | null;
  created_by: string;
  vendor_confirmed_at: string | null;
  rep_confirmed_at: string | null;
  rep_confirmed_by: string | null;
  source: string;
  rate_override: boolean;
  rate_override_reason: string | null;
  rate_override_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Create a territory assignment from vendor to rep
 */
export async function createTerritoryAssignment(params: {
  vendorId: string;
  repId: string;
  seekingCoveragePostId: string;
  conversationId: string;
  stateCode: string;
  stateName: string;
  countyId?: string | null;
  countyName?: string | null;
  inspectionTypes: string[];
  systemsRequired: string[];
  agreedRate: number;
  effectiveDate: string;
  notes?: string | null;
  rateOverride?: boolean;
  rateOverrideReason?: string | null;
}): Promise<{ assignment: TerritoryAssignment | null; error: string | null }> {
  const { data, error } = await supabase
    .from("territory_assignments")
    .insert({
      vendor_id: params.vendorId,
      rep_id: params.repId,
      seeking_coverage_post_id: params.seekingCoveragePostId,
      conversation_id: params.conversationId,
      state_code: params.stateCode,
      state_name: params.stateName,
      county_id: params.countyId || null,
      county_name: params.countyName || null,
      inspection_types: params.inspectionTypes,
      systems_required: params.systemsRequired,
      agreed_rate: params.agreedRate,
      effective_date: params.effectiveDate,
      notes: params.notes || null,
      status: "pending_rep",
      created_by: params.vendorId,
      vendor_confirmed_at: new Date().toISOString(),
      rate_override: params.rateOverride || false,
      rate_override_reason: params.rateOverrideReason || null,
      rate_override_at: params.rateOverride ? new Date().toISOString() : null,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating territory assignment:", error);
    return { assignment: null, error: error.message };
  }

  // Update seeking coverage post to show pending assignment
  if (params.seekingCoveragePostId) {
    await supabase
      .from("seeking_coverage_posts")
      .update({ 
        has_pending_assignment: true,
        status: "open" // Keep open, just mark has_pending_assignment
      })
      .eq("id", params.seekingCoveragePostId);
  }

  // Send notification to rep
  await supabase.from("notifications").insert({
    user_id: params.repId,
    type: "territory_assignment",
    title: "Territory assignment pending",
    body: `A vendor wants to assign you ${params.countyName ? `${params.countyName}, ` : ''}${params.stateCode} at $${params.agreedRate}/order.`,
    ref_id: data.id,
  });

  // Post system message to conversation
  const systemMessage = formatSystemMessage("proposed", {
    countyName: params.countyName,
    stateCode: params.stateCode,
    inspectionTypes: params.inspectionTypes,
    agreedRate: params.agreedRate,
    effectiveDate: params.effectiveDate,
  });

  await supabase.from("messages").insert({
    conversation_id: params.conversationId,
    sender_id: params.vendorId,
    recipient_id: params.repId,
    body: systemMessage,
  });

  // Update conversation timestamp
  await supabase
    .from("conversations")
    .update({
      last_message_at: new Date().toISOString(),
      last_message_preview: "Territory assignment proposed",
    })
    .eq("id", params.conversationId);

  return { assignment: data as TerritoryAssignment, error: null };
}

/**
 * Check if a vendor-rep connection exists
 */
export async function checkVendorRepConnection(
  vendorId: string,
  repId: string
): Promise<{ exists: boolean; status: string | null }> {
  const { data, error } = await supabase
    .from("vendor_connections")
    .select("id, status")
    .eq("vendor_id", vendorId)
    .eq("field_rep_id", repId)
    .maybeSingle();

  if (error) {
    console.error("Error checking connection:", error);
    return { exists: false, status: null };
  }

  return { 
    exists: !!data, 
    status: data?.status || null 
  };
}

/**
 * Create or activate a vendor-rep connection
 * This is called when a rep accepts a territory assignment
 */
async function ensureVendorRepConnection(
  vendorId: string,
  repId: string,
  conversationId: string | null,
  source: string = "seeking_coverage_assignment"
): Promise<{ connectionId: string | null; wasCreated: boolean; error: string | null }> {
  // Check if connection already exists
  const { data: existing } = await supabase
    .from("vendor_connections")
    .select("id, status")
    .eq("vendor_id", vendorId)
    .eq("field_rep_id", repId)
    .maybeSingle();

  if (existing) {
    // Connection exists - ensure it's active
    if (existing.status !== "connected") {
      await supabase
        .from("vendor_connections")
        .update({ 
          status: "connected",
          responded_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
      
      // Auto-assign vendor onboarding checklists when reactivating connection
      await autoAssignVendorChecklists(supabase, vendorId, repId);
    }
    return { connectionId: existing.id, wasCreated: false, error: null };
  }

  // Create new connection
  const { data: newConnection, error } = await supabase
    .from("vendor_connections")
    .insert({
      vendor_id: vendorId,
      field_rep_id: repId,
      status: "connected",
      requested_by: "vendor",
      responded_at: new Date().toISOString(),
      conversation_id: conversationId,
    })
    .select("id")
    .single();

  if (error) {
    console.error("Error creating connection:", error);
    return { connectionId: null, wasCreated: false, error: error.message };
  }

  // Auto-assign vendor onboarding checklists to the rep
  await autoAssignVendorChecklists(supabase, vendorId, repId);

  return { connectionId: newConnection.id, wasCreated: true, error: null };
}

/**
 * Accept a territory assignment (rep action)
 * Uses a SECURITY DEFINER function to bypass RLS for cross-user updates
 */
export async function acceptTerritoryAssignment(
  assignmentId: string,
  repUserId: string
): Promise<{ error: string | null; connectionCreated?: boolean }> {
  console.debug("[territory] Accepting assignment:", {
    assignmentId,
    repUserId,
  });

  // Use the database function that handles all updates atomically with proper permissions
  const { data, error } = await supabase.rpc("accept_territory_assignment", {
    p_assignment_id: assignmentId,
    p_rep_user_id: repUserId,
  });

  if (error) {
    console.error("[territory] Accept RPC error:", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    return { error: `${error.code || "ERROR"}: ${error.message}` };
  }

  const result = data as { success: boolean; error?: string; connection_created?: boolean };
  
  if (!result.success) {
    return { error: result.error || "Failed to accept assignment" };
  }

  // Get assignment details for additional client-side actions
  const { data: assignment } = await supabase
    .from("territory_assignments")
    .select("*")
    .eq("id", assignmentId)
    .single();

  if (assignment) {
    // Post system message to conversation
    if (assignment.conversation_id) {
      const connectionNote = result.connection_created 
        ? "\n_Connection created from this Seeking Coverage assignment._" 
        : "";
      
      const systemMessage = formatSystemMessage("accepted", {
        countyName: assignment.county_name,
        stateCode: assignment.state_code,
        inspectionTypes: assignment.inspection_types || [],
        agreedRate: assignment.agreed_rate,
        effectiveDate: assignment.effective_date,
      }) + connectionNote;

      await supabase.from("messages").insert({
        conversation_id: assignment.conversation_id,
        sender_id: repUserId,
        recipient_id: assignment.vendor_id,
        body: systemMessage,
      });

      await supabase
        .from("conversations")
        .update({
          last_message_at: new Date().toISOString(),
          last_message_preview: "Territory assignment accepted",
        })
        .eq("id", assignment.conversation_id);
    }

    // Track checklist events for both rep and vendor
    checklist.firstAgreementAccepted(repUserId);
    checklist.firstAgreementActivated(assignment.vendor_id);

    // Auto-assign vendor checklists if connection was created
    if (result.connection_created) {
      await autoAssignVendorChecklists(supabase, assignment.vendor_id, assignment.rep_id);
    }
  }

  return { error: null, connectionCreated: result.connection_created };
}

/**
 * Decline a territory assignment (rep action)
 */
export async function declineTerritoryAssignment(
  assignmentId: string,
  repUserId: string,
  reason?: string
): Promise<{ error: string | null }> {
  console.debug("[territory] Declining assignment:", {
    assignmentId,
    repUserId,
    reason,
  });

  // Get assignment details
  const { data: assignment, error: fetchError } = await supabase
    .from("territory_assignments")
    .select("*")
    .eq("id", assignmentId)
    .single();

  if (fetchError) {
    console.error("[territory] Fetch error:", {
      code: fetchError.code,
      message: fetchError.message,
    });
    return { error: `Fetch failed: ${fetchError.code || "ERROR"}: ${fetchError.message}` };
  }

  if (!assignment) {
    return { error: "Assignment not found" };
  }

  if (assignment.status !== "pending_rep") {
    return { error: `Assignment is not pending (current status: ${assignment.status})` };
  }

  console.debug("[territory] Updating status to declined:", {
    assignmentId,
    currentStatus: assignment.status,
    newStatus: "declined",
  });

  // Update assignment to declined
  const { error: updateError } = await supabase
    .from("territory_assignments")
    .update({
      status: "declined",
      decline_reason: reason || null,
    })
    .eq("id", assignmentId);

  if (updateError) {
    console.error("[territory] Update error:", {
      code: updateError.code,
      message: updateError.message,
      details: updateError.details,
      hint: updateError.hint,
    });
    return { error: `${updateError.code || "ERROR"}: ${updateError.message}` };
  }

  // Check if there are other pending assignments for this post
  if (assignment.seeking_coverage_post_id) {
    const { data: otherPending } = await supabase
      .from("territory_assignments")
      .select("id")
      .eq("seeking_coverage_post_id", assignment.seeking_coverage_post_id)
      .eq("status", "pending_rep")
      .neq("id", assignmentId);

    if (!otherPending || otherPending.length === 0) {
      // No other pending assignments, reset post status
      await supabase
        .from("seeking_coverage_posts")
        .update({
          has_pending_assignment: false,
        })
        .eq("id", assignment.seeking_coverage_post_id);
    }
  }

  // Notify vendor
  await supabase.from("notifications").insert({
    user_id: assignment.vendor_id,
    type: "territory_assignment_declined",
    title: "Territory assignment declined",
    body: reason
      ? `Rep declined the assignment for ${assignment.county_name ? `${assignment.county_name}, ` : ''}${assignment.state_code}. Reason: "${reason}"`
      : `Rep declined the assignment for ${assignment.county_name ? `${assignment.county_name}, ` : ''}${assignment.state_code}.`,
    ref_id: assignmentId,
  });

  // Post system message
  if (assignment.conversation_id) {
    const systemMessage = `📋 **Rep declined territory assignment**
${assignment.county_name ? `${assignment.county_name}, ` : ''}${assignment.state_code}${reason ? `\nReason: "${reason}"` : ''}`;

    await supabase.from("messages").insert({
      conversation_id: assignment.conversation_id,
      sender_id: repUserId,
      recipient_id: assignment.vendor_id,
      body: systemMessage,
    });

    await supabase
      .from("conversations")
      .update({
        last_message_at: new Date().toISOString(),
        last_message_preview: "Territory assignment declined",
      })
      .eq("id", assignment.conversation_id);
  }

  // Mark the rep's pending assignment notification as read
  await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("ref_id", assignmentId)
    .eq("type", "territory_assignment")
    .eq("user_id", repUserId);

  return { error: null };
}

/**
 * Fetch pending territory assignment for a conversation
 */
export async function fetchPendingAssignmentForConversation(
  conversationId: string
): Promise<TerritoryAssignment | null> {
  const { data, error } = await supabase
    .from("territory_assignments")
    .select("*")
    .eq("conversation_id", conversationId)
    .eq("status", "pending_rep")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Error fetching pending assignment:", error);
    return null;
  }

  return data as TerritoryAssignment | null;
}

/**
 * Fetch active territory assignment for a conversation
 */
export async function fetchActiveAssignmentForConversation(
  conversationId: string
): Promise<TerritoryAssignment | null> {
  const { data, error } = await supabase
    .from("territory_assignments")
    .select("*")
    .eq("conversation_id", conversationId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Error fetching active assignment:", error);
    return null;
  }

  return data as TerritoryAssignment | null;
}

/**
 * Check if an active assignment already exists for this vendor-rep-territory combo
 */
export async function checkExistingActiveAssignment(
  vendorId: string,
  repId: string,
  stateCode: string,
  countyId?: string | null
): Promise<TerritoryAssignment | null> {
  let query = supabase
    .from("territory_assignments")
    .select("*")
    .eq("vendor_id", vendorId)
    .eq("rep_id", repId)
    .eq("state_code", stateCode)
    .eq("status", "active");

  if (countyId) {
    query = query.eq("county_id", countyId);
  } else {
    query = query.is("county_id", null);
  }

  const { data, error } = await query.limit(1).maybeSingle();

  if (error) {
    console.error("Error checking existing assignment:", error);
    return null;
  }

  return data as TerritoryAssignment | null;
}

/**
 * Ensure vendor_rep_agreements table is updated with new agreement
 * Note: Connection is already created by ensureVendorRepConnection, so we just handle the agreement here
 */
async function ensureAgreementOnFile(
  vendorId: string,
  repId: string,
  stateCode: string,
  countyName: string | null,
  rate: number,
  effectiveDate: string,
  workType: string | null,
  seekingCoveragePostId: string | null
): Promise<void> {
  // Check if agreement already exists
  const { data: existing } = await supabase
    .from("vendor_rep_agreements")
    .select("id, states_covered, coverage_summary, pricing_summary, base_rate")
    .eq("vendor_id", vendorId)
    .eq("field_rep_id", repId)
    .maybeSingle();

  if (existing) {
    // Update existing agreement
    const existingStates = existing.states_covered || [];
    const updatedStates = existingStates.includes(stateCode)
      ? existingStates
      : [...existingStates, stateCode];

    const newCoverageEntry = countyName 
      ? `${countyName}, ${stateCode}` 
      : `${stateCode} (statewide)`;
    
    const updatedCoverage = existing.coverage_summary
      ? `${existing.coverage_summary}; ${newCoverageEntry}`
      : newCoverageEntry;

    await supabase
      .from("vendor_rep_agreements")
      .update({
        states_covered: updatedStates,
        coverage_summary: updatedCoverage,
        pricing_summary: `$${rate}/order`,
        base_rate: rate,
        effective_date: effectiveDate,
        work_type: workType,
        source_seeking_coverage_post_id: seekingCoveragePostId,
      })
      .eq("id", existing.id);
  } else {
    // Create new agreement - connection already exists from ensureVendorRepConnection
    await supabase.from("vendor_rep_agreements").insert({
      vendor_id: vendorId,
      field_rep_id: repId,
      status: "active",
      states_covered: [stateCode],
      coverage_summary: countyName ? `${countyName}, ${stateCode}` : `${stateCode} (statewide)`,
      pricing_summary: `$${rate}/order`,
      base_rate: rate,
      effective_date: effectiveDate,
      work_type: workType,
      source_seeking_coverage_post_id: seekingCoveragePostId,
    });
  }
}

/**
 * Format system message for territory assignment events
 */
function formatSystemMessage(
  type: "proposed" | "accepted",
  data: {
    countyName: string | null;
    stateCode: string;
    inspectionTypes: string[];
    agreedRate: number;
    effectiveDate: string;
  }
): string {
  const location = data.countyName 
    ? `${data.countyName}, ${data.stateCode}` 
    : `${data.stateCode} (statewide)`;

  const formattedDate = new Date(data.effectiveDate).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  if (type === "proposed") {
    return `📋 **Vendor proposed territory assignment**
${location}
Agreed rate: $${data.agreedRate} / order
Effective date: ${formattedDate}
Status: Pending rep confirmation`;
  }

  return `✅ **Rep accepted territory assignment**
${location}
Agreed rate: $${data.agreedRate} / order
Effective date: ${formattedDate}
Status: Active`;
}
