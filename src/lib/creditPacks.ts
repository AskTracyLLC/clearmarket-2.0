/**
 * Credit pack definitions for ClearMarket
 * 
 * IMPORTANT: Replace the stripePriceId values with real Stripe Price IDs
 * from your Stripe Dashboard > Products > Prices
 * 
 * To create prices in Stripe:
 * 1. Go to Stripe Dashboard > Products
 * 2. Create a new product for each pack (or use existing)
 * 3. Add a one-time price for each product
 * 4. Copy the price_xxx ID and paste below
 */

export interface CreditPack {
  id: string;
  label: string;
  description: string;
  credits: number;
  priceUsd: number; // Display price in dollars
  stripePriceId: string;
}

export const CREDIT_PACKS: CreditPack[] = [
  {
    id: "starter_10",
    label: "Starter Pack",
    description: "10 credits — good for minimum needs",
    credits: 10,
    priceUsd: 6.00,
    stripePriceId: "price_1Sa43XIZ7isA0IxEOZgM2BRx",
  },
  {
    id: "standard_25",
    label: "Standard Pack",
    description: "25 credits — for active vendors",
    credits: 25,
    priceUsd: 13.00,
    stripePriceId: "price_1Sa448IZ7isA0IxE40HI8lhW",
  },
  {
    id: "pro_50",
    label: "Pro Pack",
    description: "50 credits — for power users",
    credits: 50,
    priceUsd: 23.00,
    stripePriceId: "price_1Sa44oIZ7isA0IxEqglY4AOg",
  },
];

/**
 * Get a credit pack by ID
 */
export function getCreditPackById(packId: string): CreditPack | undefined {
  return CREDIT_PACKS.find((pack) => pack.id === packId);
}

/**
 * Validate that a pack ID exists
 */
export function isValidPackId(packId: string): boolean {
  return CREDIT_PACKS.some((pack) => pack.id === packId);
}
