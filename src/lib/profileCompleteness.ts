import { SupabaseClient } from "@supabase/supabase-js";

export interface ChecklistItem {
  id: string;
  label: string;
  description?: string;
  done: boolean;
  link?: string;
}

export interface ProfileCompletenessResult {
  percent: number;
  checklist: ChecklistItem[];
}

/**
 * Compute Field Rep profile completeness
 * Base: 50%, with increments for various sections
 */
export async function computeRepProfileCompleteness(
  supabaseClient: SupabaseClient,
  userId: string
): Promise<ProfileCompletenessResult> {
  let percent = 50; // Start at 50% baseline
  const checklist: ChecklistItem[] = [];

  // Query rep_profile
  const { data: repProfile } = await supabaseClient
    .from("rep_profile")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  // 1. Basic info completed (+15%)
  const hasBasicInfo =
    repProfile &&
    repProfile.city &&
    repProfile.state &&
    repProfile.zip_code &&
    repProfile.systems_used &&
    repProfile.systems_used.length > 0 &&
    repProfile.inspection_types &&
    repProfile.inspection_types.length > 0;

  if (hasBasicInfo) percent += 15;

  checklist.push({
    id: "basic_info",
    label: "Complete basic profile info",
    description: "City, state, ZIP, systems used, and inspection types",
    done: !!hasBasicInfo,
    link: "/rep/profile",
  });

  // 2. At least one coverage area (+15%)
  const { count: coverageCount } = await supabaseClient
    .from("rep_coverage_areas")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);

  const hasCoverage = (coverageCount ?? 0) > 0;
  if (hasCoverage) percent += 15;

  checklist.push({
    id: "coverage",
    label: "Add at least one coverage area",
    description: "Define where you work and your pricing",
    done: hasCoverage,
    link: "/rep/profile",
  });

  // 3. Background check ready (+10%)
  const hasBackgroundCheck =
    repProfile?.background_check_is_active === true ||
    repProfile?.willing_to_obtain_background_check === true;

  if (hasBackgroundCheck) percent += 10;

  checklist.push({
    id: "background_check",
    label: "Background check ready",
    description: "Active background check or willing to obtain",
    done: hasBackgroundCheck,
    link: "/rep/profile",
  });

  // 4. HUD keys / equipment (+5%)
  const hasEquipment =
    repProfile?.has_hud_keys === true ||
    (repProfile?.equipment_notes && repProfile.equipment_notes.trim() !== "");

  if (hasEquipment) percent += 5;

  checklist.push({
    id: "equipment",
    label: "HUD keys / equipment listed",
    description: "Optional but helps vendors understand your capabilities",
    done: hasEquipment,
    link: "/rep/profile",
  });

  // 5. At least one review (+5%)
  const { count: reviewCount } = await supabaseClient
    .from("reviews")
    .select("*", { count: "exact", head: true })
    .eq("reviewee_id", userId);

  const hasReview = (reviewCount ?? 0) > 0;
  if (hasReview) percent += 5;

  checklist.push({
    id: "reviews",
    label: "Receive at least one review",
    description: "Build trust through verified work history",
    done: hasReview,
    link: "/rep/reviews",
  });

  // Clamp between 50 and 100
  percent = Math.min(100, Math.max(50, percent));

  return { percent, checklist };
}

/**
 * Compute Vendor profile completeness
 * Base: 50%, with increments for various sections
 */
export async function computeVendorProfileCompleteness(
  supabaseClient: SupabaseClient,
  userId: string
): Promise<ProfileCompletenessResult> {
  let percent = 50; // Start at 50% baseline
  const checklist: ChecklistItem[] = [];

  // Query vendor_profile
  const { data: vendorProfile } = await supabaseClient
    .from("vendor_profile")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  // 1. Company profile completed (+15%)
  const hasCompanyInfo =
    vendorProfile &&
    vendorProfile.company_name &&
    vendorProfile.city &&
    vendorProfile.state &&
    vendorProfile.systems_used &&
    vendorProfile.systems_used.length > 0 &&
    vendorProfile.primary_inspection_types &&
    vendorProfile.primary_inspection_types.length > 0;

  if (hasCompanyInfo) percent += 15;

  checklist.push({
    id: "company_info",
    label: "Complete company profile",
    description: "Company name, location, systems, and inspection types",
    done: !!hasCompanyInfo,
    link: "/vendor/profile",
  });

  // 2. At least one coverage area (+15%)
  const { count: coverageCount } = await supabaseClient
    .from("vendor_coverage_areas")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);

  const hasCoverage = (coverageCount ?? 0) > 0;
  if (hasCoverage) percent += 15;

  checklist.push({
    id: "coverage",
    label: "Add at least one coverage area",
    description: "Define which states/counties you serve",
    done: hasCoverage,
    link: "/vendor/profile",
  });

  // 3. At least one active Seeking Coverage post (+10%)
  const { count: postCount } = await supabaseClient
    .from("seeking_coverage_posts")
    .select("*", { count: "exact", head: true })
    .eq("vendor_id", userId)
    .eq("status", "active")
    .is("deleted_at", null);

  const hasActivePost = (postCount ?? 0) > 0;
  if (hasActivePost) percent += 10;

  checklist.push({
    id: "seeking_post",
    label: "Create a Seeking Coverage post",
    description: "Let reps know what work you need covered",
    done: hasActivePost,
    link: "/vendor/seeking-coverage",
  });

  // 4. Background check / compliance (skip for now, redistribute +5% into existing items)
  // Vendors don't have background check requirements, so we skip this

  // 5. At least one review (+10% - redistributed the +5% from background check here)
  const { count: reviewCount } = await supabaseClient
    .from("reviews")
    .select("*", { count: "exact", head: true })
    .eq("reviewee_id", userId);

  const hasReview = (reviewCount ?? 0) > 0;
  if (hasReview) percent += 10;

  checklist.push({
    id: "reviews",
    label: "Receive at least one review",
    description: "Build trust through verified relationships",
    done: hasReview,
    link: "/vendor/reviews",
  });

  // Clamp between 50 and 100
  percent = Math.min(100, Math.max(50, percent));

  return { percent, checklist };
}

/**
 * Get status message based on completion percentage
 */
export function getCompletionMessage(percent: number): string {
  if (percent === 100) return "Your profile is fully set up. You can always update it anytime.";
  if (percent >= 90) return "Just a couple more steps";
  if (percent >= 70) return "Almost there";
  return "Getting started";
}
