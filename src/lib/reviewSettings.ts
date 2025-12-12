import { supabase } from "@/integrations/supabase/client";

export interface ReviewSettings {
  id: string;
  min_days_between_reviews: number;
  created_at: string;
  updated_at: string;
}

const DEFAULT_MIN_DAYS = 30;

/**
 * Fetch the global review settings. Returns default values if no row exists.
 */
export async function getReviewSettings(): Promise<ReviewSettings> {
  const { data, error } = await supabase
    .from("review_settings")
    .select("*")
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Error fetching review settings:", error);
    return {
      id: "",
      min_days_between_reviews: DEFAULT_MIN_DAYS,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  if (!data) {
    return {
      id: "",
      min_days_between_reviews: DEFAULT_MIN_DAYS,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  return data as ReviewSettings;
}

/**
 * Update the review settings (admin only)
 */
export async function updateReviewSettings(
  minDays: number
): Promise<{ success: boolean; error?: string }> {
  // First get existing row
  const { data: existing, error: fetchError } = await supabase
    .from("review_settings")
    .select("id")
    .limit(1)
    .maybeSingle();

  if (fetchError) {
    console.error("Error fetching review settings:", fetchError);
    return { success: false, error: fetchError.message };
  }

  if (existing) {
    // Update existing row
    const { error: updateError } = await supabase
      .from("review_settings")
      .update({ min_days_between_reviews: minDays })
      .eq("id", existing.id);

    if (updateError) {
      console.error("Error updating review settings:", updateError);
      return { success: false, error: updateError.message };
    }
  } else {
    // Insert new row
    const { error: insertError } = await supabase
      .from("review_settings")
      .insert({ min_days_between_reviews: minDays });

    if (insertError) {
      console.error("Error inserting review settings:", insertError);
      return { success: false, error: insertError.message };
    }
  }

  return { success: true };
}
