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
    description: "10 credits — good for testing ClearMarket",
    credits: 10,
    priceUsd: 4.99,
    // TODO: Replace with real Stripe Price ID
    stripePriceId: "price_starter_10_REPLACE_ME",
  },
  {
    id: "standard_25",
    label: "Standard Pack",
    description: "25 credits — for active vendors",
    credits: 25,
    priceUsd: 9.99,
    // TODO: Replace with real Stripe Price ID
    stripePriceId: "price_standard_25_REPLACE_ME",
  },
  {
    id: "pro_50",
    label: "Pro Pack",
    description: "50 credits — for power users",
    credits: 50,
    priceUsd: 17.99,
    // TODO: Replace with real Stripe Price ID
    stripePriceId: "price_pro_50_REPLACE_ME",
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
