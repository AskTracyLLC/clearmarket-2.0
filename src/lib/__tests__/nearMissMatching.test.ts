/**
 * Near-miss matching test cases for Match Assistant.
 * 
 * A near-miss is defined as:
 * - Rep's base rate > vendor's max rate (not a normal match)
 * - The gap percentage (repRate - maxRate) / repRate <= NEAR_MISS_THRESHOLD (30%)
 */

import { doesPostMatchRepRate, NEAR_MISS_THRESHOLD } from "../rateMatching";

interface NearMissTestCase {
  description: string;
  repRate: number;
  payMin: number | null;
  payMax: number | null;
  expectedNormalMatch: boolean;
  expectedNearMiss: boolean;
}

const testCases: NearMissTestCase[] = [
  {
    description: "CT/New Haven: Rep $18, Vendor $5-$15 (16.7% gap = near-miss)",
    repRate: 18,
    payMin: 5,
    payMax: 15,
    expectedNormalMatch: false,
    expectedNearMiss: true, // (18-15)/18 = 0.167 ≤ 0.30
  },
  {
    description: "Exact match at max: Rep $15, Vendor $5-$15",
    repRate: 15,
    payMin: 5,
    payMax: 15,
    expectedNormalMatch: true,
    expectedNearMiss: false, // normal match, not a near-miss
  },
  {
    description: "Within range: Rep $10, Vendor $5-$15",
    repRate: 10,
    payMin: 5,
    payMax: 15,
    expectedNormalMatch: true,
    expectedNearMiss: false,
  },
  {
    description: "Just outside threshold: Rep $25, Vendor max $15 (40% gap)",
    repRate: 25,
    payMin: 5,
    payMax: 15,
    expectedNormalMatch: false,
    expectedNearMiss: false, // (25-15)/25 = 0.40 > 0.30
  },
  {
    description: "At 30% threshold boundary: Rep $21.43, Vendor max $15",
    repRate: 21.43,
    payMin: 5,
    payMax: 15,
    expectedNormalMatch: false,
    expectedNearMiss: true, // (21.43-15)/21.43 ≈ 0.30
  },
  {
    description: "Slightly over 30%: Rep $22, Vendor max $15 (31.8% gap)",
    repRate: 22,
    payMin: 5,
    payMax: 15,
    expectedNormalMatch: false,
    expectedNearMiss: false, // (22-15)/22 = 0.318 > 0.30
  },
  {
    description: "Fixed rate match: Rep $10, Vendor fixed $10",
    repRate: 10,
    payMin: null,
    payMax: 10,
    expectedNormalMatch: true,
    expectedNearMiss: false,
  },
  {
    description: "Fixed rate near-miss: Rep $12, Vendor fixed $10 (16.7% gap)",
    repRate: 12,
    payMin: null,
    payMax: 10,
    expectedNormalMatch: false,
    expectedNearMiss: true, // (12-10)/12 ≈ 0.167 ≤ 0.30
  },
];

function isNearMiss(repRate: number, payMax: number | null): boolean {
  if (payMax === null || payMax === undefined) return false;
  if (repRate <= payMax) return false; // It's a match, not a near-miss
  
  const gapPercent = (repRate - payMax) / repRate;
  return gapPercent <= NEAR_MISS_THRESHOLD;
}

export function runNearMissTests() {
  console.log("=== Near-Miss Matching Tests ===");
  console.log(`NEAR_MISS_THRESHOLD = ${NEAR_MISS_THRESHOLD * 100}%`);
  console.log("");
  
  let passed = 0;
  let failed = 0;

  for (const testCase of testCases) {
    const normalMatch = doesPostMatchRepRate(testCase.repRate, testCase.payMin, testCase.payMax);
    const nearMiss = !normalMatch && isNearMiss(testCase.repRate, testCase.payMax);
    
    const normalMatchPassed = normalMatch === testCase.expectedNormalMatch;
    const nearMissPassed = nearMiss === testCase.expectedNearMiss;
    const allPassed = normalMatchPassed && nearMissPassed;

    if (allPassed) {
      console.log(`✅ PASS: ${testCase.description}`);
      passed++;
    } else {
      console.log(`❌ FAIL: ${testCase.description}`);
      if (!normalMatchPassed) {
        console.log(`   Normal match: expected ${testCase.expectedNormalMatch}, got ${normalMatch}`);
      }
      if (!nearMissPassed) {
        console.log(`   Near-miss: expected ${testCase.expectedNearMiss}, got ${nearMiss}`);
      }
      failed++;
    }
  }

  console.log("");
  console.log(`=== Results: ${passed} passed, ${failed} failed ===`);
  return { passed, failed };
}
