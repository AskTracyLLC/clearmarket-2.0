import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Credit pack definitions - must match frontend config
// LIVE Stripe Price IDs (prod_*)
const CREDIT_PACKS: Record<string, { credits: number; stripePriceId: string; amountCents: number; currency: string }> = {
  just_1: {
    credits: 1,
    stripePriceId: "price_1SnVomIZ7isA0IxEFevjJUDl",
    amountCents: 200,
    currency: "usd",
  },
  starter_10: {
    credits: 10,
    stripePriceId: "price_1Sa43XIZ7isA0IxEOZgM2BRx",
    amountCents: 500,
    currency: "usd",
  },
  standard_25: {
    credits: 25,
    stripePriceId: "price_1Sa448IZ7isA0IxE40HI8lhW",
    amountCents: 1000,
    currency: "usd",
  },
  pro_50: {
    credits: 50,
    stripePriceId: "price_1Sa44oIZ7isA0IxEqglY4AOg",
    amountCents: 2000,
    currency: "usd",
  },
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[CREATE-CREDIT-CHECKOUT] ${step}${detailsStr}`);
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    // Get authenticated user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header provided");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError || !userData.user) {
      throw new Error("User not authenticated");
    }

    const user = userData.user;
    logStep("User authenticated", { userId: user.id, email: user.email });

    // Parse request body
    const { packId } = await req.json();
    logStep("Request received", { packId });

    // Validate pack ID
    const pack = CREDIT_PACKS[packId];
    if (!pack) {
      throw new Error(`Invalid pack ID: ${packId}`);
    }
    logStep("Pack validated", { packId, credits: pack.credits });

    // Initialize Stripe - prefer LIVE key (STRIPE_SECRET_KEY2 is live in this project)
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY2") || Deno.env.get("STRIPE_SECRET_KEY_LIVE") || Deno.env.get("STRIPE_SECRET_KEY") || Deno.env.get("STRIPE_SECRET_TESTKEY");
    if (!stripeKey) {
      throw new Error("No Stripe secret key is configured");
    }
    
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Check if Stripe customer exists
    const customers = await stripe.customers.list({ email: user.email!, limit: 1 });
    let customerId: string | undefined;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      logStep("Found existing Stripe customer", { customerId });
    }

    // Get origin for redirect URLs (fallback to production URL)
    const origin = req.headers.get("origin") || Deno.env.get("ORIGIN") || "https://useclearmarket.io";

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email!,
      line_items: [
        {
          price: pack.stripePriceId,
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${origin}/vendor/credits?status=success`,
      cancel_url: `${origin}/vendor/credits?status=cancelled`,
      metadata: {
        user_id: user.id,
        credit_pack_id: packId,
        credits_to_add: pack.credits.toString(),
      },
    });

    logStep("Checkout session created", { sessionId: session.id });

    // Insert pending purchase record using service role for backend write
    // This is REQUIRED for webhook + email idempotency
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const { error: insertError } = await supabaseAdmin
      .from("pending_credit_purchases")
      .insert({
        user_id: user.id,
        credit_pack_id: packId,
        credits_to_add: pack.credits,
        stripe_checkout_session_id: session.id,
        stripe_price_id: pack.stripePriceId,
        amount_cents: pack.amountCents,
        currency: pack.currency,
        status: "pending",
      });

    if (insertError) {
      logStep("CRITICAL: Failed to insert pending purchase - aborting", { error: insertError.message });
      // Fail the request - webhook and email idempotency depend on this record
      return new Response(
        JSON.stringify({ error: "Failed to create purchase record. Please try again." }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500,
        }
      );
    }
    
    logStep("Pending purchase record created");

    return new Response(
      JSON.stringify({ checkoutUrl: session.url }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
