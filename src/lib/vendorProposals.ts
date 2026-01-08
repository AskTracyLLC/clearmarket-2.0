/**
 * Vendor Client Proposals - Data Access Layer
 * PRIVATE: Not visible to Field Reps
 */

import { supabase } from "@/integrations/supabase/client";

export interface VendorProposal {
  id: string;
  vendor_user_id: string;
  name: string;
  client_name: string | null;
  disclaimer: string | null;
  status: "draft" | "active" | "archived";
  effective_as_of: string | null;
  client_rep_name: string | null;
  client_rep_email: string | null;
  is_template: boolean;
  created_at: string;
  updated_at: string;
}

export interface VendorProposalLine {
  id: string;
  proposal_id: string;
  state_code: string;
  state_name: string;
  county_id: string | null;
  county_name: string | null;
  is_all_counties: boolean;
  region_key: string;
  order_type: "standard" | "appointment" | "rush";
  proposed_rate: number;
  internal_rep_rate: number | null;
  internal_rep_rate_baseline: number | null;
  internal_rep_source_rep_id: string | null;
  internal_note: string | null;
  approved_rate: number | null;
  created_at: string;
  updated_at: string;
}

export type CompareMode = "lowest" | "average" | "specific";

export interface RepRateSnapshot {
  id: string;
  proposal_id: string;
  rep_user_id: string;
  state_code: string;
  county_id: string | null;
  region_key: string;
  order_type: OrderType;
  rep_rate: number;
  created_at: string;
}

export type OrderType = "standard" | "appointment" | "rush";

export const ORDER_TYPE_LABELS: Record<OrderType, string> = {
  standard: "Standard Property Inspection",
  appointment: "Appointment-Based (Loss/Insurance Claim)",
  rush: "Rush (deadline < 3 days)",
};

export const ORDER_TYPES: OrderType[] = ["standard", "appointment", "rush"];

// ============== PROPOSALS ==============

export async function fetchVendorProposals(vendorUserId: string): Promise<VendorProposal[]> {
  const { data, error } = await supabase
    .from("vendor_client_proposals")
    .select("*")
    .eq("vendor_user_id", vendorUserId)
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return (data || []) as VendorProposal[];
}

export async function fetchProposalById(proposalId: string): Promise<VendorProposal | null> {
  const { data, error } = await supabase
    .from("vendor_client_proposals")
    .select("*")
    .eq("id", proposalId)
    .maybeSingle();

  if (error) throw error;
  return data as VendorProposal | null;
}

export async function createProposal(
  vendorUserId: string,
  name: string,
  isTemplate = false
): Promise<VendorProposal> {
  const { data, error } = await supabase
    .from("vendor_client_proposals")
    .insert({
      vendor_user_id: vendorUserId,
      name,
      is_template: isTemplate,
      status: "draft",
    })
    .select()
    .single();

  if (error) throw error;
  return data as VendorProposal;
}

export async function updateProposal(
  proposalId: string,
  updates: Partial<Omit<VendorProposal, "id" | "vendor_user_id" | "created_at" | "updated_at">>
): Promise<VendorProposal> {
  const { data, error } = await supabase
    .from("vendor_client_proposals")
    .update(updates)
    .eq("id", proposalId)
    .select()
    .single();

  if (error) throw error;
  return data as VendorProposal;
}

export async function deleteProposal(proposalId: string): Promise<void> {
  const { error } = await supabase
    .from("vendor_client_proposals")
    .delete()
    .eq("id", proposalId);

  if (error) throw error;
}

export async function duplicateProposalAsTemplate(proposalId: string): Promise<VendorProposal> {
  // Fetch original proposal + lines
  const proposal = await fetchProposalById(proposalId);
  if (!proposal) throw new Error("Proposal not found");

  const lines = await fetchProposalLines(proposalId);

  // Create new proposal as template
  const newProposal = await createProposal(
    proposal.vendor_user_id,
    `${proposal.name} (Template)`,
    true
  );

  // Copy lines
  if (lines.length > 0) {
    const newLines = lines.map((line) => ({
      proposal_id: newProposal.id,
      state_code: line.state_code,
      state_name: line.state_name,
      county_id: line.county_id,
      county_name: line.county_name,
      is_all_counties: line.is_all_counties,
      region_key: line.region_key,
      order_type: line.order_type,
      proposed_rate: line.proposed_rate,
      internal_rep_rate: line.internal_rep_rate,
      internal_note: line.internal_note,
      approved_rate: null, // Reset approved rate for template
    }));

    const { error } = await supabase.from("vendor_client_proposal_lines").insert(newLines);
    if (error) throw error;
  }

  return newProposal;
}

