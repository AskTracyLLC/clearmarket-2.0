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
  completedCount: number;
  totalCount: number;
}

/**
 * Compute Field Rep profile completeness
 * 4 items: Profile, Coverage, Background Check, Community
 */
export async function computeRepProfileCompleteness(
  supabaseClient: SupabaseClient,
  userId: string
): Promise<ProfileCompletenessResult> {
  const checklist: ChecklistItem[] = [];

  // Query rep_profile
  const { data: repProfile } = await supabaseClient
    .from("rep_profile")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  // 1. Complete Rep Profile
  const hasProfile =
    repProfile &&
    repProfile.city &&
    repProfile.state &&
    repProfile.inspection_types &&
    repProfile.inspection_types.length > 0;

  checklist.push({
    id: "profile",
    label: "Complete Rep Profile",
    description: "City, state, and at least one inspection type",
    done: !!hasProfile,
    link: "/rep/profile",
  });

  // 2. Add Coverage Areas
  const { count: coverageCount } = await supabaseClient
    .from("rep_coverage_areas")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);

  const hasCoverage = (coverageCount ?? 0) > 0;

  checklist.push({
    id: "coverage",
    label: "Add Coverage Areas",
    description: "Define where you work and your pricing",
    done: hasCoverage,
    link: "/rep/profile",
  });

  // 3. Background Check - complete once submitted for verification
  const { data: bgCheck } = await supabaseClient
    .from("background_checks")
    .select("status")
    .eq("field_rep_id", userId)
    .maybeSingle();

  // Consider complete if any submission exists (pending, approved, rejected, or expired)
  const hasSubmittedBackgroundCheck = bgCheck?.status != null;

  // Determine status text for the checklist description
  let bgCheckDescription = "Submit your background check for verification";
  if (bgCheck?.status === "pending") {
    bgCheckDescription = "Submitted – under review";
  } else if (bgCheck?.status === "approved") {
    bgCheckDescription = "Verified background check on file";
  } else if (bgCheck?.status === "rejected") {
    bgCheckDescription = "Submitted – needs a new screenshot";
  } else if (bgCheck?.status === "expired") {
    bgCheckDescription = "Submitted – background check expired";
  }

  checklist.push({
    id: "background_check",
    label: "Add Background Check",
    description: bgCheckDescription,
    done: hasSubmittedBackgroundCheck,
    link: "/rep/profile",
  });

  // 4. Participate in Community (post, comment, or vote)
  const [postsResult, commentsResult, votesResult] = await Promise.all([
    supabaseClient
      .from("community_posts")
      .select("id", { count: "exact", head: true })
      .eq("author_id", userId),
    supabaseClient
      .from("community_comments")
      .select("id", { count: "exact", head: true })
      .eq("author_id", userId),
    supabaseClient
      .from("community_votes")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId),
  ]);

  const hasCommunityParticipation =
    (postsResult.count ?? 0) > 0 ||
    (commentsResult.count ?? 0) > 0 ||
    (votesResult.count ?? 0) > 0;

  checklist.push({
    id: "community",
    label: "Participate in Community",
    description: "Post, comment, or vote on the Community Board",
    done: hasCommunityParticipation,
    link: "/community",
  });

  // Calculate completion
  const completedCount = checklist.filter((item) => item.done).length;
  const totalCount = checklist.length;
  const percent = Math.round((completedCount / totalCount) * 100);

  return { percent, checklist, completedCount, totalCount };
}

/**
 * Compute Vendor profile completeness
 * 5 items: Profile, Coverage, Credits, Seeking Post, Review a Rep
 */
export async function computeVendorProfileCompleteness(
  supabaseClient: SupabaseClient,
  userId: string
): Promise<ProfileCompletenessResult> {
  const checklist: ChecklistItem[] = [];

  // Query vendor_profile
  const { data: vendorProfile } = await supabaseClient
    .from("vendor_profile")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  // 1. Complete Vendor Profile
  const hasProfile =
    vendorProfile &&
    vendorProfile.company_name &&
    vendorProfile.city &&
    vendorProfile.state &&
    vendorProfile.primary_inspection_types &&
    vendorProfile.primary_inspection_types.length > 0;

  checklist.push({
    id: "profile",
    label: "Complete Vendor Profile",
    description: "Company name, location, and inspection types",
    done: !!hasProfile,
    link: "/vendor/profile",
  });

  // 2. Add Vendor Coverage
  const { count: coverageCount } = await supabaseClient
    .from("vendor_coverage_areas")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);

  const hasCoverage = (coverageCount ?? 0) > 0;

  checklist.push({
    id: "coverage",
    label: "Add Vendor Coverage",
    description: "Define which states/counties you serve",
    done: hasCoverage,
    link: "/vendor/profile",
  });

  // 3. Fund Credits
  const { data: walletData } = await supabaseClient
    .from("user_wallet")
    .select("credits")
    .eq("user_id", userId)
    .maybeSingle();

  const hasCredits = (walletData?.credits ?? 0) > 0;

  checklist.push({
    id: "credits",
    label: "Fund Credits",
    description: "Add credits to unlock features",
    done: hasCredits,
    link: "/vendor/credits",
  });

  // 4. Create First Seeking Coverage Post
  const { count: postCount } = await supabaseClient
    .from("seeking_coverage_posts")
    .select("*", { count: "exact", head: true })
    .eq("vendor_id", userId)
    .is("deleted_at", null);

  const hasPost = (postCount ?? 0) > 0;

  checklist.push({
    id: "seeking_post",
    label: "Create First Seeking Coverage Post",
    description: "Let reps know what work you need covered",
    done: hasPost,
    link: "/vendor/seeking-coverage",
  });

  // 5. Review a Rep (review where reviewee is a field rep)
  const { data: reviews } = await supabaseClient
    .from("reviews")
    .select("reviewee_id")
    .eq("reviewer_id", userId)
    .eq("direction", "vendor_to_rep")
    .limit(1);

  const hasReviewedRep = (reviews?.length ?? 0) > 0;

  checklist.push({
    id: "review",
    label: "Review a Rep",
    description: "Share feedback on reps you've worked with",
    done: hasReviewedRep,
    link: "/vendor/my-reps",
  });

  // Calculate completion
  const completedCount = checklist.filter((item) => item.done).length;
  const totalCount = checklist.length;
  const percent = Math.round((completedCount / totalCount) * 100);

  return { percent, checklist, completedCount, totalCount };
}

/**
 * Get status message based on completion percentage
 */
export function getCompletionMessage(percent: number): string {
  if (percent === 100) return "All set! Your profile is fully complete.";
  if (percent >= 75) return "Almost there!";
  if (percent >= 50) return "Good progress!";
  return "Getting started";
}
