import { supabase } from "@/integrations/supabase/client";

export interface InspectionTypeOption {
  id: string;
  code: string;
  label: string;
  category: string;
  category_id: string | null;
  description: string | null;
  applies_to: 'rep' | 'vendor' | 'both';
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface InspectionCategory {
  id: string;
  code: string;
  label: string;
  description: string | null;
  is_active: boolean;
  sort_order: number;
}

/**
 * Fetch all active inspection categories from database
 */
export async function fetchInspectionCategories(): Promise<InspectionCategory[]> {
  const { data, error } = await supabase
    .from('inspection_categories')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('label', { ascending: true });

  if (error) {
    console.error('Error fetching inspection categories:', error);
    return [];
  }

  return (data || []) as InspectionCategory[];
}

/**
 * Fetch all inspection categories (for admin view)
 */
export async function fetchAllInspectionCategories(): Promise<InspectionCategory[]> {
  const { data, error } = await supabase
    .from('inspection_categories')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('label', { ascending: true });

  if (error) {
    console.error('Error fetching inspection categories:', error);
    return [];
  }

  return (data || []) as InspectionCategory[];
}

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
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

/**
 * Create a new inspection category
 */
export async function createInspectionCategory(
  data: { label: string; description?: string | null; sort_order: number; is_active?: boolean }
): Promise<{ success: boolean; error?: string; data?: InspectionCategory }> {
  let baseCode = generateCodeFromLabel(data.label);
  let code = baseCode;
  let suffix = 2;

  // Check for existing code and increment if needed
  while (true) {
    const { data: existing } = await supabase
      .from('inspection_categories')
      .select('id')
      .eq('code', code)
      .maybeSingle();

    if (!existing) break;
    code = `${baseCode}_${suffix}`;
    suffix++;
  }

  const { data: result, error } = await supabase
    .from('inspection_categories')
    .insert({
      ...data,
      code,
      is_active: data.is_active ?? true,
    })
    .select()
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, data: result as InspectionCategory };
}

/**
 * Update an existing inspection category
 */
export async function updateInspectionCategory(
  id: string,
  data: Partial<Omit<InspectionCategory, 'id' | 'code' | 'created_at' | 'updated_at'>>
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('inspection_categories')
    .update(data)
    .eq('id', id);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Toggle active status of an inspection category
 */
export async function toggleInspectionCategoryActive(id: string, isActive: boolean): Promise<{ success: boolean; error?: string }> {
  return updateInspectionCategory(id, { is_active: isActive });
}

/**
 * Create a new inspection type option
 */
export async function createInspectionType(
  data: Omit<InspectionTypeOption, 'id' | 'code' | 'created_at' | 'updated_at' | 'category_id'>
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
