import { supabase } from "@/integrations/supabase/client";

export interface QualityRadarData {
  strengths: Array<{ dimension: string; score: number }>;
  weakSignals: Array<{ dimension: string; score: number; trend: string }>;
  recentReportCount: number;
  communicationComplaints: number;
}

export interface ReputationSnapshotData {
  onTimeHistory: Array<{ month: string; score: number }>;
  qualityHistory: Array<{ month: string; score: number }>;
  communicationHistory: Array<{ month: string; score: number }>;
  recentThemes: Array<{ theme: string; positive: boolean }>;
  activeConnectionCount: number;
}

export interface SafetyAnalyticsData {
  reportsOverTime: Array<{ date: string; count: number }>;
  reportsByType: Array<{ type: string; count: number }>;
  topReportedAccounts: Array<{ userId: string; anonymousId: string; count: number }>;
  falsePositiveRate: number;
  upheldRate: number;
}

/**
 * Fetch vendor quality radar analytics
 */
export async function fetchVendorQualityRadar(userId: string): Promise<QualityRadarData> {
  // Fetch received reviews (rep_to_vendor)
  const { data: reviews } = await supabase
    .from("reviews")
    .select("rating_on_time, rating_quality, rating_communication, created_at, is_hidden, exclude_from_trust_score")
    .eq("reviewee_id", userId)
    .eq("direction", "rep_to_vendor")
    .eq("is_hidden", false)
    .eq("exclude_from_trust_score", false);

  const helpfulnessScores = (reviews || []).map(r => r.rating_on_time).filter(Boolean) as number[];
  const communicationScores = (reviews || []).map(r => r.rating_quality).filter(Boolean) as number[];
  const payScores = (reviews || []).map(r => r.rating_communication).filter(Boolean) as number[];

  const avgHelpfulness = helpfulnessScores.length > 0 
    ? helpfulnessScores.reduce((a, b) => a + b, 0) / helpfulnessScores.length 
    : 0;
  const avgCommunication = communicationScores.length > 0 
    ? communicationScores.reduce((a, b) => a + b, 0) / communicationScores.length 
    : 0;
  const avgPay = payScores.length > 0 
    ? payScores.reduce((a, b) => a + b, 0) / payScores.length 
    : 0;

  const dimensions = [
    { dimension: "Helpfulness", score: avgHelpfulness },
    { dimension: "Communication", score: avgCommunication },
    { dimension: "Consistent Pay", score: avgPay },
  ];

  const strengths = dimensions.filter(d => d.score >= 4.5).sort((a, b) => b.score - a.score);
  const weakSignals = dimensions
    .filter(d => d.score > 0 && d.score < 3.5)
    .map(d => ({ ...d, trend: "declining" }));

  // Fetch recent reports (last 90 days)
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const { data: recentReports } = await supabase
    .from("user_reports")
    .select("id, reason_category")
    .eq("reported_user_id", userId)
    .gte("created_at", ninetyDaysAgo.toISOString());

  const communicationComplaints = (recentReports || []).filter(r => 
    r.reason_category?.toLowerCase().includes("communication") ||
    r.reason_category?.toLowerCase().includes("unresponsive")
  ).length;

  return {
    strengths,
    weakSignals,
    recentReportCount: recentReports?.length || 0,
    communicationComplaints,
  };
}

/**
 * Fetch rep reputation snapshot analytics
 */
export async function fetchRepReputationSnapshot(userId: string): Promise<ReputationSnapshotData> {
  // Fetch received reviews (vendor_to_rep)
  const { data: reviews } = await supabase
    .from("reviews")
    .select("rating_on_time, rating_quality, rating_communication, created_at, comment, is_hidden, exclude_from_trust_score")
    .eq("reviewee_id", userId)
    .eq("direction", "vendor_to_rep")
    .eq("is_hidden", false)
    .eq("exclude_from_trust_score", false)
    .order("created_at", { ascending: false });

  // Group by month for history
  const monthlyData = new Map<string, { onTime: number[], quality: number[], communication: number[] }>();
  
  (reviews || []).forEach(r => {
    const month = new Date(r.created_at).toLocaleString("default", { month: "short", year: "2-digit" });
    if (!monthlyData.has(month)) {
      monthlyData.set(month, { onTime: [], quality: [], communication: [] });
    }
    const entry = monthlyData.get(month)!;
    if (r.rating_on_time) entry.onTime.push(r.rating_on_time);
    if (r.rating_quality) entry.quality.push(r.rating_quality);
    if (r.rating_communication) entry.communication.push(r.rating_communication);
  });

  const onTimeHistory = Array.from(monthlyData.entries()).map(([month, data]) => ({
    month,
    score: data.onTime.length > 0 ? data.onTime.reduce((a, b) => a + b, 0) / data.onTime.length : 0,
  })).reverse().slice(-6); // Last 6 months

  const qualityHistory = Array.from(monthlyData.entries()).map(([month, data]) => ({
    month,
    score: data.quality.length > 0 ? data.quality.reduce((a, b) => a + b, 0) / data.quality.length : 0,
  })).reverse().slice(-6);

  const communicationHistory = Array.from(monthlyData.entries()).map(([month, data]) => ({
    month,
    score: data.communication.length > 0 ? data.communication.reduce((a, b) => a + b, 0) / data.communication.length : 0,
  })).reverse().slice(-6);

  // Extract themes from recent comments
  const recentReviews = (reviews || []).slice(0, 10);
  const recentThemes: Array<{ theme: string; positive: boolean }> = [];

  recentReviews.forEach(r => {
    if (!r.comment) return;
    const comment = r.comment.toLowerCase();
    const avg = ((r.rating_on_time || 0) + (r.rating_quality || 0) + (r.rating_communication || 0)) / 3;
    const positive = avg >= 4;

    if (comment.includes("on time") || comment.includes("deadline")) {
      recentThemes.push({ theme: positive ? "Reliable with deadlines" : "Missed deadlines", positive });
    }
    if (comment.includes("communication") || comment.includes("responsive")) {
      recentThemes.push({ theme: positive ? "Great communication" : "Communication issues", positive });
    }
    if (comment.includes("quality") || comment.includes("thorough")) {
      recentThemes.push({ theme: positive ? "High-quality work" : "Quality concerns", positive });
    }
  });

  // Count active connections
  const { count: activeConnectionCount } = await supabase
    .from("vendor_connections")
    .select("*", { count: "exact", head: true })
    .eq("field_rep_id", userId)
    .eq("status", "connected");

  return {
    onTimeHistory,
    qualityHistory,
    communicationHistory,
    recentThemes: recentThemes.slice(0, 5),
    activeConnectionCount: activeConnectionCount || 0,
  };
}

