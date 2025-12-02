import { supabase } from "@/integrations/supabase/client";
import { createNotification } from "./notifications";
import { isBackgroundCheckActive } from "./backgroundCheckUtils";

export interface RepMatchSettings {
  id: string;
  user_id: string;
  states_interested: string[];
  inspection_types: string[] | null;
  minimum_pay: number | null;
  notify_email: boolean;
  notify_in_app: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Get rep match settings for a user
 */
export async function getRepMatchSettings(
  userId: string
): Promise<RepMatchSettings | null> {
  const { data, error } = await supabase
    .from("rep_match_settings")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("Error fetching rep match settings:", error);
    return null;
  }

  return data;
}

/**
 * Create or update rep match settings
 */
export async function upsertRepMatchSettings(
  userId: string,
  settings: {
    states_interested: string[];
    inspection_types?: string[] | null;
    minimum_pay?: number | null;
    notify_email?: boolean;
    notify_in_app?: boolean;
  }
): Promise<{ data: RepMatchSettings | null; error: string | null }> {
  const { data, error } = await supabase
    .from("rep_match_settings")
    .upsert({
      user_id: userId,
      ...settings,
    }, {
      onConflict: "user_id"
    })
    .select()
    .single();

  if (error) {
    console.error("Error upserting rep match settings:", error);
    return { data: null, error: error.message };
  }

  return { data, error: null };
}

/**
 * Evaluate rep match settings against a new seeking coverage post
 * Called when a vendor creates a new post
 */
export async function evaluateMatchAlertsForNewPost(
  postId: string
): Promise<void> {
  try {
    // Fetch the post details
    const { data: post, error: postError } = await supabase
      .from("seeking_coverage_posts")
      .select("*")
      .eq("id", postId)
      .single();

    if (postError || !post) {
      console.error("Error fetching post for match evaluation:", postError);
      return;
    }

    // Only evaluate for active posts
    if (post.status !== "active" || !post.is_accepting_responses || post.deleted_at) {
      return;
    }

    // Get all rep match settings where notifications are enabled
    const { data: allSettings, error: settingsError } = await supabase
      .from("rep_match_settings")
      .select("*")
      .or("notify_email.eq.true,notify_in_app.eq.true");

    if (settingsError || !allSettings || allSettings.length === 0) {
      console.log("No active match settings found");
      return;
    }

    // For each rep with match settings, check if they match
    for (const settings of allSettings) {
      const matches = await checkRepMatchesPost(settings, post);
      
      if (matches) {
        // Create notification for this rep
        await createNotification(
          supabase,
          settings.user_id,
          "new_coverage_opportunity",
          `New Seeking Coverage: ${post.state_code || "Multiple States"} – ${post.title}`,
          post.description || "A new opportunity matches your coverage and preferences.",
          postId
        );
      }
    }
  } catch (error) {
    console.error("Error evaluating match alerts:", error);
  }
}

/**
 * Check if a rep's match settings align with a seeking coverage post
 */
async function checkRepMatchesPost(
  settings: RepMatchSettings,
  post: any
): Promise<boolean> {
  // 1. State filter: post must be in one of rep's interested states
  if (!post.state_code || !settings.states_interested.includes(post.state_code)) {
    return false;
  }

  // 2. Minimum pay filter (if set)
  if (settings.minimum_pay !== null && settings.minimum_pay !== undefined) {
    const postRate = post.pay_max ?? post.pay_min;
    if (postRate === null || postRate === undefined || postRate < settings.minimum_pay) {
      return false;
    }
  }

  // 3. Inspection type filter (if set)
  if (settings.inspection_types && settings.inspection_types.length > 0) {
    const hasMatchingType = post.inspection_types.some((postType: string) =>
      settings.inspection_types!.some((settingsType: string) =>
        postType.toLowerCase().includes(settingsType.toLowerCase()) ||
        settingsType.toLowerCase().includes(postType.toLowerCase())
      )
    );
    
    if (!hasMatchingType) {
      return false;
    }
  }

  // 4. Get rep profile to check coverage and background check
  const { data: repProfile, error: repError } = await supabase
    .from("rep_profile")
    .select("*")
    .eq("user_id", settings.user_id)
    .maybeSingle();

  if (repError || !repProfile) {
    return false;
  }

  // 5. Check if rep has coverage in this state/county
  const { data: coverageAreas, error: coverageError } = await supabase
    .from("rep_coverage_areas")
    .select("*")
    .eq("user_id", settings.user_id)
    .eq("state_code", post.state_code);

  if (coverageError || !coverageAreas || coverageAreas.length === 0) {
    return false;
  }

  // Check if any coverage area matches the post's county (or if rep covers entire state)
  const hasCoverageMatch = coverageAreas.some((coverage: any) => {
    if (coverage.covers_entire_state) return true;
    if (!post.county_id) return true; // State-level post
    return coverage.county_id === post.county_id;
  });

  if (!hasCoverageMatch) {
    return false;
  }

  // 6. Background check requirement check
  if (post.requires_background_check) {
    const hasValidCheck = isBackgroundCheckActive({
      background_check_is_active: repProfile.background_check_is_active,
      background_check_expires_on: repProfile.background_check_expires_on,
    });

    const isWillingToObtain = repProfile.willing_to_obtain_background_check ?? false;
    const allowWilling = post.allow_willing_to_obtain_background_check ?? true;

    if (!hasValidCheck && !(allowWilling && isWillingToObtain)) {
      return false;
    }

    // AspenGrove-specific requirement
    if (hasValidCheck && post.requires_aspen_grove && repProfile.background_check_provider !== "aspen_grove") {
      return false;
    }
  }

  // 7. Check pricing: vendor pay must meet rep's base_price for that coverage
  const matchingCoverage = coverageAreas.find((coverage: any) => {
    if (coverage.covers_entire_state) return true;
    if (!post.county_id) return true;
    return coverage.county_id === post.county_id;
  });

  if (!matchingCoverage || matchingCoverage.base_price === null || matchingCoverage.base_price === undefined) {
    return false;
  }

  const vendorRate = post.pay_max ?? post.pay_min;
  if (vendorRate === null || vendorRate === undefined || vendorRate < matchingCoverage.base_price) {
    return false;
  }

  return true;
}

/**
 * Get default states interested from rep's coverage areas
 */
export async function getDefaultStatesFromCoverage(userId: string): Promise<string[]> {
  const { data: coverageAreas } = await supabase
    .from("rep_coverage_areas")
    .select("state_code")
    .eq("user_id", userId);

  if (!coverageAreas || coverageAreas.length === 0) {
    return [];
  }

  // Return unique state codes
  return [...new Set(coverageAreas.map((c: any) => c.state_code))];
}
