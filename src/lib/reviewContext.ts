import { supabase } from "@/integrations/supabase/client";

export interface ReviewContext {
  stateCode: string | null;
  countyName: string | null;
  zipCode: string | null;
  inspectionCategory: string | null;
  inspectionTypeId: string | null;
}

/**
 * Derive review context from a rep_interest record (connection via Seeking Coverage)
 */
export async function deriveContextFromRepInterest(
  repInterestId: string
): Promise<{ context: ReviewContext; source: string | null }> {
  const emptyContext: ReviewContext = {
    stateCode: null,
    countyName: null,
    zipCode: null,
    inspectionCategory: null,
    inspectionTypeId: null,
  };

  try {
    // Get the rep_interest with linked post
    const { data: interest, error } = await supabase
      .from("rep_interest")
      .select(`
        id,
        post_id,
        seeking_coverage_posts (
          id,
          state_code,
          county_name,
          zip_code,
          inspection_types,
          inspection_category
        )
      `)
      .eq("id", repInterestId)
      .maybeSingle();

    if (error || !interest) {
      return { context: emptyContext, source: null };
    }

    const post = interest.seeking_coverage_posts as any;
    if (!post) {
      return { context: emptyContext, source: null };
    }

    // Extract first inspection type ID if available
    let inspectionTypeId: string | null = null;
    if (post.inspection_types && Array.isArray(post.inspection_types) && post.inspection_types.length > 0) {
      inspectionTypeId = post.inspection_types[0];
    }

    return {
      context: {
        stateCode: post.state_code || null,
        countyName: post.county_name || null,
        zipCode: post.zip_code || null,
        inspectionCategory: post.inspection_category || null,
        inspectionTypeId,
      },
      source: "Seeking Coverage post",
    };
  } catch (err) {
    console.error("Error deriving context from rep_interest:", err);
    return { context: emptyContext, source: null };
  }
}

/**
 * Derive review context from a territory assignment
 * Note: This function returns empty context if territory_assignments table doesn't exist
 */
export async function deriveContextFromTerritoryAssignment(
  repUserId: string,
  vendorUserId: string
): Promise<{ context: ReviewContext; source: string | null }> {
  const emptyContext: ReviewContext = {
    stateCode: null,
    countyName: null,
    zipCode: null,
    inspectionCategory: null,
    inspectionTypeId: null,
  };

  try {
    // Try to find territory assignment - table may not exist in all environments
    const response = await supabase
      .from("territory_assignments" as any)
      .select("id, state_code, county_name, inspection_category")
      .eq("rep_user_id", repUserId)
      .eq("vendor_user_id", vendorUserId)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const assignment = response.data as any;
    if (response.error || !assignment) {
      return { context: emptyContext, source: null };
    }

    return {
      context: {
        stateCode: assignment.state_code || null,
        countyName: assignment.county_name || null,
        zipCode: null,
        inspectionCategory: assignment.inspection_category || null,
        inspectionTypeId: null,
      },
      source: "territory assignment",
    };
  } catch (err) {
    console.error("Error deriving context from territory assignment:", err);
    return { context: emptyContext, source: null };
  }
}

/**
 * Derive review context from shared coverage areas between vendor and rep
 */
export async function deriveContextFromSharedCoverage(
  repUserId: string,
  vendorUserId: string
): Promise<{ context: ReviewContext; source: string | null }> {
  const emptyContext: ReviewContext = {
    stateCode: null,
    countyName: null,
    zipCode: null,
    inspectionCategory: null,
    inspectionTypeId: null,
  };

  try {
    // Get rep's coverage areas
    const { data: repCoverage } = await supabase
      .from("rep_coverage_areas")
      .select("state_code, county_name, inspection_types")
      .eq("user_id", repUserId);

    // Get vendor's coverage areas
    const { data: vendorCoverage } = await supabase
      .from("vendor_coverage_areas")
      .select("state_code, county_name, inspection_types")
      .eq("user_id", vendorUserId);

    if (!repCoverage?.length || !vendorCoverage?.length) {
      return { context: emptyContext, source: null };
    }

    // Find overlapping state/county combinations
    const repStates = new Set(repCoverage.map((c) => c.state_code));
    const vendorStates = new Set(vendorCoverage.map((c) => c.state_code));
    const sharedStates = [...repStates].filter((s) => vendorStates.has(s));

    if (sharedStates.length === 1) {
      // Single shared state - use it
      const stateCode = sharedStates[0];
      
      // Find shared counties in this state
      const repCounties = repCoverage
        .filter((c) => c.state_code === stateCode)
        .map((c) => c.county_name)
        .filter(Boolean);
      const vendorCounties = vendorCoverage
        .filter((c) => c.state_code === stateCode)
        .map((c) => c.county_name)
        .filter(Boolean);
      
      const sharedCounties = repCounties.filter((c) => vendorCounties.includes(c));
      
      return {
        context: {
          stateCode,
          countyName: sharedCounties.length === 1 ? sharedCounties[0] : null,
          zipCode: null,
          inspectionCategory: null,
          inspectionTypeId: null,
        },
        source: "shared coverage area",
      };
    }

    return { context: emptyContext, source: null };
  } catch (err) {
    console.error("Error deriving context from shared coverage:", err);
    return { context: emptyContext, source: null };
  }
}

