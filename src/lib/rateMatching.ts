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
 * Gets a human-readable description of the rate match status for rep views.
 * This is used to display messaging without revealing vendor's rate range.
 */
export function getRateMatchStatus(
  repRate: number | null | undefined,
  payMin: number | null | undefined,
  payMax: number | null | undefined
): { matches: boolean; message: string; subMessage: string } {
  const matches = doesPostMatchRepRate(repRate, payMin, payMax);

  if (matches) {
    return {
      matches: true,
      message: "Pay matches your base rate for this county",
      subMessage: repRate !== null && repRate !== undefined
        ? `Your base rate here: $${repRate.toFixed(2)} / order`
        : "This opportunity meets your pricing for this county.",
    };
  }

  // If doesn't match, give appropriate messaging
  if (repRate === null || repRate === undefined) {
    return {
      matches: false,
      message: "Rate match unknown",
      subMessage: "You haven't set a base rate for this coverage area.",
    };
  }

  if (payMax === null || payMax === undefined) {
    return {
      matches: false,
      message: "Rate information unavailable",
      subMessage: "This post doesn't have complete pricing information.",
    };
  }

  // Rep's rate is too high for this post
  return {
    matches: false,
    message: "Offered pay is below your base rate",
    subMessage: `Your base rate here: $${repRate.toFixed(2)} / order. This post doesn't meet your minimum.`,
  };
}