export async function createProposalFromTemplate(templateId: string): Promise<VendorProposal> {
  const template = await fetchProposalById(templateId);
  if (!template) throw new Error("Template not found");

  const lines = await fetchProposalLines(templateId);

  // Create new proposal from template
  const { data: newProposal, error } = await supabase
    .from("vendor_client_proposals")
    .insert({
      vendor_user_id: template.vendor_user_id,
      name: template.name.replace(" (Template)", ""),
      disclaimer: template.disclaimer,
      is_template: false,
      status: "draft",
    })
    .select()
    .single();

  if (error) throw error;

  // Copy lines
  if (lines.length > 0) {
    const newLines = lines.map((line) => ({
      proposal_id: newProposal.id,
      state_code: line.state_code,
      state_name: line.state_name,
      county_id: line.county_id,
      county_name: line.county_name,
      is_all_counties: line.is_all_counties,
      region_key: line.region_key,
      order_type: line.order_type,
      proposed_rate: line.proposed_rate,
      internal_rep_rate: line.internal_rep_rate,
      internal_note: line.internal_note,
      approved_rate: null,
    }));

    const { error: linesError } = await supabase.from("vendor_client_proposal_lines").insert(newLines);
    if (linesError) throw linesError;
  }

  return newProposal as VendorProposal;
}

export interface DuplicateProposalOptions {
  newName: string;
  clientName?: string;
  keepAsTemplate: boolean;
}

export async function duplicateProposal(
  proposalId: string,
  options: DuplicateProposalOptions
): Promise<VendorProposal> {
  const original = await fetchProposalById(proposalId);
  if (!original) throw new Error("Proposal not found");

  const lines = await fetchProposalLines(proposalId);

  // Create new proposal
  const { data: newProposal, error } = await supabase
    .from("vendor_client_proposals")
    .insert({
      vendor_user_id: original.vendor_user_id,
      name: options.newName,
      client_name: options.clientName || null,
      disclaimer: original.disclaimer,
      is_template: options.keepAsTemplate,
      status: "draft",
      effective_as_of: null,
    })
    .select()
    .single();

  if (error) throw error;

  // Copy lines
  if (lines.length > 0) {
    const newLines = lines.map((line) => ({
      proposal_id: newProposal.id,
      state_code: line.state_code,
      state_name: line.state_name,
      county_id: line.county_id,
      county_name: line.county_name,
      is_all_counties: line.is_all_counties,
      region_key: line.region_key,
      order_type: line.order_type,
      proposed_rate: line.proposed_rate,
      internal_rep_rate: line.internal_rep_rate,
      internal_rep_rate_baseline: line.internal_rep_rate_baseline,
      internal_rep_source_rep_id: line.internal_rep_source_rep_id,
      internal_note: line.internal_note,
      approved_rate: null, // Reset approved rate
    }));

    const { error: linesError } = await supabase.from("vendor_client_proposal_lines").insert(newLines);
    if (linesError) throw linesError;
  }

  return newProposal as VendorProposal;
}

// ============== PROPOSAL LINES ==============

export async function fetchProposalLines(proposalId: string): Promise<VendorProposalLine[]> {
  const { data, error } = await supabase
    .from("vendor_client_proposal_lines")
    .select("*")
    .eq("proposal_id", proposalId)
    .order("state_code")
    .order("county_name", { nullsFirst: true })
    .order("order_type");

  if (error) throw error;
  return (data || []) as VendorProposalLine[];
}

/**
 * Generate region_key for proposal lines
 * - '__ALL__' for all-counties rows
 * - county_id (or county_name as fallback) for specific county overrides
 */