/**
 * Fetch safety analytics for admins
 */
export async function fetchSafetyAnalytics(): Promise<SafetyAnalyticsData> {
  // Reports over time (last 90 days)
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const { data: allReports } = await supabase
    .from("user_reports")
    .select("created_at, target_type, status, reported_user_id")
    .gte("created_at", ninetyDaysAgo.toISOString())
    .order("created_at", { ascending: true });

  // Group by date
  const reportsByDate = new Map<string, number>();
  (allReports || []).forEach(r => {
    const date = new Date(r.created_at).toLocaleDateString();
    reportsByDate.set(date, (reportsByDate.get(date) || 0) + 1);
  });

  const reportsOverTime = Array.from(reportsByDate.entries()).map(([date, count]) => ({ date, count }));

  // Group by type
  const reportsByTypeMap = new Map<string, number>();
  (allReports || []).forEach(r => {
    const type = r.target_type || "other";
    reportsByTypeMap.set(type, (reportsByTypeMap.get(type) || 0) + 1);
  });

  const reportsByType = Array.from(reportsByTypeMap.entries()).map(([type, count]) => ({ type, count }));

  // Top reported accounts
  const reportedUserCounts = new Map<string, number>();
  (allReports || []).forEach(r => {
    if (r.reported_user_id) {
      reportedUserCounts.set(r.reported_user_id, (reportedUserCounts.get(r.reported_user_id) || 0) + 1);
    }
  });

  const topReportedUserIds = Array.from(reportedUserCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([userId, count]) => ({ userId, count }));

  // Enrich with anonymous IDs
  const topReportedAccounts = await Promise.all(
    topReportedUserIds.map(async ({ userId, count }) => {
      const { data: repProfile } = await supabase
        .from("rep_profile")
        .select("anonymous_id")
        .eq("user_id", userId)
        .maybeSingle();

      const { data: vendorProfile } = await supabase
        .from("vendor_profile")
        .select("anonymous_id")
        .eq("user_id", userId)
        .maybeSingle();

      const anonymousId = repProfile?.anonymous_id || vendorProfile?.anonymous_id || `User#${userId.substring(0, 6)}`;

      return { userId, anonymousId, count };
    })
  );

  // Calculate false positive vs upheld rates
  const resolvedReports = (allReports || []).filter(r => r.status === "resolved" || r.status === "dismissed");
  const dismissedCount = resolvedReports.filter(r => r.status === "dismissed").length;
  const resolvedCount = resolvedReports.filter(r => r.status === "resolved").length;

  const falsePositiveRate = resolvedReports.length > 0 ? (dismissedCount / resolvedReports.length) * 100 : 0;
  const upheldRate = resolvedReports.length > 0 ? (resolvedCount / resolvedReports.length) * 100 : 0;

  return {
    reportsOverTime,
    reportsByType,
    topReportedAccounts,
    falsePositiveRate,
    upheldRate,
  };
}

/**
 * Check if user should see soft warnings
 */
export async function checkSoftWarnings(userId: string, role: "rep" | "vendor"): Promise<{
  showWarning: boolean;
  warningMessage: string;
  warningType: "reports" | "reviews" | null;
}> {
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  // Check for multiple similar reports
  const { data: recentReports } = await supabase
    .from("user_reports")
    .select("reason_category, status")
    .eq("reported_user_id", userId)
    .gte("created_at", ninetyDaysAgo.toISOString());

  const dismissedSimilar = (recentReports || []).filter(r => r.status === "dismissed");
  
  if (role === "vendor" && dismissedSimilar.length >= 3) {
    const slowPayCount = dismissedSimilar.filter(r => 
      r.reason_category?.toLowerCase().includes("pay") || 
      r.reason_category?.toLowerCase().includes("payment")
    ).length;

    if (slowPayCount >= 2) {
      return {
        showWarning: true,
        warningMessage: "Heads up: multiple reps have mentioned delayed pay. Consider updating your expectations or FAQ to avoid misunderstandings.",
        warningType: "reports",
      };
    }
  }

  // Check for review patterns
  const direction = role === "vendor" ? "rep_to_vendor" : "vendor_to_rep";
  const { data: recentReviews } = await supabase
    .from("reviews")
    .select("rating_on_time, comment")
    .eq("reviewee_id", userId)
    .eq("direction", direction)
    .gte("created_at", ninetyDaysAgo.toISOString());

  if (role === "rep") {
    const lowOnTimeCount = (recentReviews || []).filter(r => r.rating_on_time && r.rating_on_time < 3).length;
    if (lowOnTimeCount >= 2) {
      return {
        showWarning: true,
        warningMessage: "Recent reviews mention missed due dates—updating your availability in Find Work can help maintain your Trust Score.",
        warningType: "reviews",
      };
    }
  }

  return { showWarning: false, warningMessage: "", warningType: null };
}
