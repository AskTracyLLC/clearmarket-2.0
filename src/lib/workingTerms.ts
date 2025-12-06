import { supabase } from "@/integrations/supabase/client";
import { createNotification } from "./notifications";

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
  await createNotification({
    userId: repId,
    type: "working_terms_request",
    title: "Coverage & pricing request",
    body: `A vendor requested your coverage & pricing for ${requestedStates.join(", ")}.`,
    refId: data.id,
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
  await createNotification({
    userId: request.vendor_id,
    type: "working_terms_declined",
    title: "Coverage request declined",
    body: reason ? `Your request was declined: "${reason}"` : "Your coverage request was declined.",
    refId: requestId,
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
  await createNotification({
    userId: request.vendor_id,
    type: "working_terms_submitted",
    title: "Coverage & pricing received",
    body: `Coverage details were shared for ${request.requested_states.join(", ")}.`,
    refId: requestId,
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
    source: 'from_profile' | 'added_by_vendor';
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
  await createNotification({
    userId: request.rep_id,
    type: confirm ? "working_terms_confirmed" : "working_terms_updated",
    title: confirm ? "Working terms confirmed" : "Working terms updated",
    body: confirm
      ? "Your working terms have been confirmed."
      : "The vendor made changes to your working terms. Please review.",
    refId: requestId,
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
  await createNotification({
    userId: request.vendor_id,
    type: "working_terms_confirmed",
    title: "Working terms confirmed",
    body: "Your working terms have been confirmed by the field rep.",
    refId: requestId,
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
