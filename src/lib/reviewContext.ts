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

/**
 * Aggregate reviews by area for display
 */
export interface AreaReviewAggregate {
  stateCode: string;
  countyName: string | null;
  locationLabel: string;
  reviewCount: number;
  avgOnTime: number;
  avgQuality: number;
  avgCommunication: number;
}

export async function aggregateReviewsByArea(
  userId: string
): Promise<AreaReviewAggregate[]> {
  const { data: reviews, error } = await supabase
    .from("reviews")
    .select("state_code, county_name, rating_on_time, rating_quality, rating_communication")
    .eq("reviewee_id", userId)
    .eq("direction", "vendor_to_rep")
    .eq("is_feedback", false)
    .eq("is_hidden", false)
    .not("state_code", "is", null);

  if (error || !reviews?.length) {
    return [];
  }

  // Group by state + county
  const groups = new Map<string, {
    stateCode: string;
    countyName: string | null;
    onTimeSum: number;
    qualitySum: number;
    commSum: number;
    count: number;
  }>();

  for (const r of reviews) {
    const key = `${r.state_code}|${r.county_name || ""}`;
    const existing = groups.get(key);
    
    if (existing) {
      existing.onTimeSum += r.rating_on_time || 0;
      existing.qualitySum += r.rating_quality || 0;
      existing.commSum += r.rating_communication || 0;
      existing.count += 1;
    } else {
      groups.set(key, {
        stateCode: r.state_code!,
        countyName: r.county_name || null,
        onTimeSum: r.rating_on_time || 0,
        qualitySum: r.rating_quality || 0,
        commSum: r.rating_communication || 0,
        count: 1,
      });
    }
  }

  // Convert to array with averages
  return Array.from(groups.values()).map((g) => ({
    stateCode: g.stateCode,
    countyName: g.countyName,
    locationLabel: g.countyName 
      ? `${g.countyName}, ${g.stateCode}` 
      : g.stateCode,
    reviewCount: g.count,
    avgOnTime: g.onTimeSum / g.count,
    avgQuality: g.qualitySum / g.count,
    avgCommunication: g.commSum / g.count,
  })).sort((a, b) => b.reviewCount - a.reviewCount);
}

/**
 * Aggregate reviews by inspection type for display
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
}

export async function aggregateReviewsByInspectionType(
  userId: string
): Promise<InspectionTypeReviewAggregate[]> {
  // Get reviews with context
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
    .eq("is_feedback", false)
    .eq("is_hidden", false)
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
    qualitySum: number;
    commSum: number;
    count: number;
  }>();

  for (const r of reviews) {
    const key = r.inspection_type_id || r.inspection_category || "unknown";
    const existing = groups.get(key);
    
    if (existing) {
      existing.onTimeSum += r.rating_on_time || 0;
      existing.qualitySum += r.rating_quality || 0;
      existing.commSum += r.rating_communication || 0;
      existing.count += 1;
    } else {
      groups.set(key, {
        inspectionTypeId: r.inspection_type_id || null,
        inspectionCategory: r.inspection_category || null,
        onTimeSum: r.rating_on_time || 0,
        qualitySum: r.rating_quality || 0,
        commSum: r.rating_communication || 0,
        count: 1,
      });
    }
  }

  // Convert to array with averages
  return Array.from(groups.values()).map((g) => ({
    inspectionTypeId: g.inspectionTypeId,
    inspectionCategory: g.inspectionCategory,
    typeLabel: g.inspectionTypeId 
      ? typeLabels.get(g.inspectionTypeId) || "Unknown Type"
      : "",
    categoryLabel: g.inspectionCategory || "Not specified",
    reviewCount: g.count,
    avgOnTime: g.onTimeSum / g.count,
    avgQuality: g.qualitySum / g.count,
    avgCommunication: g.commSum / g.count,
  })).sort((a, b) => b.reviewCount - a.reviewCount);
}