/**
 * Auto-derive review context trying multiple sources in priority order
 */
export async function autoFillReviewContext(
  repUserId: string,
  vendorUserId: string,
  repInterestId?: string | null
): Promise<{ context: ReviewContext; source: string | null }> {
  // 1. Try rep_interest (Seeking Coverage post) first
  if (repInterestId) {
    const result = await deriveContextFromRepInterest(repInterestId);
    if (result.source) {
      return result;
    }
  }

  // 2. Try territory assignment
  const assignmentResult = await deriveContextFromTerritoryAssignment(repUserId, vendorUserId);
  if (assignmentResult.source) {
    return assignmentResult;
  }

  // 3. Try shared coverage areas
  const sharedResult = await deriveContextFromSharedCoverage(repUserId, vendorUserId);
  if (sharedResult.source) {
    return sharedResult;
  }

  // No context available
  return {
    context: {
      stateCode: null,
      countyName: null,
      zipCode: null,
      inspectionCategory: null,
      inspectionTypeId: null,
    },
    source: null,
  };
}

// ============================================
// LOCAL FIT SCORE TYPES & FUNCTIONS
// ============================================

export interface LocalFitScore {
  localAvgOverall: number;
  localAvgOnTime: number;
  localAvgQuality: number;
  localAvgCommunication: number;
  localReviewCount: number;
}

export interface LocalFitScoreParams {
  userIds: string[];
  stateCode: string;
  countyName?: string | null;
  inspectionCategory?: string | null;
}

/**
 * Minimum number of reviews required to display a Local Fit Score
 */
export const LOCAL_FIT_MIN_REVIEWS = 3;

/**
 * Fetch Local Fit Scores for multiple users in a specific location.
 * 
 * IMPORTANT: Uses the same exclusion filters as Trust Score:
 * - workflow_status = 'accepted'
 * - exclude_from_trust_score = false
 * - is_hidden = false
 * - is_feedback = false
 * - status != 'coaching'
 * 
 * PLUS location filters (state_code, county_name, inspection_category)
 * 
 * NOTE: Does NOT include vendor_alert_kudos boost (local score is review-only)
 */
export async function fetchLocalFitScoresForUsers(
  params: LocalFitScoreParams
): Promise<Record<string, LocalFitScore>> {
  const { userIds, stateCode, countyName, inspectionCategory } = params;
  
  if (userIds.length === 0 || !stateCode) return {};

  // Build query with Trust Score exclusion filters
  let query = supabase
    .from("reviews")
    .select(`
      reviewee_id,
      rating_on_time,
      rating_quality,
      rating_communication
    `)
    .in("reviewee_id", userIds)
    .eq("workflow_status", "accepted")
    .eq("exclude_from_trust_score", false)
    .eq("is_hidden", false)
    .eq("is_feedback", false)
    .neq("status", "coaching")
    // Location filters
    .eq("state_code", stateCode);

  // Add county filter if provided
  if (countyName) {
    query = query.eq("county_name", countyName);
  }

  // Add inspection category filter if provided
  if (inspectionCategory) {
    query = query.eq("inspection_category", inspectionCategory);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching local fit scores:", error);
    return {};
  }

  // Aggregate scores by user
  const aggregates: Record<string, {
    onTimeSum: number;
    onTimeCount: number;
    qualitySum: number;
    qualityCount: number;
    commSum: number;
    commCount: number;
    totalReviews: number;
  }> = {};

  for (const row of data || []) {
    const key = row.reviewee_id;
    
    if (!aggregates[key]) {
      aggregates[key] = {
        onTimeSum: 0,
        onTimeCount: 0,
        qualitySum: 0,
        qualityCount: 0,
        commSum: 0,
        commCount: 0,
        totalReviews: 0,
      };
    }

    aggregates[key].totalReviews += 1;

    if (typeof row.rating_on_time === "number") {
      aggregates[key].onTimeSum += row.rating_on_time;
      aggregates[key].onTimeCount += 1;
    }
    if (typeof row.rating_quality === "number") {
      aggregates[key].qualitySum += row.rating_quality;
      aggregates[key].qualityCount += 1;
    }
    if (typeof row.rating_communication === "number") {
      aggregates[key].commSum += row.rating_communication;
      aggregates[key].commCount += 1;
    }
  }

  // Convert to final scores
  const result: Record<string, LocalFitScore> = {};
  
  for (const [userId, agg] of Object.entries(aggregates)) {
    const avgOnTime = agg.onTimeCount > 0 ? agg.onTimeSum / agg.onTimeCount : 0;
    const avgQuality = agg.qualityCount > 0 ? agg.qualitySum / agg.qualityCount : 0;
    const avgComm = agg.commCount > 0 ? agg.commSum / agg.commCount : 0;
    
    // Overall is average of the three dimensions that have data
    const validScores = [avgOnTime, avgQuality, avgComm].filter(s => s > 0);
    const avgOverall = validScores.length > 0
      ? validScores.reduce((a, b) => a + b, 0) / validScores.length
      : 0;

    result[userId] = {
      localAvgOverall: avgOverall,
      localAvgOnTime: avgOnTime,
      localAvgQuality: avgQuality,
      localAvgCommunication: avgComm,
      localReviewCount: agg.totalReviews,
    };
  }

  return result;
}

