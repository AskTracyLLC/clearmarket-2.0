import { supabase } from "@/integrations/supabase/client";

export interface ReportWithDetails {
  id: string;
  reporter_user_id: string;
  reported_user_id: string;
  conversation_id: string | null;
  target_type: string | null;
  target_id: string | null;
  reason_category: string;
  reason_details: string | null;
  status: string;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  reviewer_notes: string | null;
  admin_notes: string | null;
  reporter: {
    id: string;
    email: string;
    full_name: string | null;
  };
  reported: {
    id: string;
    email: string;
    full_name: string | null;
  };
}

export interface ReportStats {
  openReports: number;
  flaggedReviews: number;
  usersWithMultipleReports: number;
}

export async function fetchReportStats(): Promise<ReportStats> {
  try {
    // Count open reports
    const { count: openCount } = await supabase
      .from("user_reports")
      .select("*", { count: "exact", head: true })
      .eq("status", "open");

    // Count flagged reviews (open reports with target_type = 'review')
    const { count: reviewCount } = await supabase
      .from("user_reports")
      .select("*", { count: "exact", head: true })
      .eq("target_type", "review")
      .eq("status", "open");

    // Count users with multiple open reports
    const { data: reportedUsers } = await supabase
      .from("user_reports")
      .select("reported_user_id")
      .eq("status", "open");

    const userCounts = new Map<string, number>();
    reportedUsers?.forEach((r) => {
      userCounts.set(r.reported_user_id, (userCounts.get(r.reported_user_id) || 0) + 1);
    });

    const usersWithMultiple = Array.from(userCounts.values()).filter((count) => count >= 2).length;

    return {
      openReports: openCount || 0,
      flaggedReviews: reviewCount || 0,
      usersWithMultipleReports: usersWithMultiple,
    };
  } catch (error) {
    console.error("Error fetching report stats:", error);
    return {
      openReports: 0,
      flaggedReviews: 0,
      usersWithMultipleReports: 0,
    };
  }
}

export async function fetchReportsByType(
  targetType?: string,
  status?: string
): Promise<ReportWithDetails[]> {
  try {
    let query = supabase
      .from("user_reports")
      .select(`
        *,
        reporter:profiles!reporter_user_id(id, email, full_name),
        reported:profiles!reported_user_id(id, email, full_name)
      `);

    if (targetType && targetType !== "all") {
      query = query.eq("target_type", targetType);
    }

    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    query = query.order("created_at", { ascending: false });

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching reports:", error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error("Unexpected error fetching reports:", error);
    return [];
  }
}

export async function fetchReviewDetails(reviewId: string) {
  try {
    const { data, error } = await supabase
      .from("reviews")
      .select(`
        *,
        reviewer:reviewer_id(id, full_name, email),
        reviewee:reviewee_id(id, full_name, email)
      `)
      .eq("id", reviewId)
      .single();

    if (error) {
      console.error("Error fetching review details:", error);
      return null;
    }

    // Fetch rep and vendor profiles for anonymous IDs
    const { data: repProfile } = await supabase
      .from("rep_profile")
      .select("anonymous_id")
      .eq("user_id", data.direction === "rep_to_vendor" ? data.reviewer_id : data.reviewee_id)
      .maybeSingle();

    const { data: vendorProfile } = await supabase
      .from("vendor_profile")
      .select("anonymous_id")
      .eq("user_id", data.direction === "rep_to_vendor" ? data.reviewee_id : data.reviewer_id)
      .maybeSingle();

    return {
      ...data,
      repAnonymousId: repProfile?.anonymous_id || "Unknown",
      vendorAnonymousId: vendorProfile?.anonymous_id || "Unknown",
    };
  } catch (error) {
    console.error("Unexpected error fetching review details:", error);
    return null;
  }
}

export async function updateReportStatus(
  reportId: string,
  status: string,
  adminUserId: string,
  adminNotes?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from("user_reports")
      .update({
        status,
        reviewed_by: adminUserId,
        reviewed_at: new Date().toISOString(),
        admin_notes: adminNotes || null,
      })
      .eq("id", reportId);

    if (error) {
      console.error("Error updating report status:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error("Unexpected error updating report status:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

export async function moderateReview(
  reviewId: string,
  action: "keep" | "hide" | "exclude",
  notes?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    let updateData: any = {
      moderation_notes: notes || null,
    };

    if (action === "keep") {
      updateData.is_hidden = false;
      updateData.exclude_from_trust_score = false;
    } else if (action === "hide") {
      updateData.is_hidden = true;
      updateData.exclude_from_trust_score = true; // Default to exclude when hidden
    } else if (action === "exclude") {
      updateData.exclude_from_trust_score = true;
    }

    const { error } = await supabase
      .from("reviews")
      .update(updateData)
      .eq("id", reviewId);

    if (error) {
      console.error("Error moderating review:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error("Unexpected error moderating review:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

export async function resolveReportsForReview(
  reviewId: string,
  adminUserId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from("user_reports")
      .update({
        status: "resolved",
        reviewed_by: adminUserId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("target_id", reviewId)
      .eq("target_type", "review")
      .eq("status", "open");

    if (error) {
      console.error("Error resolving reports:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error("Unexpected error resolving reports:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}
