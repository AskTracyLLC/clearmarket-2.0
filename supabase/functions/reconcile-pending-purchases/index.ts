import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[RECONCILE-PENDING] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Reconciliation started");

    // Auth check: only admins can call this
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: userData } = await supabaseAdmin.auth.getUser(token);
      
      if (userData?.user) {
        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("is_admin")
          .eq("id", userData.user.id)
          .single();

        if (!profile?.is_admin) {
          return new Response(
            JSON.stringify({ error: "Admin access required" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    }

    const stripeKey = Deno.env.get("STRIPE_SECRET_TESTKEY");
    if (!stripeKey) {
      throw new Error("STRIPE_SECRET_TESTKEY is not set");
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Find pending purchases older than 5 minutes
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    
    const { data: pendingPurchases, error: fetchError } = await supabaseAdmin
      .from("pending_credit_purchases")
      .select("*")
      .eq("status", "pending")
      .lt("created_at", fiveMinutesAgo)
      .order("created_at", { ascending: true })
      .limit(50);

    if (fetchError) {
      throw new Error(`Failed to fetch pending purchases: ${fetchError.message}`);
    }

    logStep("Found pending purchases", { count: pendingPurchases?.length ?? 0 });

    const results: Array<{
      id: string;
      session_id: string;
      status: string;
      action: string;
      error?: string;
    }> = [];

    for (const purchase of pendingPurchases ?? []) {
      try {
        logStep("Checking session", { sessionId: purchase.stripe_checkout_session_id });

        // Fetch session from Stripe
        const session = await stripe.checkout.sessions.retrieve(purchase.stripe_checkout_session_id);

        if (session.payment_status === "paid") {
          logStep("Session is paid, crediting user", { sessionId: session.id });

          // Get current wallet
          const { data: wallet } = await supabaseAdmin
            .from("user_wallet")
            .select("credits")
            .eq("user_id", purchase.user_id)
            .maybeSingle();

          const currentBalance = wallet?.credits ?? 0;
          const newBalance = currentBalance + purchase.credits_to_add;

          // Update wallet
          if (wallet) {
            await supabaseAdmin
              .from("user_wallet")
              .update({ credits: newBalance, updated_at: new Date().toISOString() })
              .eq("user_id", purchase.user_id);
          } else {
            await supabaseAdmin
              .from("user_wallet")
              .insert({ user_id: purchase.user_id, credits: purchase.credits_to_add });
          }

          // Insert transaction
          await supabaseAdmin
            .from("vendor_credit_transactions")
            .insert({
              user_id: purchase.user_id,
              amount: purchase.credits_to_add,
              action: "credit_purchase",
              metadata: {
                credit_pack_id: purchase.credit_pack_id,
                stripe_checkout_session_id: session.id,
                stripe_payment_intent: session.payment_intent,
                reconciled: true,
              },
            });

          // Update pending purchase
          await supabaseAdmin
            .from("pending_credit_purchases")
            .update({
              status: "completed",
              completed_at: new Date().toISOString(),
              stripe_payment_intent_id: typeof session.payment_intent === "string"
                ? session.payment_intent
                : null,
            })
            .eq("id", purchase.id);

          // Create notification
          await supabaseAdmin
            .from("notifications")
            .insert({
              user_id: purchase.user_id,
              type: "credit_purchase_success",
              title: "Credits Added",
              body: `Your purchase of ${purchase.credits_to_add} credits was successful (reconciled). Your new balance is ${newBalance} credits.`,
            });

          results.push({
            id: purchase.id,
            session_id: session.id,
            status: "completed",
            action: "credited",
          });

        } else if (session.status === "expired") {
          logStep("Session expired, marking as expired", { sessionId: session.id });

          await supabaseAdmin
            .from("pending_credit_purchases")
            .update({ status: "expired" })
            .eq("id", purchase.id);

          results.push({
            id: purchase.id,
            session_id: session.id,
            status: "expired",
            action: "marked_expired",
          });

        } else {
          // Still pending or open
          results.push({
            id: purchase.id,
            session_id: session.id,
            status: session.status ?? "unknown",
            action: "no_action",
          });
        }

      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        logStep("Error processing purchase", { id: purchase.id, error: errorMessage });

        results.push({
          id: purchase.id,
          session_id: purchase.stripe_checkout_session_id,
          status: "error",
          action: "failed",
          error: errorMessage,
        });
      }
    }

    logStep("Reconciliation completed", { processed: results.length });

    return new Response(
      JSON.stringify({
        success: true,
        processed: results.length,
        results,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });

    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
