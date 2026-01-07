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
    id: "beta_test",
    label: "Beta Test",
    description: "1 credit — for testing payment system",
    credits: 1,
    priceUsd: 1.50,
    stripePriceId: "price_1Sn3C9IZ7isA0IxEPPQTVL5w",
  },
  {
    id: "starter_10",
    label: "Starter Pack",
    description: "10 credits — good for testing ClearMarket",
    credits: 10,
    priceUsd: 4.99,
    stripePriceId: "price_1Sa4EMIZ7isA0IxEtbEPua6I",
  },
  {
    id: "standard_25",
    label: "Standard Pack",
    description: "25 credits — for active vendors",
    credits: 25,
    priceUsd: 9.99,
    stripePriceId: "price_1Sa4EhIZ7isA0IxEKfZMFClq",
  },
  {
    id: "pro_50",
    label: "Pro Pack",
    description: "50 credits — for power users",
    credits: 50,
    priceUsd: 17.99,
    stripePriceId: "price_1Sa4FJIZ7isA0IxEFHF6VYoL",
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
