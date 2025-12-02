import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Credit pack definitions - must match frontend config
const CREDIT_PACKS: Record<string, { credits: number; stripePriceId: string }> = {
  starter_10: {
    credits: 10,
    // TODO: Replace with real Stripe Price ID
    stripePriceId: "price_starter_10_REPLACE_ME",
  },
  standard_25: {
    credits: 25,
    // TODO: Replace with real Stripe Price ID  
    stripePriceId: "price_standard_25_REPLACE_ME",
  },
  pro_50: {
    credits: 50,
    // TODO: Replace with real Stripe Price ID
    stripePriceId: "price_pro_50_REPLACE_ME",
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

    // Initialize Stripe
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      throw new Error("STRIPE_SECRET_KEY is not set");
    }
    
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Check if Stripe customer exists
    const customers = await stripe.customers.list({ email: user.email!, limit: 1 });
    let customerId: string | undefined;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      logStep("Found existing Stripe customer", { customerId });
    }

    // Get origin for redirect URLs
    const origin = req.headers.get("origin") || "https://your-app.lovable.app";

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
        status: "pending",
      });

    if (insertError) {
      logStep("Warning: Failed to insert pending purchase", { error: insertError.message });
      // Don't fail the request - the webhook can still work without this record
    } else {
      logStep("Pending purchase record created");
    }

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
