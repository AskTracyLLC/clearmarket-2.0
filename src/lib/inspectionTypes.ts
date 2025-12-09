import { supabase } from "@/integrations/supabase/client";

export interface InspectionTypeOption {
  id: string;
  code: string;
  label: string;
  category: string;
  description: string | null;
  applies_to: 'rep' | 'vendor' | 'both';
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export const INSPECTION_TYPE_CATEGORIES = [
  'Property Inspections',
  'Loss / Insurance Claims (Appointment-based)',
  'Commercial',
  'Other',
] as const;

export type InspectionTypeCategory = typeof INSPECTION_TYPE_CATEGORIES[number];

/**
 * Fetch inspection type options for a specific role (rep or vendor)
 * Groups by category and orders appropriately
 */
export async function fetchInspectionTypesForRole(role: 'rep' | 'vendor'): Promise<Record<string, InspectionTypeOption[]>> {
  const { data, error } = await supabase
    .from('inspection_type_options')
    .select('*')
    .or(`applies_to.eq.${role},applies_to.eq.both`)
    .order('category', { ascending: true })
    .order('sort_order', { ascending: true })
    .order('label', { ascending: true });

  if (error) {
    console.error('Error fetching inspection types:', error);
    return {};
  }

  // Group by category
  const grouped: Record<string, InspectionTypeOption[]> = {};
  for (const opt of (data || []) as InspectionTypeOption[]) {
    if (!grouped[opt.category]) {
      grouped[opt.category] = [];
    }
    grouped[opt.category].push(opt);
  }

  return grouped;
}

/**
 * Fetch all inspection type options (for admin view)
 */
export async function fetchAllInspectionTypes(): Promise<InspectionTypeOption[]> {
  const { data, error } = await supabase
    .from('inspection_type_options')
    .select('*')
    .order('category', { ascending: true })
    .order('sort_order', { ascending: true })
    .order('label', { ascending: true });

  if (error) {
    console.error('Error fetching inspection types:', error);
    return [];
  }

  return (data || []) as InspectionTypeOption[];
}

/**
 * Generate a unique code from label
 */
export function generateCodeFromLabel(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

/**
 * Create a new inspection type option
 */
export async function createInspectionType(
  data: Omit<InspectionTypeOption, 'id' | 'code' | 'created_at' | 'updated_at'>
): Promise<{ success: boolean; error?: string; data?: InspectionTypeOption }> {
  let baseCode = generateCodeFromLabel(data.label);
  let code = baseCode;
  let suffix = 2;

  // Check for existing code and increment if needed
  while (true) {
    const { data: existing } = await supabase
      .from('inspection_type_options')
      .select('id')
      .eq('code', code)
      .maybeSingle();

    if (!existing) break;
    code = `${baseCode}_${suffix}`;
    suffix++;
  }

  const { data: result, error } = await supabase
    .from('inspection_type_options')
    .insert({
      ...data,
      code,
    })
    .select()
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, data: result as InspectionTypeOption };
}

/**
 * Update an existing inspection type option
 */
export async function updateInspectionType(
  id: string,
  data: Partial<Omit<InspectionTypeOption, 'id' | 'code' | 'created_at' | 'updated_at'>>
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('inspection_type_options')
    .update(data)
    .eq('id', id);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Toggle active status of an inspection type
 */
export async function toggleInspectionTypeActive(id: string, isActive: boolean): Promise<{ success: boolean; error?: string }> {
  return updateInspectionType(id, { is_active: isActive });
}

/**
 * Map legacy string-based inspection types to new option IDs
 * Returns both matching IDs and any unmatched legacy values
 */
export async function mapLegacyToOptions(
  legacyValues: string[],
  role: 'rep' | 'vendor'
): Promise<{ matchedIds: string[]; unmatchedLegacy: string[] }> {
  const grouped = await fetchInspectionTypesForRole(role);
  const allOptions = Object.values(grouped).flat();
  
  const matchedIds: string[] = [];
  const unmatchedLegacy: string[] = [];

  for (const val of legacyValues) {
    // Try to find by label match (case insensitive)
    const match = allOptions.find(
      opt => opt.label.toLowerCase() === val.toLowerCase() ||
             opt.code.toLowerCase() === val.toLowerCase()
    );
    
    if (match) {
      matchedIds.push(match.id);
    } else {
      unmatchedLegacy.push(val);
    }
  }

  return { matchedIds, unmatchedLegacy };
}
