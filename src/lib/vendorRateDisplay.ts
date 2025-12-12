/**
 * Helper function to format vendor-offered rates for display.
 * Used in vendor-facing UIs for Seeking Coverage posts.
 * 
 * Rate storage convention:
 * - Fixed rate: min_rate=0 (or null), max_rate=fixedAmount
 * - Range: min_rate=minAmount, max_rate=maxAmount
 */
export function formatVendorOfferedRate(
  payMin: number | null | undefined,
  payMax: number | null | undefined,
  payType?: string | null
): string {
  // For fixed rate (pay_type === "fixed" or min_rate is 0/null and max_rate is set)
  const isFixed = payType === "fixed" || ((!payMin || payMin === 0) && payMax != null);
  
  if (isFixed && payMax != null) {
    return `$${payMax.toFixed(2)} / order`;
  }
  
  // Range: both min and max are meaningful values
  if (payMin != null && payMax != null && payMin !== payMax && payMin > 0) {
    return `$${payMin.toFixed(2)} – $${payMax.toFixed(2)} / order`;
  }
  
  // Fallback to max if only max is set
  if (payMax != null) {
    return `$${payMax.toFixed(2)} / order`;
  }
  
  // Fallback to min if only min is set
  if (payMin != null && payMin > 0) {
    return `$${payMin.toFixed(2)} / order`;
  }
  
  return "Not set";
}
