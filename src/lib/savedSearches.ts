import { supabase } from "@/integrations/supabase/client";
import { createNotification } from "@/lib/notifications";

export type RoleContext = "vendor_find_reps" | "rep_find_vendors" | "rep_find_work";

export interface SavedSearch {
  id: string;
  user_id: string;
  role_context: RoleContext;
  name: string;
  search_filters: Record<string, any>;
  is_active: boolean;
  last_run_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Save a new search for the current user
 */
export async function saveSearch(
  userId: string,
  roleContext: RoleContext,
  name: string,
  filters: Record<string, any>,
  isActive: boolean = true
): Promise<{ data: SavedSearch | null; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from("saved_searches")
      .insert({
        user_id: userId,
        role_context: roleContext,
        name,
        search_filters: filters,
        is_active: isActive,
        last_run_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    return { data: data as SavedSearch, error: null };
  } catch (error: any) {
    console.error("Error saving search:", error);
    return { data: null, error: error.message };
  }
}

/**
 * Get all saved searches for a user in a specific role context
 */
export async function getSavedSearches(
  userId: string,
  roleContext: RoleContext
): Promise<SavedSearch[]> {
  try {
    const { data, error } = await supabase
      .from("saved_searches")
      .select("*")
      .eq("user_id", userId)
      .eq("role_context", roleContext)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return (data as SavedSearch[]) || [];
  } catch (error: any) {
    console.error("Error fetching saved searches:", error);
    return [];
  }
}

/**
 * Update a saved search
 */
export async function updateSavedSearch(
  searchId: string,
  updates: Partial<SavedSearch>
): Promise<{ error: string | null }> {
  try {
    const { error } = await supabase
      .from("saved_searches")
      .update(updates)
      .eq("id", searchId);

    if (error) throw error;

    return { error: null };
  } catch (error: any) {
    console.error("Error updating saved search:", error);
    return { error: error.message };
  }
}

/**
 * Delete a saved search
 */
export async function deleteSavedSearch(searchId: string): Promise<{ error: string | null }> {
  try {
    const { error } = await supabase
      .from("saved_searches")
      .delete()
      .eq("id", searchId);

    if (error) throw error;

    return { error: null };
  } catch (error: any) {
    console.error("Error deleting saved search:", error);
    return { error: error.message };
  }
}

/**
 * Check if a user-target pair has already been notified for a saved search
 */
async function hasAlreadyNotified(
  savedSearchId: string,
  targetUserId: string
): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from("saved_search_matches")
      .select("id")
      .eq("saved_search_id", savedSearchId)
      .eq("target_user_id", targetUserId)
      .maybeSingle();

    if (error) throw error;

    return !!data;
  } catch (error: any) {
    console.error("Error checking notification status:", error);
    return false; // Assume not notified to avoid missing alerts
  }
}

/**
 * Record that a user has been notified for a saved search match
 */
async function recordNotification(
  savedSearchId: string,
  targetUserId: string
): Promise<void> {
  try {
    await supabase
      .from("saved_search_matches")
      .insert({
        saved_search_id: savedSearchId,
        target_user_id: targetUserId,
      });
  } catch (error: any) {
    console.error("Error recording notification:", error);
  }
}

/**
 * Evaluate all active saved searches when a new rep becomes discoverable
 */
