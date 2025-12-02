import { supabase } from "@/integrations/supabase/client";

export interface CreateReportParams {
  reporterUserId: string;
  reportedUserId: string;
  conversationId?: string;
  reasonCategory: string;
  reasonDetails?: string;
  targetType?: string;
  targetId?: string;
}

export async function createReport(params: CreateReportParams): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from("user_reports")
      .insert({
        reporter_user_id: params.reporterUserId,
        reported_user_id: params.reportedUserId,
        conversation_id: params.conversationId || null,
        reason_category: params.reasonCategory,
        reason_details: params.reasonDetails || null,
        target_type: params.targetType || (params.conversationId ? "message" : "profile"),
        target_id: params.targetId || null,
      });

    if (error) {
      console.error("Error creating report:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error("Unexpected error creating report:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

export async function checkAlreadyReported(
  reporterUserId: string,
  reportedUserId: string,
  conversationId?: string
): Promise<boolean> {
  try {
    let query = supabase
      .from("user_reports")
      .select("id", { count: "exact", head: true })
      .eq("reporter_user_id", reporterUserId)
      .eq("reported_user_id", reportedUserId);

    if (conversationId) {
      query = query.eq("conversation_id", conversationId);
    } else {
      query = query.is("conversation_id", null);
    }

    const { count, error } = await query;

    if (error) {
      console.error("Error checking if already reported:", error);
      return false;
    }

    return (count || 0) > 0;
  } catch (error) {
    console.error("Unexpected error checking if already reported:", error);
    return false;
  }
}

export async function fetchAllReports() {
  try {
    const { data, error } = await supabase
      .from("user_reports")
      .select(`
        *,
        reporter:reporter_user_id(id, email, full_name),
        reported:reported_user_id(id, email, full_name),
        conversation:conversation_id(id)
      `)
      .order("created_at", { ascending: false });

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

export async function updateReportStatus(
  reportId: string,
  status: string,
  reviewerId: string,
  reviewerNotes?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from("user_reports")
      .update({
        status,
        reviewed_by: reviewerId,
        reviewed_at: new Date().toISOString(),
        reviewer_notes: reviewerNotes || null,
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
