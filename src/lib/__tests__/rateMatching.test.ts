/**
 * Test cases for rate matching logic
 * These are documentation/sanity check tests - can be run manually
 */

import { doesPostMatchRepRate } from "../rateMatching";

// Test cases as specified in the requirements
const testCases = [
  // repRate = 10, payMin = 0, payMax = 8 → false (rep wants $10, vendor only offers up to $8)
  { repRate: 10, payMin: 0, payMax: 8, expected: false, description: "rep $10 vs vendor up to $8" },
  
  // repRate = 8, payMin = 0, payMax = 8 → true (exact match at ceiling)
  { repRate: 8, payMin: 0, payMax: 8, expected: true, description: "rep $8 vs vendor up to $8 (exact)" },
  
  // repRate = 7, payMin = 5, payMax = 10 → true (within range)
  { repRate: 7, payMin: 5, payMax: 10, expected: true, description: "rep $7 within $5-$10 range" },
  
  // repRate = 4, payMin = 5, payMax = 10 → false (below minimum)
  { repRate: 4, payMin: 5, payMax: 10, expected: false, description: "rep $4 below $5 minimum" },
  
  // repRate = 11, payMin = 5, payMax = 10 → false (above maximum)
  { repRate: 11, payMin: 5, payMax: 10, expected: false, description: "rep $11 above $10 maximum" },
  
  // Fixed post (null min) - repRate = 5, payMax = 10 → true
  { repRate: 5, payMin: null, payMax: 10, expected: true, description: "fixed post: rep $5 vs up to $10" },
  
  // No rep rate set
  { repRate: null, payMin: 0, payMax: 8, expected: false, description: "no rep rate set" },
  
  // No max pay set
  { repRate: 10, payMin: 5, payMax: null, expected: false, description: "no max pay set on post" },
];

// Run tests and log results
export function runRateMatchingTests(): void {
  console.log("Running rate matching tests...\n");
  
  let passed = 0;
  let failed = 0;
  
  for (const tc of testCases) {
    const result = doesPostMatchRepRate(tc.repRate, tc.payMin, tc.payMax);
    const status = result === tc.expected ? "✓ PASS" : "✗ FAIL";
    
    if (result === tc.expected) {
      passed++;
    } else {
      failed++;
    }
    
    console.log(`${status}: ${tc.description}`);
    console.log(`  repRate=${tc.repRate}, payMin=${tc.payMin}, payMax=${tc.payMax}`);
    console.log(`  Expected: ${tc.expected}, Got: ${result}\n`);
  }
  
  console.log(`\nResults: ${passed} passed, ${failed} failed`);
}

// Export test cases for reference
export { testCases };