export async function evaluateSavedSearchesForNewRep(repUserId: string): Promise<void> {
  try {
    // Fetch active vendor saved searches for Find Reps
    const { data: searches } = await supabase
      .from("saved_searches")
      .select("*")
      .eq("role_context", "vendor_find_reps")
      .eq("is_active", true);

    if (!searches || searches.length === 0) return;

    // Fetch the rep's discoverable snapshot
    const { data: repProfile } = await supabase
      .from("rep_profile")
      .select(`
        *, 
        profiles!inner(last_seen_at)
      `)
      .eq("user_id", repUserId)
      .single();

    if (!repProfile) return;

    // Fetch rep's coverage areas
    const { data: coverageAreas } = await supabase
      .from("rep_coverage_areas")
      .select("*")
      .eq("user_id", repUserId);

    const repData = {
      ...repProfile,
      coverageAreas: coverageAreas || [],
      last_seen_at: (repProfile as any).profiles?.last_seen_at || null,
    };

    // For each saved search, check if this rep matches
    for (const search of searches) {
      const filters = search.search_filters as Record<string, any>;

      // Check if already notified
      const alreadyNotified = await hasAlreadyNotified(search.id, repUserId);
      if (alreadyNotified) continue;

      // Apply matching logic (simplified version of VendorFindReps filtering)
      let matches = true;

      // State filter
      if (filters?.state && filters.state !== "all" && repData.state !== filters.state) {
        matches = false;
      }

      // Systems filter
      if (matches && filters?.systems && Array.isArray(filters.systems) && filters.systems.length > 0) {
        const systemsMatch = filters.systems.some((sys: string) =>
          repData.systems_used?.some((repSys: string) => repSys.includes(sys))
        );
        if (!systemsMatch) matches = false;
      }

      // Inspection types filter
      if (matches && filters?.inspectionTypes && Array.isArray(filters.inspectionTypes) && filters.inspectionTypes.length > 0) {
        const typesMatch = filters.inspectionTypes.some((type: string) =>
          repData.inspection_types?.some((repType: string) => repType.includes(type))
        );
        if (!typesMatch) matches = false;
      }

      // Background check filter
      if (matches && filters?.bgCheckMode === "active-only") {
        const hasValidCheck = repData.background_check_is_active;
        if (!hasValidCheck) matches = false;
      }

      // HUD keys filter
      if (matches && filters?.hasHudKeys === true && !repData.has_hud_keys) {
        matches = false;
      }

      // Activity filter
      if (matches && filters?.activityFilter === "active-week" && repData.last_seen_at) {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        if (new Date(repData.last_seen_at) < sevenDaysAgo) {
          matches = false;
        }
      }

      if (matches) {
        // Create notification for the vendor
        await createNotification(
          supabase,
          search.user_id,
          "saved_search_match",
          `New rep matches "${search.name}"`,
          `${repData.anonymous_id || "A field rep"} in ${repData.state || "your search area"} now matches your saved search criteria.`,
          null
        );

        // Record the notification
        await recordNotification(search.id, repUserId);

        // Update last_run_at
        await updateSavedSearch(search.id, { last_run_at: new Date().toISOString() });
      }
    }
  } catch (error: any) {
    console.error("Error evaluating saved searches for new rep:", error);
  }
}

/**
 * Evaluate all active saved searches when a new vendor becomes discoverable
 */
