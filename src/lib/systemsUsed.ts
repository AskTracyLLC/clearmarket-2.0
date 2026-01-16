import { supabase } from "@/integrations/supabase/client";

export interface SystemUsed {
  id: string;
  label: string;
  code: string;
  description: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface CreateSystemUsedInput {
  label: string;
  code?: string; // Auto-generated if not provided
  description?: string | null;
  is_active?: boolean;
  sort_order?: number;
}

export interface UpdateSystemUsedInput {
  label?: string;
  description?: string | null;
  is_active?: boolean;
  sort_order?: number;
}

/**
 * Fetch all systems, optionally including inactive ones.
 * Sorted by sort_order asc, label asc.
 */
export async function fetchSystemsUsed(options?: { includeInactive?: boolean }): Promise<SystemUsed[]> {
  let query = supabase
    .from("platform_systems_used")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("label", { ascending: true });

  if (!options?.includeInactive) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching systems used:", error);
    return [];
  }

  return (data || []) as SystemUsed[];
}

/**
 * Create a new system.
 */
export async function createSystemUsed(input: CreateSystemUsedInput): Promise<{ success: boolean; error?: string; data?: SystemUsed }> {
  // Generate code from label if not provided
  const code = input.code || input.label.toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_|_$/g, "");

  const { data, error } = await supabase
    .from("platform_systems_used")
    .insert({
      label: input.label,
      code,
      description: input.description || null,
      is_active: input.is_active ?? true,
      sort_order: input.sort_order ?? 100,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating system:", error);
    return { success: false, error: error.message };
  }

  return { success: true, data: data as SystemUsed };
}

/**
 * Update an existing system.
 */
export async function updateSystemUsed(id: string, input: UpdateSystemUsedInput): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from("platform_systems_used")
    .update(input)
    .eq("id", id);

  if (error) {
    console.error("Error updating system:", error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Set a system's active status.
 */
export async function setSystemUsedActive(id: string, isActive: boolean): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from("platform_systems_used")
    .update({ is_active: isActive })
    .eq("id", id);

  if (error) {
    console.error("Error toggling system active status:", error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Delete a system permanently.
 */
export async function deleteSystemUsed(id: string): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from("platform_systems_used")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Error deleting system:", error);
    return { success: false, error: error.message };
  }

  return { success: true };
}
