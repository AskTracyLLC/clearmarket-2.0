import { supabase } from "@/integrations/supabase/client";

export interface WorkingTermsRequest {
  id: string;
  vendor_id: string;
  rep_id: string;
  requested_states: string[];
  requested_counties: string[] | null;
  message_from_vendor: string | null;
  status: 'pending_rep' | 'pending_vendor' | 'pending_rep_confirm' | 'active' | 'declined';
  decline_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkingTermsRow {
  id: string;
  working_terms_request_id: string;
  vendor_id: string;
  rep_id: string;
  state_code: string;
  county_name: string | null;
  inspection_type: string;
  rate: number | null;
  turnaround_days: number | null;
  source: 'from_profile' | 'added_by_vendor' | 'added_by_rep';
  included: boolean;
  effective_from: string;
  status: 'active' | 'inactive' | 'pending_change_vendor' | 'pending_change_rep';
  inactivated_at: string | null;
  inactivated_reason: string | null;
  inactivated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkingTermsChangeRequest {
  id: string;
  working_terms_row_id: string;
  requested_by_role: 'vendor' | 'rep';
  requested_by_user_id: string;
  old_rate: number | null;
  new_rate: number | null;
  old_turnaround_days: number | null;
  new_turnaround_days: number | null;
  effective_from: string;
  reason: string;
  status: 'pending' | 'accepted' | 'declined' | 'withdrawn';
  decline_reason: string | null;
  responded_by_user_id: string | null;
  responded_at: string | null;
  created_at: string;
  updated_at: string;
}

export const INSPECTION_TYPES = [
  { value: "property", label: "Property Inspections" },
  { value: "loss_claims", label: "Loss / Insurance Claims" },
  { value: "commercial", label: "Commercial" },
  { value: "other", label: "Other" },
] as const;

export const INSPECTION_TYPE_LABELS: Record<string, string> = {
  property: "Property Inspections",
  loss_claims: "Loss / Insurance Claims",
  commercial: "Commercial",
  other: "Other",
};

/**
 * Create a new working terms request from vendor to rep
 */
export async function createWorkingTermsRequest(
  vendorId: string,
  repId: string,
  requestedStates: string[],
  requestedCounties: string[] | null,
  message: string | null
): Promise<{ id: string | null; error: string | null }> {
  const { data, error } = await supabase
    .from("working_terms_requests")
    .insert({
      vendor_id: vendorId,
      rep_id: repId,
      requested_states: requestedStates,
      requested_counties: requestedCounties,
      message_from_vendor: message,
      status: "pending_rep",
    })
    .select("id")
    .single();

  if (error) {
    console.error("Error creating working terms request:", error);
    return { id: null, error: error.message };
  }

  // Send notification to rep
  await supabase.from("notifications").insert({
    user_id: repId,
    type: "working_terms_request",
    title: "Coverage & pricing request",
    body: `A vendor requested your coverage & pricing for ${requestedStates.join(", ")}.`,
    ref_id: data.id,
  });

  return { id: data.id, error: null };
}

/**
 * Decline a working terms request
 */
export async function declineWorkingTermsRequest(
  requestId: string,
  reason: string | null
): Promise<{ error: string | null }> {
  const { data: request, error: fetchError } = await supabase
    .from("working_terms_requests")
    .select("vendor_id, rep_id")
    .eq("id", requestId)
    .single();

  if (fetchError || !request) {
    return { error: "Request not found" };
  }

  const { error } = await supabase
    .from("working_terms_requests")
    .update({
      status: "declined",
      decline_reason: reason,
    })
    .eq("id", requestId);

  if (error) {
    console.error("Error declining request:", error);
    return { error: error.message };
  }

  // Notify vendor
  await supabase.from("notifications").insert({
    user_id: request.vendor_id,
    type: "working_terms_declined",
    title: "Coverage request declined",
    body: reason ? `Your request was declined: "${reason}"` : "Your coverage request was declined.",
    ref_id: requestId,
  });

  return { error: null };
}

/**
 * Fetch rep's coverage data cross-joined with inspection types
 */
export async function fetchRepCoverageRows(
  repUserId: string,
  stateFilter?: string,
  countyFilter?: string[],
  inspectionTypeFilter?: string[]
): Promise<Array<{
  state_code: string;
  county_name: string | null;
  inspection_type: string;
  rate: number | null;
  turnaround_days: number | null;
}>> {
  // Fetch all coverage areas for this rep
  let query = supabase
    .from("rep_coverage_areas")
    .select("*")
    .eq("user_id", repUserId);

  if (stateFilter) {
    query = query.eq("state_code", stateFilter);
  }

  const { data: coverageAreas, error } = await query;

  if (error || !coverageAreas) {
    console.error("Error fetching coverage areas:", error);
    return [];
  }

  // Cross-join with inspection types
  const rows: Array<{
    state_code: string;
    county_name: string | null;
    inspection_type: string;
    rate: number | null;
    turnaround_days: number | null;
  }> = [];

  for (const area of coverageAreas) {
    // Get inspection types for this area (or all if not set)
    const areaInspectionTypes = area.inspection_types?.length
      ? area.inspection_types
      : ["property", "loss_claims", "commercial", "other"];

    for (const inspectionType of areaInspectionTypes) {
      // Apply inspection type filter if provided
      if (inspectionTypeFilter?.length && !inspectionTypeFilter.includes(inspectionType)) {
        continue;
      }

      // Apply county filter if provided
      if (countyFilter?.length && area.county_name && !countyFilter.includes(area.county_name)) {
        continue;
      }

      rows.push({
        state_code: area.state_code,
        county_name: area.county_name,
        inspection_type: inspectionType,
        rate: area.base_price,
        turnaround_days: null, // We don't currently store turnaround in coverage areas
      });
    }
  }

  return rows;
}

/**
 * Submit working terms rows from rep to vendor
 */
export async function submitWorkingTermsRows(
  requestId: string,
  rows: Array<{
    state_code: string;
    county_name: string | null;
    inspection_type: string;
    rate: number | null;
    turnaround_days: number | null;
    selected: boolean;
  }>,
  updateProfile: boolean
): Promise<{ error: string | null }> {
  // Get the request
  const { data: request, error: fetchError } = await supabase
    .from("working_terms_requests")
    .select("*")
    .eq("id", requestId)
    .single();

  if (fetchError || !request) {
    return { error: "Request not found" };
  }

  // Delete existing rows for this request
  await supabase
    .from("working_terms_rows")
    .delete()
    .eq("working_terms_request_id", requestId);

  // Insert selected rows
  const selectedRows = rows.filter(r => r.selected);
  if (selectedRows.length === 0) {
    return { error: "Please select at least one row" };
  }

  const { error: insertError } = await supabase
    .from("working_terms_rows")
    .insert(
      selectedRows.map(r => ({
        working_terms_request_id: requestId,
        vendor_id: request.vendor_id,
        rep_id: request.rep_id,
        state_code: r.state_code,
        county_name: r.county_name,
        inspection_type: r.inspection_type,
        rate: r.rate,
        turnaround_days: r.turnaround_days,
        source: "from_profile" as const,
        included: false,
      }))
    );

  if (insertError) {
    console.error("Error inserting rows:", insertError);
    return { error: insertError.message };
  }

  // Update request status
  const { error: updateError } = await supabase
    .from("working_terms_requests")
    .update({ status: "pending_vendor" })
    .eq("id", requestId);

  if (updateError) {
    return { error: updateError.message };
  }

  // Optionally update profile coverage (if user selected that option)
  if (updateProfile) {
    // This would update rep_coverage_areas with the new rates
    // For now we skip this to keep it simpler
  }

  // Notify vendor
  await supabase.from("notifications").insert({
    user_id: request.vendor_id,
    type: "working_terms_submitted",
    title: "Coverage & pricing received",
    body: `Coverage details were shared for ${request.requested_states.join(", ")}.`,
    ref_id: requestId,
  });

  return { error: null };
}

/**
 * Vendor confirms or updates working terms
 */
export async function vendorUpdateWorkingTerms(
  requestId: string,
  rows: Array<{
    id?: string;
    state_code: string;
    county_name: string | null;
    inspection_type: string;
    rate: number | null;
    turnaround_days: number | null;
    source: 'from_profile' | 'added_by_vendor' | 'added_by_rep';
    included: boolean;
  }>,
  confirm: boolean
): Promise<{ error: string | null }> {
  const { data: request, error: fetchError } = await supabase
    .from("working_terms_requests")
    .select("*")
    .eq("id", requestId)
    .single();

  if (fetchError || !request) {
    return { error: "Request not found" };
  }

  // Delete old rows and insert new ones
  await supabase
    .from("working_terms_rows")
    .delete()
    .eq("working_terms_request_id", requestId);

  const { error: insertError } = await supabase
    .from("working_terms_rows")
    .insert(
      rows.map(r => ({
        working_terms_request_id: requestId,
        vendor_id: request.vendor_id,
        rep_id: request.rep_id,
        state_code: r.state_code,
        county_name: r.county_name,
        inspection_type: r.inspection_type,
        rate: r.rate,
        turnaround_days: r.turnaround_days,
        source: r.source,
        included: confirm ? r.included : false,
      }))
    );

  if (insertError) {
    return { error: insertError.message };
  }

  // Update status
  const newStatus = confirm ? "active" : "pending_rep_confirm";
  const { error: updateError } = await supabase
    .from("working_terms_requests")
    .update({ status: newStatus })
    .eq("id", requestId);

  if (updateError) {
    return { error: updateError.message };
  }

  // Notify rep
  await supabase.from("notifications").insert({
    user_id: request.rep_id,
    type: confirm ? "working_terms_confirmed" : "working_terms_updated",
    title: confirm ? "Working terms confirmed" : "Working terms updated",
    body: confirm
      ? "Your working terms have been confirmed."
      : "The vendor made changes to your working terms. Please review.",
    ref_id: requestId,
  });

  return { error: null };
}

/**
 * Rep confirms final working terms
 */
export async function repConfirmWorkingTerms(
  requestId: string,
  includedRowIds: string[]
): Promise<{ error: string | null }> {
  const { data: request, error: fetchError } = await supabase
    .from("working_terms_requests")
    .select("vendor_id, rep_id")
    .eq("id", requestId)
    .single();

  if (fetchError || !request) {
    return { error: "Request not found" };
  }

  // Update all rows: set included based on selection
  const { data: allRows } = await supabase
    .from("working_terms_rows")
    .select("id")
    .eq("working_terms_request_id", requestId);

  if (allRows) {
    for (const row of allRows) {
      await supabase
        .from("working_terms_rows")
        .update({ included: includedRowIds.includes(row.id) })
        .eq("id", row.id);
    }
  }

  // Update status to active
  const { error: updateError } = await supabase
    .from("working_terms_requests")
    .update({ status: "active" })
    .eq("id", requestId);

  if (updateError) {
    return { error: updateError.message };
  }

  // Notify vendor
  await supabase.from("notifications").insert({
    user_id: request.vendor_id,
    type: "working_terms_confirmed",
    title: "Working terms confirmed",
    body: "Your working terms have been confirmed by the field rep.",
    ref_id: requestId,
  });

  return { error: null };
}

/**
 * Fetch active working terms for a vendor-rep pair
 */
export async function fetchActiveWorkingTerms(
  vendorId: string,
  repId: string
): Promise<{
  request: WorkingTermsRequest | null;
  rows: WorkingTermsRow[];
} | null> {
  const { data: request } = await supabase
    .from("working_terms_requests")
    .select("*")
    .eq("vendor_id", vendorId)
    .eq("rep_id", repId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!request) {
    return null;
  }

  const { data: rows } = await supabase
    .from("working_terms_rows")
    .select("*")
    .eq("working_terms_request_id", request.id)
    .eq("included", true);

  return {
    request: request as WorkingTermsRequest,
    rows: (rows || []) as WorkingTermsRow[],
  };
}

/**
 * Fetch pending working terms requests for a user
 */
export async function fetchPendingWorkingTermsRequests(
  userId: string,
  role: 'vendor' | 'rep'
): Promise<WorkingTermsRequest[]> {
  const column = role === 'vendor' ? 'vendor_id' : 'rep_id';
  const statuses = role === 'vendor' 
    ? ['pending_vendor', 'pending_rep_confirm'] 
    : ['pending_rep', 'pending_rep_confirm'];

  const { data, error } = await supabase
    .from("working_terms_requests")
    .select("*")
    .eq(column, userId)
    .in("status", statuses)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching pending requests:", error);
    return [];
  }

  return (data || []) as WorkingTermsRequest[];
}

/**
 * Inactivate a working terms row
 */
export async function inactivateWorkingTermsRow(
  rowId: string,
  reason: string,
  inactivatedByUserId: string,
  role: 'vendor' | 'rep'
): Promise<{ error: string | null }> {
  // Get the row to find the other party
  const { data: row, error: fetchError } = await supabase
    .from("working_terms_rows")
    .select("*, working_terms_requests!inner(vendor_id, rep_id)")
    .eq("id", rowId)
    .single();

  if (fetchError || !row) {
    return { error: "Row not found" };
  }

  // Update the row
  const { error: updateError } = await supabase
    .from("working_terms_rows")
    .update({
      status: "inactive",
      inactivated_at: new Date().toISOString(),
      inactivated_reason: reason,
      inactivated_by: inactivatedByUserId,
    })
    .eq("id", rowId);

  if (updateError) {
    return { error: updateError.message };
  }

  // Get names for notification
  const otherUserId = role === 'rep' 
    ? (row.working_terms_requests as any).vendor_id 
    : (row.working_terms_requests as any).rep_id;

  const areaDesc = `${row.state_code}${row.county_name ? ` – ${row.county_name}` : ""} (${INSPECTION_TYPE_LABELS[row.inspection_type] || row.inspection_type})`;

  // Notify the other party
  const notificationTitle = role === 'rep' 
    ? "Coverage area inactivated" 
    : "Working terms area inactivated";
  
  const notificationBody = role === 'rep'
    ? `A field rep removed coverage for ${areaDesc}. Reason: ${reason}. Please reassign any open work.`
    : `A vendor inactivated ${areaDesc}. Reason: ${reason}`;

  await supabase.from("notifications").insert({
    user_id: otherUserId,
    type: "working_terms_area_inactivated",
    title: notificationTitle,
    body: notificationBody,
    ref_id: rowId,
  });

  return { error: null };
}

/**
 * Propose a change to working terms (rate/turnaround)
 * Only one pending request per row per user allowed.
 */
export async function proposeWorkingTermsChange(
  rowId: string,
  requestedByUserId: string,
  requestedByRole: 'vendor' | 'rep',
  data: {
    newRate: number | null;
    newTurnaround: number | null;
    effectiveFrom: string;
    reason: string;
  }
): Promise<{ id: string | null; error: string | null }> {
  // Check for existing pending request by the same user on this row
  const { data: existingPending } = await supabase
    .from("working_terms_change_requests")
    .select("id")
    .eq("working_terms_row_id", rowId)
    .eq("requested_by_user_id", requestedByUserId)
    .eq("status", "pending")
    .limit(1)
    .maybeSingle();

  if (existingPending) {
    return { id: null, error: "You already have a pending change request for this term. Please wait for it to be reviewed." };
  }

  // Get current row values
  const { data: row, error: fetchError } = await supabase
    .from("working_terms_rows")
    .select("*, working_terms_requests!inner(vendor_id, rep_id)")
    .eq("id", rowId)
    .single();

  if (fetchError || !row) {
    return { id: null, error: "Row not found" };
  }

  // Validate actor is part of this agreement
  const isVendor = requestedByUserId === (row.working_terms_requests as any).vendor_id;
  const isRep = requestedByUserId === (row.working_terms_requests as any).rep_id;
  if (!isVendor && !isRep) {
    return { id: null, error: "You are not authorized to request changes to these terms." };
  }

  // Create change request
  const { data: changeRequest, error: insertError } = await supabase
    .from("working_terms_change_requests")
    .insert({
      working_terms_row_id: rowId,
      requested_by_role: requestedByRole,
      requested_by_user_id: requestedByUserId,
      old_rate: row.rate,
      new_rate: data.newRate,
      old_turnaround_days: row.turnaround_days,
      new_turnaround_days: data.newTurnaround,
      effective_from: data.effectiveFrom,
      reason: data.reason,
      status: "pending",
    })
    .select("id")
    .single();

  if (insertError) {
    return { id: null, error: insertError.message };
  }

  // Update row status to indicate pending change
  const newRowStatus = requestedByRole === 'rep' ? 'pending_change_rep' : 'pending_change_vendor';
  await supabase
    .from("working_terms_rows")
    .update({ status: newRowStatus })
    .eq("id", rowId);

  // Notify the other party
  const otherUserId = requestedByRole === 'rep' 
    ? (row.working_terms_requests as any).vendor_id 
    : (row.working_terms_requests as any).rep_id;

  const areaDesc = `${row.state_code}${row.county_name ? ` – ${row.county_name}` : ""} (${INSPECTION_TYPE_LABELS[row.inspection_type] || row.inspection_type})`;

  const rateChange = data.newRate !== row.rate 
    ? `Base rate from $${row.rate || 0} → $${data.newRate || 0}` 
    : null;

  await supabase.from("notifications").insert({
    user_id: otherUserId,
    type: "working_terms_change_proposed",
    title: "Working terms change proposed",
    body: `Proposed updated terms for ${areaDesc}: ${rateChange || "Turnaround change"}, effective ${data.effectiveFrom}. Reason: ${data.reason}`,
    ref_id: changeRequest.id,
  });

  return { id: changeRequest.id, error: null };
}

/**
 * Accept a working terms change request
 */
export async function acceptWorkingTermsChange(
  changeRequestId: string,
  respondedByUserId: string
): Promise<{ error: string | null }> {
  // Get the change request
  const { data: changeRequest, error: fetchError } = await supabase
    .from("working_terms_change_requests")
    .select("*, working_terms_rows!inner(*, working_terms_requests!inner(vendor_id, rep_id))")
    .eq("id", changeRequestId)
    .single();

  if (fetchError || !changeRequest) {
    return { error: "Change request not found" };
  }

  // Update the working terms row
  const { error: updateRowError } = await supabase
    .from("working_terms_rows")
    .update({
      rate: changeRequest.new_rate,
      turnaround_days: changeRequest.new_turnaround_days,
      effective_from: changeRequest.effective_from,
      status: "active",
    })
    .eq("id", changeRequest.working_terms_row_id);

  if (updateRowError) {
    return { error: updateRowError.message };
  }

  // Update the change request
  const { error: updateError } = await supabase
    .from("working_terms_change_requests")
    .update({
      status: "accepted",
      responded_by_user_id: respondedByUserId,
      responded_at: new Date().toISOString(),
    })
    .eq("id", changeRequestId);

  if (updateError) {
    return { error: updateError.message };
  }

  // Notify the requester
  const row = changeRequest.working_terms_rows as any;
  const areaDesc = `${row.state_code}${row.county_name ? ` – ${row.county_name}` : ""}`;

  await supabase.from("notifications").insert({
    user_id: changeRequest.requested_by_user_id,
    type: "working_terms_change_accepted",
    title: "Terms change accepted",
    body: `Your updated terms for ${areaDesc} were accepted, effective ${changeRequest.effective_from}.`,
    ref_id: changeRequestId,
  });

  return { error: null };
}

/**
 * Decline a working terms change request
 */
export async function declineWorkingTermsChange(
  changeRequestId: string,
  respondedByUserId: string,
  declineReason: string | null
): Promise<{ error: string | null }> {
  // Get the change request
  const { data: changeRequest, error: fetchError } = await supabase
    .from("working_terms_change_requests")
    .select("*, working_terms_rows!inner(*, working_terms_requests!inner(vendor_id, rep_id))")
    .eq("id", changeRequestId)
    .single();

  if (fetchError || !changeRequest) {
    return { error: "Change request not found" };
  }

  // Reset the working terms row status to active
  const { error: updateRowError } = await supabase
    .from("working_terms_rows")
    .update({ status: "active" })
    .eq("id", changeRequest.working_terms_row_id);

  if (updateRowError) {
    return { error: updateRowError.message };
  }

  // Update the change request
  const { error: updateError } = await supabase
    .from("working_terms_change_requests")
    .update({
      status: "declined",
      decline_reason: declineReason,
      responded_by_user_id: respondedByUserId,
      responded_at: new Date().toISOString(),
    })
    .eq("id", changeRequestId);

  if (updateError) {
    return { error: updateError.message };
  }

  // Notify the requester
  const row = changeRequest.working_terms_rows as any;
  const areaDesc = `${row.state_code}${row.county_name ? ` – ${row.county_name}` : ""}`;

  const body = declineReason 
    ? `Your requested change for ${areaDesc} was declined. Current terms remain: $${row.rate || 0}, ${row.turnaround_days || "N/A"} days. Note: ${declineReason}`
    : `Your requested change for ${areaDesc} was declined. Current terms remain unchanged.`;

  await supabase.from("notifications").insert({
    user_id: changeRequest.requested_by_user_id,
    type: "working_terms_change_declined",
    title: "Terms change declined",
    body,
    ref_id: changeRequestId,
  });

  return { error: null };
}

/**
 * Fetch pending change requests for a working terms row
 */
export async function fetchPendingChangeRequest(
  rowId: string
): Promise<WorkingTermsChangeRequest | null> {
  const { data, error } = await supabase
    .from("working_terms_change_requests")
    .select("*")
    .eq("working_terms_row_id", rowId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Error fetching pending change request:", error);
    return null;
  }

  return data as WorkingTermsChangeRequest | null;
}

/**
 * Fetch all pending change requests for a vendor-rep pair where the vendor needs to respond
 * (i.e., changes initiated by the rep)
 */
export async function fetchPendingChangeRequestsForVendor(
  vendorId: string,
  repId: string
): Promise<WorkingTermsChangeRequest[]> {
  // First get active working terms request for this pair
  const { data: request } = await supabase
    .from("working_terms_requests")
    .select("id")
    .eq("vendor_id", vendorId)
    .eq("rep_id", repId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!request) {
    return [];
  }

  // Get all pending change requests from rep for rows in this request
  const { data: changes, error } = await supabase
    .from("working_terms_change_requests")
    .select("*, working_terms_rows!inner(working_terms_request_id)")
    .eq("working_terms_rows.working_terms_request_id", request.id)
    .eq("status", "pending")
    .eq("requested_by_role", "rep");

  if (error) {
    console.error("Error fetching pending change requests for vendor:", error);
    return [];
  }

  return (changes || []) as WorkingTermsChangeRequest[];
}

/**
 * Fetch all pending change requests for all rows in a working terms request
 */
export async function fetchAllPendingChangesForRequest(
  requestId: string
): Promise<Map<string, WorkingTermsChangeRequest>> {
  const { data: rows } = await supabase
    .from("working_terms_rows")
    .select("id")
    .eq("working_terms_request_id", requestId);

  if (!rows || rows.length === 0) {
    return new Map();
  }

  const rowIds = rows.map(r => r.id);
  
  const { data: changes, error } = await supabase
    .from("working_terms_change_requests")
    .select("*")
    .in("working_terms_row_id", rowIds)
    .eq("status", "pending");

  if (error) {
    console.error("Error fetching pending changes:", error);
    return new Map();
  }

  const map = new Map<string, WorkingTermsChangeRequest>();
  for (const change of changes || []) {
    map.set(change.working_terms_row_id, change as WorkingTermsChangeRequest);
  }
  
  return map;
}
