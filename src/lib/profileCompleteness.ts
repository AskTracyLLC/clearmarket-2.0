import { SupabaseClient } from "@supabase/supabase-js";

export interface ChecklistItem {
  id: string;
  label: string;
  description?: string;
  done: boolean;
  link?: string;
  /** Optional action ID that the parent component can use to trigger dialogs/modals */
  actionId?: string;
}

export interface ProfileCompletenessResult {
  percent: number;
  checklist: ChecklistItem[];
  completedCount: number;
  totalCount: number;
  extras: ChecklistItem[];
}

/**
 * Compute Field Rep profile completeness
 * 4 required items: Profile, Coverage, Community, Connection
 * Plus optional extras that don't affect the progress bar
 */
export async function computeRepProfileCompleteness(
  supabaseClient: SupabaseClient,
  userId: string
): Promise<ProfileCompletenessResult> {
  const checklist: ChecklistItem[] = [];
  const extras: ChecklistItem[] = [];

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
    description: "Set where you work and your pricing",
    done: hasCoverage,
    link: "/work-setup",
  });

  // 3. Participate in Community (post, comment, or vote)
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

  // 4. Connect with a Vendor (has at least one active connection)
  const { count: connectionCount } = await supabaseClient
    .from("vendor_connections")
    .select("*", { count: "exact", head: true })
    .eq("field_rep_id", userId)
    .eq("status", "connected");

  const hasConnection = (connectionCount ?? 0) > 0;

  checklist.push({
    id: "connection",
    label: "Connect with a Vendor",
    description: "Send or accept at least one connection request",
    done: hasConnection,
    link: "/rep/find-vendors",
  });

  // ===== EXTRAS (Optional) =====

  // Extra 1: Background Check - complete once submitted for verification
  const { data: bgCheck } = await supabaseClient
    .from("background_checks")
    .select("status")
    .eq("field_rep_id", userId)
    .maybeSingle();

  const hasSubmittedBackgroundCheck = bgCheck?.status != null;

  let bgCheckDescription = "Add your background check details to help vendors verify you";
  if (bgCheck?.status === "pending") {
    bgCheckDescription = "Submitted – under review";
  } else if (bgCheck?.status === "approved") {
    bgCheckDescription = "Verified background check on file";
  } else if (bgCheck?.status === "rejected") {
    bgCheckDescription = "Submitted – needs a new screenshot";
  } else if (bgCheck?.status === "expired") {
    bgCheckDescription = "Submitted – background check expired";
  }

  extras.push({
    id: "background_check",
    label: "Add Background Check",
    description: bgCheckDescription,
    done: hasSubmittedBackgroundCheck,
    link: "/rep/profile",
  });

  // Extra 2: Complete Agreement with Vendor (has at least one active working terms)
  const { count: agreementCount } = await supabaseClient
    .from("working_terms_requests")
    .select("*", { count: "exact", head: true })
    .eq("rep_id", userId)
    .eq("status", "active");

  const hasAgreement = (agreementCount ?? 0) > 0;

  extras.push({
    id: "agreement",
    label: "Complete Agreement with Vendor",
    description: "Upload or confirm your working agreement for at least one connection",
    done: hasAgreement,
    link: "/rep/my-vendors",
  });

  // Extra 3: Set Up Availability (has at least one availability/time-off entry)
  const { count: availabilityCount } = await supabaseClient
    .from("rep_availability")
    .select("*", { count: "exact", head: true })
    .eq("rep_user_id", userId);

  const hasAvailability = (availabilityCount ?? 0) > 0;

  extras.push({
    id: "availability",
    label: "Set Up Availability",
    description: "Add your typical working days or time-off so your network knows when you're available",
    done: hasAvailability,
    link: "/rep/availability",
  });

  // Extra 4: Send an Alert to Network (has sent at least one vendor alert)
  const { count: vendorAlertCount } = await supabaseClient
    .from("vendor_alerts")
    .select("*", { count: "exact", head: true })
    .eq("rep_user_id", userId);

  const hasNetworkAlert = (vendorAlertCount ?? 0) > 0;

  extras.push({
    id: "network_alert",
    label: "Send an Alert to Network",
    description: "Send a quick update to your network about your availability or schedule changes",
    done: hasNetworkAlert,
    link: "/rep/availability",
  });

  // Extra 5: Send your route to vendors (actionable extra - opens dialog)
  // This is always available as an action, not a one-time completion item
  extras.push({
    id: "send_route",
    label: "Send your route to vendors at the beginning of your day",
    description: "Sending your planned route helps vendors know where you'll be and when. Good route updates improve communication and help your Communication Score over time.",
    done: false, // Always show as available action
    actionId: "open_route_dialog", // Parent component handles this action
  });

  // Calculate completion (only required items)
  const completedCount = checklist.filter((item) => item.done).length;
  const totalCount = checklist.length;
  const percent = Math.round((completedCount / totalCount) * 100);

  return { percent, checklist, completedCount, totalCount, extras };
}

