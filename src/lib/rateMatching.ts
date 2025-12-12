/**
 * Rate matching utilities for Seeking Coverage posts
 * 
 * Matching rule:
 * - For range posts (pay_min and pay_max set): rep_base_rate must be within range
 *   pay_min <= rep_base_rate <= pay_max
 * - For fixed posts (only pay_max set, pay_min is null or 0): rep_base_rate must be <= pay_max
 *   This treats the fixed amount as "up to X"
 */

/**
 * Near-miss threshold for Match Assistant.
 * Shows opportunities where the vendor's max rate is below the rep's base rate by this percentage or less.
 * 0.30 = 30%
 */
export const NEAR_MISS_THRESHOLD = 0.30;

/**
 * Determines if a rep's base rate matches a post's offered rate range.
 * 
 * @param repRate - The rep's base rate for the county
 * @param payMin - The post's minimum pay (null for fixed-rate posts)
 * @param payMax - The post's maximum pay (the fixed amount for fixed-rate posts)
 * @returns true if the rep's rate qualifies for this opportunity
 * 
 * Test cases:
 * - repRate = 10, payMin = 0, payMax = 8 → false (rep wants more than vendor offers)
 * - repRate = 8, payMin = 0, payMax = 8 → true (exact match)
 * - repRate = 7, payMin = 5, payMax = 10 → true (within range)
 * - repRate = 4, payMin = 5, payMax = 10 → false (below minimum)
 * - repRate = 11, payMin = 5, payMax = 10 → false (above maximum)
 * - repRate = 5, payMin = null, payMax = 10 → true (fixed post, rep within "up to")
 */
export function doesPostMatchRepRate(
  repRate: number | null | undefined,
  payMin: number | null | undefined,
  payMax: number | null | undefined
): boolean {
  // If rep has no rate set, we can't match
  if (repRate === null || repRate === undefined) {
    return false;
  }

  // If post has no max pay set, we can't determine matching
  if (payMax === null || payMax === undefined) {
    return false;
  }

  // Treat null/undefined min as 0 (for fixed-rate posts)
  const effectiveMin = payMin ?? 0;
  const effectiveMax = payMax;

  // Rep's rate must be within the vendor's pay range
  // For fixed posts (effectiveMin = 0): just check repRate <= effectiveMax
  // For range posts: check effectiveMin <= repRate <= effectiveMax
  return effectiveMin <= repRate && repRate <= effectiveMax;
}

/**
 * Rate match label types for rep-facing UI
 */
export type RateMatchLabel = 
  | "matches" 
  | "above" 
  | "below" 
  | "unknown";

/**
 * Determines the relative rate match status for rep-facing display.
 * Never reveals vendor's numeric rate.
 * 
 * Rules:
 * - If vendor offer == rep base rate: "Matches your rate"
 * - If vendor offer > rep base rate: "Above your rate"
 * - If vendor offer < rep base rate: "Below your rate"
 * - If rep has no base rate: "Rate match unknown"
 */
export function getRelativeRateMatchLabel(
  repRate: number | null | undefined,
  payMin: number | null | undefined,
  payMax: number | null | undefined
): RateMatchLabel {
  // If rep has no rate set, we can't compare
  if (repRate === null || repRate === undefined) {
    return "unknown";
  }

  // If post has no max pay set, we can't determine matching
  if (payMax === null || payMax === undefined) {
    return "unknown";
  }

  // For range posts, use max as the "offer" level
  // For fixed posts (min is 0 or null), max is the fixed amount
  const effectiveMin = payMin ?? 0;
  
  // If rep rate is within range - it matches
  if (effectiveMin <= repRate && repRate <= payMax) {
    return "matches";
  }
  
  // If rep rate is below the minimum offered - vendor is offering more
  if (repRate < effectiveMin) {
    return "above";
  }
  
  // If rep rate is above the max - vendor is offering less
  return "below";
}

/**
 * Gets human-readable status text for rep-facing UI
 */
export function getRateMatchStatusText(label: RateMatchLabel): {
  label: string;
  subMessage: string;
  showPrompt?: boolean;
} {
  switch (label) {
    case "matches":
      return {
        label: "Matches your rate",
        subMessage: "This opportunity aligns with your pricing.",
      };
    case "above":
      return {
        label: "Above your rate",
        subMessage: "This opportunity is above your base rate.",
      };
    case "below":
      return {
        label: "Below your rate",
        subMessage: "This opportunity is below your base rate.",
      };
    case "unknown":
      return {
        label: "Rate match unknown",
        subMessage: "You haven't set a base rate for this area yet.",
        showPrompt: true,
      };
  }
}

/**
 * Gets a human-readable description of the rate match status for rep views.
 * This is used to display messaging without revealing vendor's rate range.
 * @deprecated Use getRelativeRateMatchLabel and getRateMatchStatusText instead
 */
export function getRateMatchStatus(
  repRate: number | null | undefined,
  payMin: number | null | undefined,
  payMax: number | null | undefined
): { matches: boolean; message: string; subMessage: string } {
  const label = getRelativeRateMatchLabel(repRate, payMin, payMax);
  const status = getRateMatchStatusText(label);
  
  return {
    matches: label === "matches" || label === "above",
    message: status.label,
    subMessage: repRate !== null && repRate !== undefined
      ? `Your base rate: $${repRate.toFixed(2)} / order. ${status.subMessage}`
      : status.subMessage,
  };
}