export function generateRegionKey(isAllCounties: boolean, countyId: string | null, countyName: string | null): string {
  if (isAllCounties) return '__ALL__';
  return countyId || countyName || '__UNKNOWN__';
}

export async function upsertProposalLine(
  line: Omit<VendorProposalLine, "id" | "created_at" | "updated_at">
): Promise<VendorProposalLine> {
  // Ensure region_key is set
  const lineWithRegionKey = {
    ...line,
    region_key: line.region_key || generateRegionKey(line.is_all_counties, line.county_id, line.county_name),
  };

  // Use upsert with the unified unique index
  const { data, error } = await supabase
    .from("vendor_client_proposal_lines")
    .upsert(lineWithRegionKey as any, {
      onConflict: "proposal_id,state_code,order_type,region_key",
    })
    .select()
    .single();

  if (error) throw error;
  return data as VendorProposalLine;
}

export async function updateProposalLine(
  lineId: string,
  updates: Partial<Omit<VendorProposalLine, "id" | "proposal_id" | "created_at" | "updated_at">>
): Promise<VendorProposalLine> {
  const { data, error } = await supabase
    .from("vendor_client_proposal_lines")
    .update(updates)
    .eq("id", lineId)
    .select()
    .single();

  if (error) throw error;
  return data as VendorProposalLine;
}

export async function deleteProposalLine(lineId: string): Promise<void> {
  const { error } = await supabase
    .from("vendor_client_proposal_lines")
    .delete()
    .eq("id", lineId);

  if (error) throw error;
}

export async function deleteProposalLines(lineIds: string[]): Promise<void> {
  const { error } = await supabase
    .from("vendor_client_proposal_lines")
    .delete()
    .in("id", lineIds);

  if (error) throw error;
}

export async function batchUpdateProposedRate(
  lineIds: string[],
  proposedRate: number
): Promise<void> {
  const { error } = await supabase
    .from("vendor_client_proposal_lines")
    .update({ proposed_rate: proposedRate })
    .in("id", lineIds);

  if (error) throw error;
}

// ============== REP PRICING REFERENCE ==============

/**
 * Map proposal order_type to working_terms inspection_type
 */
export function mapOrderTypeToInspectionType(orderType: OrderType): string[] {
  switch (orderType) {
    case "standard":
      return ["property", "general"]; // property first, general as fallback
    case "appointment":
      return ["loss_claims"];
    case "rush":
      return ["property", "general"]; // Same as standard, with rush warning
    default:
      return ["general"];
  }
}

/**
 * Fetch connected reps for vendor (for rep pricing reference dropdown)
 */
