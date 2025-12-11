import { supabase } from "@/integrations/supabase/client";
import { doesPostMatchRepRate } from "./rateMatching";

export interface RepRateAnalysis {
  totalReps: number;
  rateMatches: number;
  rateTooHigh: number;
  noRateSet: number;
  minRepRate: number | null;
  medianRepRate: number | null;
  maxRepRate: number | null;
}

export interface PostPricingIssue {
  postId: string;
  postTitle: string;
  stateCode: string | null;
  countyName: string | null;
  coversEntireState: boolean;
  payMin: number | null;
  payMax: number | null;
  payType: string | null;
  createdAt: string;
  analysis: RepRateAnalysis;
}

/**
 * Analyzes rep rates for a specific seeking coverage post.
 * Returns breakdown of reps who match vs are outpriced.
 */
export async function analyzeRepRatesForPost(
  stateCode: string | null,
  countyId: string | null,
  coversEntireState: boolean,
  payMin: number | null,
  payMax: number | null
): Promise<RepRateAnalysis> {
  if (!stateCode) {
    return {
      totalReps: 0,
      rateMatches: 0,
      rateTooHigh: 0,
      noRateSet: 0,
      minRepRate: null,
      medianRepRate: null,
      maxRepRate: null,
    };
  }

  // Build query to find reps with coverage in this area
  let query = supabase
    .from("rep_coverage_areas")
    .select("user_id, base_price, county_id, covers_entire_state")
    .eq("state_code", stateCode);

  const { data: repCoverage, error } = await query;

  if (error || !repCoverage) {
    console.error("Error fetching rep coverage:", error);
    return {
      totalReps: 0,
      rateMatches: 0,
      rateTooHigh: 0,
      noRateSet: 0,
      minRepRate: null,
      medianRepRate: null,
      maxRepRate: null,
    };
  }

  // Filter to reps that match the area
  const matchingReps = repCoverage.filter((rep) => {
    // If post covers entire state, any rep in state matches
    if (coversEntireState) return true;
    // If rep covers entire state, they match any county in state
    if (rep.covers_entire_state) return true;
    // If post is county-specific, check county match
    if (countyId && rep.county_id) {
      return rep.county_id === countyId;
    }
    // If post has no county, any rep in state matches
    if (!countyId) return true;
    return false;
  });

  // Deduplicate by user_id (a rep might have multiple coverage rows)
  const repRatesMap = new Map<string, number | null>();
  for (const rep of matchingReps) {
    const existing = repRatesMap.get(rep.user_id);
    // Keep the rate for the most specific match
    if (existing === undefined || (rep.base_price != null && existing === null)) {
      repRatesMap.set(rep.user_id, rep.base_price);
    }
  }

  const totalReps = repRatesMap.size;
  let rateMatches = 0;
  let rateTooHigh = 0;
  let noRateSet = 0;
  const outpricedRates: number[] = [];

  for (const [, basePrice] of repRatesMap) {
    if (basePrice == null || basePrice <= 0) {
      noRateSet++;
      continue;
    }

    if (doesPostMatchRepRate(basePrice, payMin, payMax)) {
      rateMatches++;
    } else {
      // Rep's rate is higher than vendor's max
      rateTooHigh++;
      outpricedRates.push(basePrice);
    }
  }

  // Calculate stats for outpriced reps
  outpricedRates.sort((a, b) => a - b);
  const minRepRate = outpricedRates.length > 0 ? outpricedRates[0] : null;
  const maxRepRate = outpricedRates.length > 0 ? outpricedRates[outpricedRates.length - 1] : null;
  const medianRepRate = outpricedRates.length > 0
    ? outpricedRates[Math.floor(outpricedRates.length / 2)]
    : null;

  return {
    totalReps,
    rateMatches,
    rateTooHigh,
    noRateSet,
    minRepRate,
    medianRepRate,
    maxRepRate,
  };
}

/**
 * Analyzes all active seeking coverage posts for a vendor
 * and returns those with pricing issues (reps exist but are outpriced).
 */
export async function analyzeVendorPostsPricing(
  vendorId: string
): Promise<PostPricingIssue[]> {
  // Fetch all active posts for this vendor
  const { data: posts, error: postsError } = await supabase
    .from("seeking_coverage_posts")
    .select(`
      id,
      title,
      state_code,
      county_id,
      covers_entire_state,
      pay_min,
      pay_max,
      pay_type,
      created_at
    `)
    .eq("vendor_id", vendorId)
    .eq("status", "active")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (postsError || !posts) {
    console.error("Error fetching vendor posts:", postsError);
    return [];
  }

  // Fetch county names
  const countyIds = posts.filter((p) => p.county_id).map((p) => p.county_id);
  const { data: counties } = countyIds.length > 0
    ? await supabase.from("us_counties").select("id, county_name").in("id", countyIds)
    : { data: [] };

  const countyNameMap: Record<string, string> = {};
  (counties || []).forEach((c) => {
    countyNameMap[c.id] = c.county_name;
  });

  const issues: PostPricingIssue[] = [];

  for (const post of posts) {
    const analysis = await analyzeRepRatesForPost(
      post.state_code,
      post.county_id,
      post.covers_entire_state,
      post.pay_min,
      post.pay_max
    );

    // Only include if there are outpriced reps and no rate matches
    if (analysis.rateTooHigh > 0 && analysis.rateMatches === 0) {
      issues.push({
        postId: post.id,
        postTitle: post.title,
        stateCode: post.state_code,
        countyName: post.county_id ? countyNameMap[post.county_id] : null,
        coversEntireState: post.covers_entire_state,
        payMin: post.pay_min,
        payMax: post.pay_max,
        payType: post.pay_type,
        createdAt: post.created_at,
        analysis,
      });
    }
  }

  return issues;
}
