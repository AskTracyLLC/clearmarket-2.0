import { supabase } from "@/integrations/supabase/client";

export interface ConnectionAgreementArea {
  id: string;
  connection_id: string;
  state_code: string;
  county_name: string | null;
  zip_code: string | null;
  inspection_type_id: string | null;
  inspection_category: string | null;
  base_rate: number | null;
  rush_rate: number | null;
  effective_start: string;
  effective_end: string | null;
  status: "active" | "expired" | "inactive";
  created_at: string;
  updated_at: string;
  // Joined fields
  inspection_type_label?: string;
}

export interface AgreementAreaWithType extends ConnectionAgreementArea {
  inspection_type_label?: string;
}

/**
 * Fetch all agreement areas for a specific vendor-rep connection
 */
export async function fetchConnectionAgreementAreas(
  connectionId: string
): Promise<AgreementAreaWithType[]> {
  const { data, error } = await supabase
    .from("connection_agreement_areas")
    .select(`
      *,
      inspection_type_options:inspection_type_id (
        label
      )
    `)
    .eq("connection_id", connectionId)
    .order("state_code", { ascending: true })
    .order("county_name", { ascending: true });

  if (error) {
    console.error("Error fetching agreement areas:", error);
    throw error;
  }

  return (data || []).map((row: any) => ({
    ...row,
    inspection_type_label: row.inspection_type_options?.label || null,
  }));
}

/**
 * Fetch active agreement areas for a connection (for review context)
 */
export async function fetchActiveAgreementAreas(
  connectionId: string
): Promise<AgreementAreaWithType[]> {
  const { data, error } = await supabase
    .from("connection_agreement_areas")
    .select(`
      *,
      inspection_type_options:inspection_type_id (
        label
      )
    `)
    .eq("connection_id", connectionId)
    .eq("status", "active")
    .order("state_code", { ascending: true })
    .order("county_name", { ascending: true });

  if (error) {
    console.error("Error fetching active agreement areas:", error);
    throw error;
  }

  return (data || []).map((row: any) => ({
    ...row,
    inspection_type_label: row.inspection_type_options?.label || null,
  }));
}

/**
 * Get the connection ID for a vendor-rep pair
 */
export async function getConnectionId(
  vendorUserId: string,
  repUserId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("vendor_connections")
    .select("id")
    .eq("vendor_id", vendorUserId)
    .eq("field_rep_id", repUserId)
    .eq("status", "connected")
    .maybeSingle();

  if (error) {
    console.error("Error fetching connection:", error);
    return null;
  }

  return data?.id || null;
}

/**
 * Create a new agreement area
 */
export async function createAgreementArea(
  area: Omit<ConnectionAgreementArea, "id" | "created_at" | "updated_at">
): Promise<ConnectionAgreementArea> {
  const { data, error } = await supabase
    .from("connection_agreement_areas")
    .insert(area)
    .select()
    .single();

  if (error) {
    console.error("Error creating agreement area:", error);
    throw error;
  }

  return data as ConnectionAgreementArea;
}

/**
 * Update an agreement area
 */
export async function updateAgreementArea(
  id: string,
  updates: Partial<ConnectionAgreementArea>
): Promise<ConnectionAgreementArea> {
  const { data, error } = await supabase
    .from("connection_agreement_areas")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating agreement area:", error);
    throw error;
  }

  return data as ConnectionAgreementArea;
}

/**
 * Export agreement areas to CSV format
 */
export function exportAgreementAreasToCSV(
  areas: AgreementAreaWithType[],
  connectionLabel: string
): string {
  const headers = [
    "State",
    "County",
    "Zip Code",
    "Inspection Type",
    "Base Rate",
    "Rush Rate",
    "Effective Start",
    "Effective End",
    "Status",
  ];

  const rows = areas.map((area) => [
    area.state_code,
    area.county_name || "",
    area.zip_code || "",
    area.inspection_type_label || area.inspection_category || "",
    area.base_rate ? `$${area.base_rate.toFixed(2)}` : "",
    area.rush_rate ? `$${area.rush_rate.toFixed(2)}` : "",
    area.effective_start,
    area.effective_end || "",
    area.status,
  ]);

  const csvContent = [
    `Agreement Details - ${connectionLabel}`,
    "",
    headers.join(","),
    ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
  ].join("\n");

  return csvContent;
}

/**
 * Download CSV file
 */
export function downloadCSV(csvContent: string, filename: string): void {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