// ============================================
// AREA & INSPECTION TYPE AGGREGATION
// ============================================

/**
 * Aggregate reviews by area for display
 * 
 * IMPORTANT: Uses the same exclusion filters as Trust Score
 */
export interface AreaReviewAggregate {
  stateCode: string;
  countyName: string | null;
  locationLabel: string;
  reviewCount: number;
  avgOnTime: number;
  avgQuality: number;
  avgCommunication: number;
  avgOverall: number;
  meetsMinimum: boolean; // true if reviewCount >= LOCAL_FIT_MIN_REVIEWS
}

export async function aggregateReviewsByArea(
  userId: string
): Promise<AreaReviewAggregate[]> {
  // Apply Trust Score exclusion filters
  const { data: reviews, error } = await supabase
    .from("reviews")
    .select("state_code, county_name, rating_on_time, rating_quality, rating_communication")
    .eq("reviewee_id", userId)
    .eq("direction", "vendor_to_rep")
    .eq("workflow_status", "accepted")
    .eq("exclude_from_trust_score", false)
    .eq("is_hidden", false)
    .eq("is_feedback", false)
    .neq("status", "coaching")
    .not("state_code", "is", null);

  if (error || !reviews?.length) {
    return [];
  }

  // Group by state + county
  const groups = new Map<string, {
    stateCode: string;
    countyName: string | null;
    onTimeSum: number;
    onTimeCount: number;
    qualitySum: number;
    qualityCount: number;
    commSum: number;
    commCount: number;
    count: number;
  }>();

  for (const r of reviews) {
    const key = `${r.state_code}|${r.county_name || ""}`;
    const existing = groups.get(key);
    
    if (existing) {
      existing.count += 1;
      if (typeof r.rating_on_time === "number") {
        existing.onTimeSum += r.rating_on_time;
        existing.onTimeCount += 1;
      }
      if (typeof r.rating_quality === "number") {
        existing.qualitySum += r.rating_quality;
        existing.qualityCount += 1;
      }
      if (typeof r.rating_communication === "number") {
        existing.commSum += r.rating_communication;
        existing.commCount += 1;
      }
    } else {
      groups.set(key, {
        stateCode: r.state_code!,
        countyName: r.county_name || null,
        onTimeSum: typeof r.rating_on_time === "number" ? r.rating_on_time : 0,
        onTimeCount: typeof r.rating_on_time === "number" ? 1 : 0,
        qualitySum: typeof r.rating_quality === "number" ? r.rating_quality : 0,
        qualityCount: typeof r.rating_quality === "number" ? 1 : 0,
        commSum: typeof r.rating_communication === "number" ? r.rating_communication : 0,
        commCount: typeof r.rating_communication === "number" ? 1 : 0,
        count: 1,
      });
    }
  }

  // Convert to array with averages
  return Array.from(groups.values()).map((g) => {
    const avgOnTime = g.onTimeCount > 0 ? g.onTimeSum / g.onTimeCount : 0;
    const avgQuality = g.qualityCount > 0 ? g.qualitySum / g.qualityCount : 0;
    const avgComm = g.commCount > 0 ? g.commSum / g.commCount : 0;
    
    const validScores = [avgOnTime, avgQuality, avgComm].filter(s => s > 0);
    const avgOverall = validScores.length > 0
      ? validScores.reduce((a, b) => a + b, 0) / validScores.length
      : 0;

    return {
      stateCode: g.stateCode,
      countyName: g.countyName,
      locationLabel: g.countyName 
        ? `${g.countyName}, ${g.stateCode}` 
        : g.stateCode,
      reviewCount: g.count,
      avgOnTime,
      avgQuality,
      avgCommunication: avgComm,
      avgOverall,
      meetsMinimum: g.count >= LOCAL_FIT_MIN_REVIEWS,
    };
  }).sort((a, b) => b.reviewCount - a.reviewCount);
}