export async function evaluateSavedSearchesForNewVendor(vendorUserId: string): Promise<void> {
  try {
    // Fetch active rep saved searches for Find Vendors
    const { data: searches } = await supabase
      .from("saved_searches")
      .select("*")
      .eq("role_context", "rep_find_vendors")
      .eq("is_active", true);

    if (!searches || searches.length === 0) return;

    // Fetch the vendor's discoverable snapshot
    const { data: vendorProfile } = await supabase
      .from("vendor_profile")
      .select(`
        *, 
        profiles!inner(last_seen_at, is_vendor_admin)
      `)
      .eq("user_id", vendorUserId)
      .single();

    if (!vendorProfile || !(vendorProfile as any).profiles?.is_vendor_admin) return;

    const vendorData = {
      ...vendorProfile,
      last_seen_at: (vendorProfile as any).profiles?.last_seen_at || null,
    };

    // For each saved search, check if this vendor matches
    for (const search of searches) {
      const filters = search.search_filters as Record<string, any>;

      // Check if already notified
      const alreadyNotified = await hasAlreadyNotified(search.id, vendorUserId);
      if (alreadyNotified) continue;

      // Apply matching logic
      let matches = true;

      // State filter
      if (filters?.state && vendorData.state !== filters.state) {
        matches = false;
      }

      // Inspection types filter
      if (matches && filters?.inspectionTypes && Array.isArray(filters.inspectionTypes) && filters.inspectionTypes.length > 0) {
        const typesMatch = filters.inspectionTypes.some((type: string) =>
          vendorData.primary_inspection_types?.some((vType: string) => vType.includes(type))
        );
        if (!typesMatch) matches = false;
      }

      // Activity filter
      if (matches && filters?.activityFilter === "active-week" && vendorData.last_seen_at) {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        if (new Date(vendorData.last_seen_at) < sevenDaysAgo) {
          matches = false;
        }
      }

      if (matches) {
        // Create notification for the rep
        await createNotification(
          supabase,
          search.user_id,
          "saved_search_match",
          `New vendor matches "${search.name}"`,
          `${vendorData.company_name || "A vendor"} in ${vendorData.state || "your search area"} now matches your saved search criteria.`,
          null
        );

        // Record the notification
        await recordNotification(search.id, vendorUserId);

        // Update last_run_at
        await updateSavedSearch(search.id, { last_run_at: new Date().toISOString() });
      }
    }
  } catch (error: any) {
    console.error("Error evaluating saved searches for new vendor:", error);
  }
}

/**
 * Evaluate all active saved searches when a new seeking coverage post is created
 */
export async function evaluateSavedSearchesForNewPost(postId: string): Promise<void> {
  try {
    // Fetch active rep saved searches for Find Work
    const { data: searches } = await supabase
      .from("saved_searches")
      .select("*")
      .eq("role_context", "rep_find_work")
      .eq("is_active", true);

    if (!searches || searches.length === 0) return;

    // Fetch the post
    const { data: post } = await supabase
      .from("seeking_coverage_posts")
      .select("*")
      .eq("id", postId)
      .single();

    if (!post || post.status !== "active" || !post.is_accepting_responses) return;

    // For each saved search, check if this post matches
    for (const search of searches) {
      const filters = search.search_filters as Record<string, any>;

      // Check if already notified
      const alreadyNotified = await hasAlreadyNotified(search.id, postId);
      if (alreadyNotified) continue;

      // Apply matching logic
      let matches = true;

      // State filter
      if (filters?.state && filters.state !== "all" && post.state_code !== filters.state) {
        matches = false;
      }

      // Inspection types filter
      if (matches && filters?.inspectionTypes && Array.isArray(filters.inspectionTypes) && filters.inspectionTypes.length > 0) {
        const typesMatch = filters.inspectionTypes.some((type: string) =>
          post.inspection_types?.some((pType: string) => pType.includes(type))
        );
        if (!typesMatch) matches = false;
      }

      // Systems filter
      if (matches && filters?.systems && Array.isArray(filters.systems) && filters.systems.length > 0) {
        const systemsMatch =
          !post.systems_required_array?.length ||
          filters.systems.some((sys: string) =>
            post.systems_required_array?.some((pSys: string) => pSys.includes(sys))
          );
        if (!systemsMatch) matches = false;
      }

      // Background check filter
      if (matches && filters?.requiresBackgroundCheck !== undefined) {
        if (post.requires_background_check !== filters.requiresBackgroundCheck) {
          matches = false;
        }
      }

      if (matches) {
        // Create notification for the rep
        await createNotification(
          supabase,
          search.user_id,
          "saved_search_match",
          `New work matches "${search.name}"`,
          `"${post.title}" in ${post.state_code || "your search area"} matches your saved search criteria.`,
          postId
        );

        // Record the notification
        await recordNotification(search.id, postId);

        // Update last_run_at
        await updateSavedSearch(search.id, { last_run_at: new Date().toISOString() });
      }
    }
  } catch (error: any) {
    console.error("Error evaluating saved searches for new post:", error);
  }
}