/**
 * Compute Vendor profile completeness
 * 4 required items: Profile, Coverage, Community, Connection
 * Plus optional extras
 */
export async function computeVendorProfileCompleteness(
  supabaseClient: SupabaseClient,
  userId: string
): Promise<ProfileCompletenessResult> {
  const checklist: ChecklistItem[] = [];
  const extras: ChecklistItem[] = [];

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
    label: "Add Coverage Areas",
    description: "Set where you need coverage",
    done: hasCoverage,
    link: "/work-setup",
  });

  // 3. Participate in Community (post, comment, or vote)
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

  // 4. Connect with a Field Rep (has at least one active connection)
  const { count: connectionCount } = await supabaseClient
    .from("vendor_connections")
    .select("*", { count: "exact", head: true })
    .eq("vendor_id", userId)
    .eq("status", "connected");

  const hasConnection = (connectionCount ?? 0) > 0;

  checklist.push({
    id: "connection",
    label: "Connect with a Field Rep",
    description: "Send or accept at least one connection request",
    done: hasConnection,
    link: "/vendor/find-reps",
  });

  // ===== EXTRAS (Optional) =====

  // Extra 1: Complete Agreement with Field Rep (has at least one active working terms)
  const { count: agreementCount } = await supabaseClient
    .from("working_terms_requests")
    .select("*", { count: "exact", head: true })
    .eq("vendor_id", userId)
    .eq("status", "active");

  const hasAgreement = (agreementCount ?? 0) > 0;

  extras.push({
    id: "agreement",
    label: "Complete Agreement with Field Rep",
    description: "Upload or confirm your working agreement for at least one connection",
    done: hasAgreement,
    link: "/vendor/my-reps",
  });

  // Extra 2: Set Up Availability (vendor calendar events)
  const { count: calendarCount } = await supabaseClient
    .from("vendor_calendar_events")
    .select("*", { count: "exact", head: true })
    .eq("vendor_id", userId);

  const hasCalendarEvents = (calendarCount ?? 0) > 0;

  extras.push({
    id: "availability",
    label: "Set Up Availability",
    description: "Add office closures or pay schedules so your network knows your schedule",
    done: hasCalendarEvents,
    link: "/vendor/availability",
  });

  // Extra 3: Send an Alert to Network (has sent at least one network alert)
  const { count: alertCount } = await supabaseClient
    .from("rep_network_alerts")
    .select("*", { count: "exact", head: true })
    .eq("vendor_id", userId)
    .in("status", ["sent", "scheduled"]);

  const hasNetworkAlert = (alertCount ?? 0) > 0;

  extras.push({
    id: "network_alert",
    label: "Send an Alert to Network",
    description: "Send a quick update to your network about availability or schedule changes",
    done: hasNetworkAlert,
    link: "/vendor/availability",
  });

  // Extra 4: Fund Credits
  const { data: walletData } = await supabaseClient
    .from("user_wallet")
    .select("credits")
    .eq("user_id", userId)
    .maybeSingle();

  const hasCredits = (walletData?.credits ?? 0) > 0;

  extras.push({
    id: "credits",
    label: "Fund Credits",
    description: "Add credits to access premium features like posting Seeking Coverage",
    done: hasCredits,
    link: "/vendor/credits",
  });

  // Calculate completion (only required items)
  const completedCount = checklist.filter((item) => item.done).length;
  const totalCount = checklist.length;
  const percent = Math.round((completedCount / totalCount) * 100);

  return { percent, checklist, completedCount, totalCount, extras };
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

/**
 * Get Profile Setup status for a user (single source of truth for checklist auto-tracking)
 * Returns whether the profile setup is complete based on the same rules as the Profile Setup widget
 */
export async function getProfileSetupStatus(
  supabaseClient: SupabaseClient,
  userId: string,
  role: "rep" | "vendor"
): Promise<{ isComplete: boolean; percent: number }> {
  const result = role === "rep"
    ? await computeRepProfileCompleteness(supabaseClient, userId)
    : await computeVendorProfileCompleteness(supabaseClient, userId);

  return {
    isComplete: result.percent === 100,
    percent: result.percent,
  };
}

/**
 * Get user's role for profile setup status check
 */
export async function getUserRoleForProfileSetup(
  supabaseClient: SupabaseClient,
  userId: string
): Promise<"rep" | "vendor" | null> {
  const { data: profile } = await supabaseClient
    .from("profiles")
    .select("is_fieldrep, is_vendor_admin")
    .eq("id", userId)
    .maybeSingle();

  if (!profile) return null;
  
  // Prefer rep if both roles exist (for dual-role accounts)
  if (profile.is_fieldrep) return "rep";
  if (profile.is_vendor_admin) return "vendor";
  return null;
}