export async function fetchConnectedReps(vendorUserId: string): Promise<{ id: string; name: string }[]> {
  const { data, error } = await supabase
    .from("vendor_connections")
    .select(`
      field_rep_id,
      profiles!vendor_connections_field_rep_id_fkey(id, full_name)
    `)
    .eq("vendor_id", vendorUserId)
    .eq("status", "connected");

  if (error) {
    console.error("[RepPricing] Failed to fetch connected reps:", error);
    throw error;
  }

  return (data || [])
    .map((conn: any) => ({
      id: conn.field_rep_id,
      name: conn.profiles?.full_name || "Unknown Rep",
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export interface RepPricingRow {
  stateCode: string;
  countyName: string | null;
  inspectionType: string;
  rate: number | null;
}

/**
 * Fetch rep's working terms for pricing reference
 */
export async function fetchRepPricing(vendorUserId: string, repUserId: string): Promise<RepPricingRow[]> {
  const { data, error } = await supabase
    .from("working_terms_rows")
    .select("state_code, county_name, inspection_type, rate")
    .eq("vendor_id", vendorUserId)
    .eq("rep_id", repUserId)
    .eq("status", "active")
    .eq("included", true);

  if (error) {
    console.error("[RepPricing] Failed to fetch rep pricing:", error);
    throw error;
  }

  return (data || []).map((row: any) => ({
    stateCode: row.state_code,
    countyName: row.county_name,
    inspectionType: row.inspection_type,
    rate: row.rate,
  }));
}

/**
 * Find rep cost for a proposal line based on working terms
 */
export function findRepCostForLine(
  line: { state_code: string; county_name: string | null; is_all_counties: boolean; order_type: OrderType },
  repPricing: RepPricingRow[]
): { rate: number | null; warning?: string } {
  const inspectionTypes = mapOrderTypeToInspectionType(line.order_type);
  const countyName = line.is_all_counties ? null : line.county_name;

  for (const inspType of inspectionTypes) {
    // Try exact county match first
    if (countyName) {
      const countyMatch = repPricing.find(
        (p) =>
          p.stateCode === line.state_code &&
          p.countyName?.toLowerCase() === countyName.toLowerCase() &&
          p.inspectionType === inspType
      );
      if (countyMatch?.rate != null) {
        return { rate: countyMatch.rate };
      }
    }

    // Fallback to state-level (county_name is null)
    const stateMatch = repPricing.find(
      (p) =>
        p.stateCode === line.state_code &&
        !p.countyName &&
        p.inspectionType === inspType
    );
    if (stateMatch?.rate != null) {
      if (line.order_type === "rush") {
        return { rate: stateMatch.rate, warning: "No rush term; using standard rate" };
      }
      return { rate: stateMatch.rate };
    }
  }

  return { rate: null, warning: "No rep terms found" };
}

/**
 * Sync rep costs to proposal lines
 */
export async function syncRepCostsToProposal(
  proposalId: string,
  vendorUserId: string,
  repUserId: string
): Promise<{ updatedCount: number; errors: string[] }> {
  // Fetch rep pricing
  const repPricing = await fetchRepPricing(vendorUserId, repUserId);

  if (repPricing.length === 0) {
    return { updatedCount: 0, errors: ["No active rep terms found"] };
  }

  // Fetch proposal lines
  const lines = await fetchProposalLines(proposalId);

  let updatedCount = 0;
  const errors: string[] = [];

  for (const line of lines) {
    // Skip if manually overridden (has internal_note with "manual")
    if (line.internal_note?.toLowerCase().includes("manual")) {
      continue;
    }

    const { rate } = findRepCostForLine(line, repPricing);

    if (rate !== null && rate !== line.internal_rep_rate) {
      try {
        await updateProposalLine(line.id, { internal_rep_rate: rate });
        updatedCount++;
      } catch (err: any) {
        errors.push(`${line.state_code}/${line.county_name || "All"}: ${err.message}`);
      }
    }
  }

  return { updatedCount, errors };
}

// ============== MULTI-REP PRICING SYNC ==============

export interface MultiRepSyncResult {
  repsProcessed: number;
  snapshotsCreated: number;
  linesUpdated: number;
  warningsCount: number;
  errors: string[];
}

/**
 * Clear existing snapshots for a proposal
 */
async function clearProposalSnapshots(proposalId: string): Promise<void> {
  const { error } = await supabase
    .from("vendor_proposal_rep_rate_snapshots" as any)
    .delete()
    .eq("proposal_id", proposalId);
    
  if (error) {
    console.error("[MultiRepSync] Failed to clear snapshots:", error);
    throw error;
  }
}

/**
 * Fetch working terms for all connected reps
 */
async function fetchAllRepsPricing(vendorUserId: string): Promise<Map<string, RepPricingRow[]>> {
  // First get all connected reps
  const reps = await fetchConnectedReps(vendorUserId);
  const repPricingMap = new Map<string, RepPricingRow[]>();
  
  for (const rep of reps) {
    try {
      const pricing = await fetchRepPricing(vendorUserId, rep.id);
      if (pricing.length > 0) {
        repPricingMap.set(rep.id, pricing);
      }
    } catch (err) {
      console.warn(`[MultiRepSync] Failed to fetch pricing for rep ${rep.id}:`, err);
    }
  }
  
  return repPricingMap;
}

/**
 * Create snapshot rows for all reps and their pricing
 */
async function createRepSnapshots(
  proposalId: string,
  lines: VendorProposalLine[],
  repPricingMap: Map<string, RepPricingRow[]>
): Promise<number> {
  let created = 0;
  const snapshots: any[] = [];
  
  for (const [repId, pricingRows] of repPricingMap) {
    for (const line of lines) {
      const { rate } = findRepCostForLine(
        {
          state_code: line.state_code,
          county_name: line.county_name,
          is_all_counties: line.is_all_counties,
          order_type: line.order_type as OrderType,
        },
        pricingRows
      );
      
      if (rate !== null) {
        snapshots.push({
          proposal_id: proposalId,
          rep_user_id: repId,
          state_code: line.state_code,
          county_id: line.county_id,
          region_key: line.region_key,
          order_type: line.order_type,
          rep_rate: rate,
        });
      }
    }
  }
  
  if (snapshots.length > 0) {
    // Insert in batches of 100
    for (let i = 0; i < snapshots.length; i += 100) {
      const batch = snapshots.slice(i, i + 100);
      const { error } = await supabase
        .from("vendor_proposal_rep_rate_snapshots" as any)
        .upsert(batch, { onConflict: "proposal_id,rep_user_id,state_code,region_key,order_type" });
        
      if (error) {
        console.error("[MultiRepSync] Snapshot insert error:", error);
        throw error;
      }
      created += batch.length;
    }
  }
  
  return created;
}

/**
 * Compute baseline rep cost based on compare mode
 */
function computeBaseline(
  line: VendorProposalLine,
  repPricingMap: Map<string, RepPricingRow[]>,
  mode: CompareMode,
  specificRepId?: string
): { baseline: number | null; sourceRepId: string | null } {
  if (mode === "specific" && specificRepId) {
    const pricing = repPricingMap.get(specificRepId);
    if (!pricing) return { baseline: null, sourceRepId: null };
    
    const { rate } = findRepCostForLine(
      {
        state_code: line.state_code,
        county_name: line.county_name,
        is_all_counties: line.is_all_counties,
        order_type: line.order_type as OrderType,
      },
      pricing
    );
    return { baseline: rate, sourceRepId: rate !== null ? specificRepId : null };
  }
  
  // Compute rates for all reps
  const rates: { rate: number; repId: string }[] = [];
  
  for (const [repId, pricingRows] of repPricingMap) {
    const { rate } = findRepCostForLine(
      {
        state_code: line.state_code,
        county_name: line.county_name,
        is_all_counties: line.is_all_counties,
        order_type: line.order_type as OrderType,
      },
      pricingRows
    );
    if (rate !== null) {
      rates.push({ rate, repId });
    }
  }
  
  if (rates.length === 0) return { baseline: null, sourceRepId: null };
  
  if (mode === "lowest") {
    const min = rates.reduce((a, b) => (a.rate < b.rate ? a : b));
    return { baseline: min.rate, sourceRepId: min.repId };
  }
  
  if (mode === "average") {
    const avg = rates.reduce((sum, r) => sum + r.rate, 0) / rates.length;
    return { baseline: Math.round(avg * 100) / 100, sourceRepId: null };
  }
  
  return { baseline: null, sourceRepId: null };
}

/**
 * Sync rep costs for all connected reps to a proposal
 */
export async function syncAllRepCostsToProposal(
  proposalId: string,
  vendorUserId: string,
  mode: CompareMode,
  specificRepId?: string
): Promise<MultiRepSyncResult> {
  console.log("[MultiRepSync] Starting sync:", { proposalId, vendorUserId, mode, specificRepId });
  
  const result: MultiRepSyncResult = {
    repsProcessed: 0,
    snapshotsCreated: 0,
    linesUpdated: 0,
    warningsCount: 0,
    errors: [],
  };
  
  try {
    // Clear old snapshots
    await clearProposalSnapshots(proposalId);
    
    // Fetch pricing for all connected reps
    const repPricingMap = await fetchAllRepsPricing(vendorUserId);
    result.repsProcessed = repPricingMap.size;
    
    if (repPricingMap.size === 0) {
      result.errors.push("No connected reps with active pricing found");
      return result;
    }
    
    // Fetch proposal lines
    const lines = await fetchProposalLines(proposalId);
    
    if (lines.length === 0) {
      result.errors.push("No proposal lines to update");
      return result;
    }
    
    // Create snapshots
    result.snapshotsCreated = await createRepSnapshots(proposalId, lines, repPricingMap);
    
    // Update each line with baseline
    for (const line of lines) {
      // Skip if manually overridden
      if (line.internal_note?.toLowerCase().includes("manual")) {
        continue;
      }
      
      const { baseline, sourceRepId } = computeBaseline(line, repPricingMap, mode, specificRepId);
      
      // Track warnings
      if (baseline !== null && line.proposed_rate < baseline) {
        result.warningsCount++;
      }
      
      // Update line if baseline changed
      if (baseline !== line.internal_rep_rate_baseline || sourceRepId !== line.internal_rep_source_rep_id) {
        try {
          const { error } = await supabase
            .from("vendor_client_proposal_lines")
            .update({
              internal_rep_rate_baseline: baseline,
              internal_rep_source_rep_id: sourceRepId,
            })
            .eq("id", line.id);
            
          if (error) {
            result.errors.push(`Line ${line.state_code}/${line.county_name || "All"}: ${error.message}`);
          } else {
            result.linesUpdated++;
          }
        } catch (err: any) {
          result.errors.push(`Line ${line.state_code}/${line.county_name || "All"}: ${err.message}`);
        }
      }
    }
    
    console.log("[MultiRepSync] Complete:", result);
    return result;
    
  } catch (err: any) {
    console.error("[MultiRepSync] Failed:", err);
    result.errors.push(err.message || String(err));
    return result;
  }
}

interface VendorCoverageArea {
  state_code: string;
  state_name: string;
}

export interface AutoFillDebugInfo {
  step: "fetch_coverage" | "insert_lines";
  userId: string;
  proposalId: string;
  error: string;
  details?: string;
  rowCount?: number;
}

export async function fetchVendorCoverageForAutoFill(vendorUserId: string): Promise<VendorCoverageArea[]> {
  // Use the correct column: user_id (not vendor_user_id)
  const { data, error } = await supabase
    .from("vendor_coverage_areas" as any)
    .select("state_code, state_name")
    .eq("user_id", vendorUserId) as { data: { state_code: string; state_name: string }[] | null; error: any };

  if (error) {
    console.error("[AutoFill] fetchVendorCoverageForAutoFill failed:", {
      userId: vendorUserId,
      error,
    });
    throw error;
  }

  console.log("[AutoFill] Coverage fetched:", {
    userId: vendorUserId,
    rowCount: data?.length || 0,
  });

  // Deduplicate by state
  const stateMap = new Map<string, VendorCoverageArea>();
  (data || []).forEach((row) => {
    if (!stateMap.has(row.state_code)) {
      stateMap.set(row.state_code, {
        state_code: row.state_code,
        state_name: row.state_name,
      });
    }
  });

  return Array.from(stateMap.values());
}

export async function autoFillFromCoverage(
  proposalId: string,
  vendorUserId: string
): Promise<{ insertedCount: number; debugInfo?: AutoFillDebugInfo }> {
  console.log("[AutoFill] Starting auto-fill:", { proposalId, vendorUserId });

  let coverage: VendorCoverageArea[];
  try {
    coverage = await fetchVendorCoverageForAutoFill(vendorUserId);
  } catch (err: any) {
    const debugInfo: AutoFillDebugInfo = {
      step: "fetch_coverage",
      userId: vendorUserId,
      proposalId,
      error: err?.message || String(err),
      details: JSON.stringify(err, null, 2),
    };
    console.error("[AutoFill] Fetch coverage failed:", debugInfo);
    return { insertedCount: 0, debugInfo };
  }

  if (coverage.length === 0) {
    console.warn("[AutoFill] No coverage areas found for user:", vendorUserId);
    return { insertedCount: 0 };
  }

  let insertedCount = 0;
  const insertErrors: string[] = [];

  for (const area of coverage) {
    for (const orderType of ORDER_TYPES) {
      try {
        const regionKey = generateRegionKey(true, null, null);
        const payload = {
          proposal_id: proposalId,
          state_code: area.state_code,
          state_name: area.state_name,
          county_id: null,
          county_name: null,
          is_all_counties: true,
          region_key: regionKey,
          order_type: orderType,
          proposed_rate: 0,
          internal_rep_rate: null,
          internal_note: null,
          approved_rate: null,
        };

        const { error } = await supabase
          .from("vendor_client_proposal_lines")
          .upsert(payload as any, {
            onConflict: "proposal_id,state_code,order_type,region_key",
          });

        if (error) {
          console.error("[AutoFill] Insert line failed:", {
            proposalId,
            stateCode: area.state_code,
            orderType,
            error,
          });
          insertErrors.push(`${area.state_code}/${orderType}: ${error.message}`);
        } else {
          insertedCount++;
        }
      } catch (err: any) {
        console.error("[AutoFill] Unexpected insert error:", err);
        insertErrors.push(`${area.state_code}/${orderType}: ${err?.message || String(err)}`);
      }
    }
  }

  console.log("[AutoFill] Complete:", {
    proposalId,
    vendorUserId,
    coverageStates: coverage.length,
    insertedCount,
    errorCount: insertErrors.length,
  });

  if (insertErrors.length > 0) {
    return {
      insertedCount,
      debugInfo: {
        step: "insert_lines",
        userId: vendorUserId,
        proposalId,
        error: `${insertErrors.length} line(s) failed to insert`,
        details: insertErrors.join("\n"),
        rowCount: insertedCount,
      },
    };
  }

  return { insertedCount };
}

// ============== AUTO-PRICE ==============

export type CostBasis = "highest" | "average" | "lowest";
export type MarkupType = "dollar" | "percent";

export interface AutoPricePreviewLine {
  lineId: string;
  stateCode: string;
  countyName: string | null;
  orderType: OrderType;
  repCost: number;
  oldRate: number | null;
  newRate: number;
}

export interface AutoPricePreviewResult {
  updateCount: number;
  skipCount: number;
  skipReasons: { noRepCost: number; hasExistingRate: number };
  previewLines: AutoPricePreviewLine[];
}

export interface AutoPriceApplyResult {
  updatedCount: number;
  skippedCount: number;
  errors: string[];
}

/**
 * Fetch rep rate snapshots for a proposal
 */
async function fetchRepRateSnapshots(proposalId: string): Promise<Map<string, number[]>> {
  const { data, error } = await supabase
    .from("vendor_proposal_rep_rate_snapshots" as any)
    .select("state_code, region_key, order_type, rep_rate")
    .eq("proposal_id", proposalId) as { 
      data: { state_code: string; region_key: string; order_type: string; rep_rate: number }[] | null; 
      error: any 
    };
    
  if (error) {
    console.error("[AutoPrice] Failed to fetch snapshots:", error);
    throw error;
  }
  
  // Group by line key: state_code|region_key|order_type
  const snapshotMap = new Map<string, number[]>();
  
  for (const row of data || []) {
    const key = `${row.state_code}|${row.region_key}|${row.order_type}`;
    if (!snapshotMap.has(key)) {
      snapshotMap.set(key, []);
    }
    snapshotMap.get(key)!.push(row.rep_rate);
  }
  
  return snapshotMap;
}

/**
 * Compute rep cost based on cost basis
 */
function computeRepCost(rates: number[], costBasis: CostBasis): number {
  if (rates.length === 0) return 0;
  
  switch (costBasis) {
    case "highest":
      return Math.max(...rates);
    case "lowest":
      return Math.min(...rates);
    case "average":
      return Math.round((rates.reduce((a, b) => a + b, 0) / rates.length) * 100) / 100;
  }
}

/**
 * Compute new proposed rate with markup
 */
function computeMarkupRate(repCost: number, markupType: MarkupType, markupValue: number): number {
  if (markupType === "dollar") {
    return Math.round((repCost + markupValue) * 100) / 100;
  } else {
    return Math.round((repCost * (1 + markupValue / 100)) * 100) / 100;
  }
}

/**
 * Preview auto-price changes
 */
export async function previewAutoPrice(
  proposalId: string,
  targetLineIds: string[],
  costBasis: CostBasis,
  markupType: MarkupType,
  markupValue: number,
  overwriteExisting: boolean
): Promise<AutoPricePreviewResult> {
  console.log("[AutoPrice] Preview:", { proposalId, targetLineIds: targetLineIds.length, costBasis, markupType, markupValue, overwriteExisting });
  
  // Fetch snapshots
  const snapshotMap = await fetchRepRateSnapshots(proposalId);
  
  // Fetch proposal lines
  const lines = await fetchProposalLines(proposalId);
  
  // Filter to target lines
  const targetLines = targetLineIds.length > 0 
    ? lines.filter(l => targetLineIds.includes(l.id))
    : lines;
  
  const result: AutoPricePreviewResult = {
    updateCount: 0,
    skipCount: 0,
    skipReasons: { noRepCost: 0, hasExistingRate: 0 },
    previewLines: [],
  };
  
  for (const line of targetLines) {
    const key = `${line.state_code}|${line.region_key}|${line.order_type}`;
    const rates = snapshotMap.get(key);
    
    // Skip if no rep cost
    if (!rates || rates.length === 0) {
      result.skipCount++;
      result.skipReasons.noRepCost++;
      continue;
    }
    
    // Skip if has existing rate and overwrite is off
    if (!overwriteExisting && line.proposed_rate != null && line.proposed_rate > 0) {
      result.skipCount++;
      result.skipReasons.hasExistingRate++;
      continue;
    }
    
    const repCost = computeRepCost(rates, costBasis);
    const newRate = computeMarkupRate(repCost, markupType, markupValue);
    
    result.updateCount++;
    
    // Add to preview (limit to first 10)
    if (result.previewLines.length < 10) {
      result.previewLines.push({
        lineId: line.id,
        stateCode: line.state_code,
        countyName: line.is_all_counties ? "All counties" : line.county_name,
        orderType: line.order_type as OrderType,
        repCost,
        oldRate: line.proposed_rate,
        newRate,
      });
    }
  }
  
  console.log("[AutoPrice] Preview result:", result);
  return result;
}

/**
 * Apply auto-price changes
 */
export async function applyAutoPrice(
  proposalId: string,
  targetLineIds: string[],
  costBasis: CostBasis,
  markupType: MarkupType,
  markupValue: number,
  overwriteExisting: boolean
): Promise<AutoPriceApplyResult> {
  console.log("[AutoPrice] Apply:", { proposalId, targetLineIds: targetLineIds.length, costBasis, markupType, markupValue, overwriteExisting });
  
  // Fetch snapshots
  const snapshotMap = await fetchRepRateSnapshots(proposalId);
  
  // Fetch proposal lines
  const lines = await fetchProposalLines(proposalId);
  
  // Filter to target lines
  const targetLines = targetLineIds.length > 0 
    ? lines.filter(l => targetLineIds.includes(l.id))
    : lines;
  
  const result: AutoPriceApplyResult = {
    updatedCount: 0,
    skippedCount: 0,
    errors: [],
  };
  
  // Build updates batch
  const updates: { id: string; proposed_rate: number }[] = [];
  
  for (const line of targetLines) {
    const key = `${line.state_code}|${line.region_key}|${line.order_type}`;
    const rates = snapshotMap.get(key);
    
    // Skip if no rep cost
    if (!rates || rates.length === 0) {
      result.skippedCount++;
      continue;
    }
    
    // Skip if has existing rate and overwrite is off
    if (!overwriteExisting && line.proposed_rate != null && line.proposed_rate > 0) {
      result.skippedCount++;
      continue;
    }
    
    const repCost = computeRepCost(rates, costBasis);
    const newRate = computeMarkupRate(repCost, markupType, markupValue);
    
    updates.push({ id: line.id, proposed_rate: newRate });
  }
  
  // Apply updates in batches
  const BATCH_SIZE = 50;
  for (let i = 0; i < updates.length; i += BATCH_SIZE) {
    const batch = updates.slice(i, i + BATCH_SIZE);
    
    // Update each line in the batch
    for (const update of batch) {
      const { error } = await supabase
        .from("vendor_client_proposal_lines")
        .update({ proposed_rate: update.proposed_rate })
        .eq("id", update.id);
        
      if (error) {
        result.errors.push(`Line ${update.id}: ${error.message}`);
      } else {
        result.updatedCount++;
      }
    }
  }
  
  console.log("[AutoPrice] Apply result:", result);
  return result;
}