/**
 * Aggregate reviews by inspection type for display
 * 
 * IMPORTANT: Uses the same exclusion filters as Trust Score
 */
export interface InspectionTypeReviewAggregate {
  inspectionTypeId: string | null;
  inspectionCategory: string | null;
  typeLabel: string;
  categoryLabel: string;
  reviewCount: number;
  avgOnTime: number;
  avgQuality: number;
  avgCommunication: number;
  avgOverall: number;
  meetsMinimum: boolean;
}

export async function aggregateReviewsByInspectionType(
  userId: string
): Promise<InspectionTypeReviewAggregate[]> {
  // Apply Trust Score exclusion filters
  const { data: reviews, error } = await supabase
    .from("reviews")
    .select(`
      inspection_type_id,
      inspection_category,
      rating_on_time,
      rating_quality,
      rating_communication
    `)
    .eq("reviewee_id", userId)
    .eq("direction", "vendor_to_rep")
    .eq("workflow_status", "accepted")
    .eq("exclude_from_trust_score", false)
    .eq("is_hidden", false)
    .eq("is_feedback", false)
    .neq("status", "coaching")
    .or("inspection_type_id.not.is.null,inspection_category.not.is.null");

  if (error || !reviews?.length) {
    return [];
  }

  // Fetch inspection type labels
  const typeIds = [...new Set(reviews.map((r) => r.inspection_type_id).filter(Boolean))];
  let typeLabels = new Map<string, string>();
  
  if (typeIds.length > 0) {
    const { data: types } = await supabase
      .from("inspection_type_options")
      .select("id, label")
      .in("id", typeIds);
    
    (types || []).forEach((t: any) => {
      typeLabels.set(t.id, t.label);
    });
  }

  // Group by inspection_type_id or inspection_category
  const groups = new Map<string, {
    inspectionTypeId: string | null;
    inspectionCategory: string | null;
    onTimeSum: number;
    onTimeCount: number;
    qualitySum: number;
    qualityCount: number;
    commSum: number;
    commCount: number;
    count: number;
  }>();

  for (const r of reviews) {
    const key = r.inspection_type_id || r.inspection_category || "unknown";
    const existing = groups.get(key);
    
    if (existing) {
      existing.count += 1;
      if (typeof r.rating_on_time === "number") {
        existing.onTimeSum += r.rating_on_time;
        existing.onTimeCount += 1;
      }
      if (typeof r.rating_quality === "number") {
        existing.qualitySum += r.rating_quality;
        existing.qualityCount += 1;
      }
      if (typeof r.rating_communication === "number") {
        existing.commSum += r.rating_communication;
        existing.commCount += 1;
      }
    } else {
      groups.set(key, {
        inspectionTypeId: r.inspection_type_id || null,
        inspectionCategory: r.inspection_category || null,
        onTimeSum: typeof r.rating_on_time === "number" ? r.rating_on_time : 0,
        onTimeCount: typeof r.rating_on_time === "number" ? 1 : 0,
        qualitySum: typeof r.rating_quality === "number" ? r.rating_quality : 0,
        qualityCount: typeof r.rating_quality === "number" ? 1 : 0,
        commSum: typeof r.rating_communication === "number" ? r.rating_communication : 0,
        commCount: typeof r.rating_communication === "number" ? 1 : 0,
        count: 1,
      });
    }
  }

  // Convert to array with averages
  return Array.from(groups.values()).map((g) => {
    const avgOnTime = g.onTimeCount > 0 ? g.onTimeSum / g.onTimeCount : 0;
    const avgQuality = g.qualityCount > 0 ? g.qualitySum / g.qualityCount : 0;
    const avgComm = g.commCount > 0 ? g.commSum / g.commCount : 0;
    
    const validScores = [avgOnTime, avgQuality, avgComm].filter(s => s > 0);
    const avgOverall = validScores.length > 0
      ? validScores.reduce((a, b) => a + b, 0) / validScores.length
      : 0;

    return {
      inspectionTypeId: g.inspectionTypeId,
      inspectionCategory: g.inspectionCategory,
      typeLabel: g.inspectionTypeId 
        ? typeLabels.get(g.inspectionTypeId) || "Unknown Type"
        : "",
      categoryLabel: g.inspectionCategory || "Not specified",
      reviewCount: g.count,
      avgOnTime,
      avgQuality,
      avgCommunication: avgComm,
      avgOverall,
      meetsMinimum: g.count >= LOCAL_FIT_MIN_REVIEWS,
    };
  }).sort((a, b) => b.reviewCount - a.reviewCount);
}
