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
  internal_note: string | null;
  approved_rate: number | null;
  created_at: string;
  updated_at: string;
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

// ============== COVERAGE AUTO-FILL ==============

interface VendorCoverageArea {
  state_code: string;
  state_name: string;
}

export async function fetchVendorCoverageForAutoFill(vendorUserId: string): Promise<VendorCoverageArea[]> {
  const { data, error } = await supabase
    .from("vendor_coverage_areas" as any)
    .select("state_code, state_name")
    .eq("vendor_user_id", vendorUserId) as { data: { state_code: string; state_name: string }[] | null; error: any };

  if (error) throw error;

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
): Promise<number> {
  const coverage = await fetchVendorCoverageForAutoFill(vendorUserId);
  let insertedCount = 0;

  for (const area of coverage) {
    for (const orderType of ORDER_TYPES) {
      try {
        const regionKey = generateRegionKey(true, null, null);
        const { error } = await supabase
          .from("vendor_client_proposal_lines")
          .upsert({
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
          } as any, {
            onConflict: "proposal_id,state_code,order_type,region_key",
          });
        if (!error) insertedCount++;
      } catch (err) {
        console.warn("Skipped duplicate line:", err);
      }
    }
  }

  return insertedCount;
}
