import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: unknown) => {
  const timestamp = new Date().toISOString();
  const detailsStr = details ? ` | ${JSON.stringify(details)}` : "";
  console.log(`[${timestamp}] STRIPE-WEBHOOK: ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Generate a unique request ID for initial logging (before we have the Stripe event ID)
  const requestId = `request_${crypto.randomUUID()}`;
  let logId: string | null = null;

  // Initialize Supabase admin client early for logging
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  // Create initial Stripe instance for signature verification only
  const stripeForVerification = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || Deno.env.get("STRIPE_SECRET_TESTKEY") || "", {
    apiVersion: "2025-08-27.basil",
  });

  try {
    logStep("Webhook received", { requestId });

    const signature = req.headers.get("stripe-signature");
    if (!signature) {
      logStep("Missing Stripe-Signature header", { requestId });
      return new Response(JSON.stringify({ error: "Missing signature" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.text();
    logStep("Request body received", { requestId, bodyLength: body.length });

    // Get both webhook secrets (plus legacy fallback)
    const webhookSecretTest = Deno.env.get("STRIPE_WEBHOOK_SECRET_TEST");
    const webhookSecretLive = Deno.env.get("STRIPE_WEBHOOK_SECRET_LIVE");
    const webhookSecretLegacy = Deno.env.get("STRIPE_WEBHOOK_SECRET");

    if (!webhookSecretTest && !webhookSecretLive && !webhookSecretLegacy) {
      logStep("No webhook secrets configured", { requestId });
      return new Response(JSON.stringify({ error: "Webhook secrets not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Insert initial log with request_id (before verification)
    const { data: logData, error: logInsertError } = await supabaseAdmin
      .from("stripe_webhook_logs")
      .insert({
        event_id: requestId,
        status: "received",
        signature_valid: null,
        payload_summary: { raw_length: body.length },
      })
      .select("id")
      .single();

    if (logInsertError) {
      logStep("Warning: Failed to insert log entry", { requestId, error: logInsertError.message });
    } else {
      logId = logData?.id;
      logStep("Initial log inserted", { requestId, logId });
    }

    // Try to verify signature with available secrets (TEST first, then LIVE, then legacy)
    let event: Stripe.Event | null = null;
    let verifiedWithSecret: "test" | "live" | "legacy" | null = null;

    // Try TEST secret first
    if (webhookSecretTest && !event) {
      try {
        logStep("Attempting verification with TEST secret", { requestId });
        event = await stripeForVerification.webhooks.constructEventAsync(
          body,
          signature,
          webhookSecretTest
        );
        verifiedWithSecret = "test";
        logStep("Verification succeeded with TEST secret", { requestId, eventId: event.id });
      } catch (testError) {
        logStep("TEST secret verification failed", { 
          requestId, 
          error: testError instanceof Error ? testError.message : String(testError) 
        });
      }
    }

    // Try LIVE secret if TEST failed
    if (webhookSecretLive && !event) {
      try {
        logStep("Attempting verification with LIVE secret", { requestId });
        event = await stripeForVerification.webhooks.constructEventAsync(
          body,
          signature,
          webhookSecretLive
        );
        verifiedWithSecret = "live";
        logStep("Verification succeeded with LIVE secret", { requestId, eventId: event.id });
      } catch (liveError) {
        logStep("LIVE secret verification failed", { 
          requestId, 
          error: liveError instanceof Error ? liveError.message : String(liveError) 
        });
      }
    }

    // Try legacy secret as fallback
    if (webhookSecretLegacy && !event) {
      try {
        logStep("Attempting verification with LEGACY secret", { requestId });
        event = await stripeForVerification.webhooks.constructEventAsync(
          body,
          signature,
          webhookSecretLegacy
        );
        verifiedWithSecret = "legacy";
        logStep("Verification succeeded with LEGACY secret", { requestId, eventId: event.id });
      } catch (legacyError) {
        logStep("LEGACY secret verification failed", { 
          requestId, 
          error: legacyError instanceof Error ? legacyError.message : String(legacyError) 
        });
      }
    }

    // If no secret worked, verification failed
    if (!event) {
      logStep("All signature verifications failed", { requestId });
      
      if (logId) {
        await supabaseAdmin
          .from("stripe_webhook_logs")
          .update({
            status: "failed",
            signature_valid: false,
            error_message: "Invalid signature - all secrets failed",
            processed_at: new Date().toISOString(),
          })
          .eq("id", logId);
      }

      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verification succeeded
    logStep("Signature verified", { 
      requestId, 
      eventId: event.id, 
      eventType: event.type, 
      livemode: event.livemode,
      verifiedWith: verifiedWithSecret 
    });

    // Check if this event was already processed (idempotency check)
    const { data: existingLog } = await supabaseAdmin
      .from("stripe_webhook_logs")
      .select("id, status")
      .eq("event_id", event.id)
      .eq("status", "success")
      .maybeSingle();

    if (existingLog) {
      logStep("Event already processed successfully, skipping", { eventId: event.id });
      
      // Delete our temporary request_id log since the real event already exists
      if (logId) {
        await supabaseAdmin
          .from("stripe_webhook_logs")
          .delete()
          .eq("id", logId);
      }

      return new Response(JSON.stringify({ received: true, already_processed: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update our log row with the real event_id
    if (logId) {
      const { error: updateError } = await supabaseAdmin
        .from("stripe_webhook_logs")
        .update({
          event_id: event.id,
          event_type: event.type,
          signature_valid: true,
          payload_summary: {
            type: event.type,
            created: event.created,
            livemode: event.livemode,
            verified_with: verifiedWithSecret,
          },
        })
        .eq("id", logId);

      if (updateError) {
        // If update fails due to unique constraint, this event was processed by another request
        logStep("Failed to update log with event_id (may be duplicate)", { 
          eventId: event.id, 
          error: updateError.message 
        });
      }
    }

    // Select the correct API key based on event.livemode for any subsequent Stripe API calls
    const stripeApiKey = event.livemode 
      ? Deno.env.get("STRIPE_SECRET_KEY") 
      : Deno.env.get("STRIPE_SECRET_TESTKEY");

    if (!stripeApiKey) {
      const mode = event.livemode ? "live" : "test";
      logStep(`Missing Stripe API key for ${mode} mode`, { eventId: event.id, livemode: event.livemode });
      
      if (logId) {
        await supabaseAdmin
          .from("stripe_webhook_logs")
          .update({
            status: "error",
            error_message: `Missing Stripe API key for ${mode} mode`,
            processed_at: new Date().toISOString(),
          })
          .eq("id", logId);
      }

      return new Response(JSON.stringify({ error: `Missing API key for ${mode} mode` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    logStep("Using API key for mode", { livemode: event.livemode });

    // Handle checkout.session.completed event
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      logStep("Processing checkout session", { sessionId: session.id, metadata: session.metadata });

      const userId = session.metadata?.user_id;
      const creditPackId = session.metadata?.credit_pack_id;
      const creditsToAdd = parseInt(session.metadata?.credits_to_add || "0", 10);

      if (!userId || !creditPackId || creditsToAdd <= 0) {
        logStep("Missing or invalid metadata", { userId, creditPackId, creditsToAdd });

        if (logId) {
          await supabaseAdmin
            .from("stripe_webhook_logs")
            .update({
              status: "skipped",
              error_message: "Missing or invalid metadata",
              processed_at: new Date().toISOString(),
              payload_summary: {
                type: event.type,
                session_id: session.id,
                metadata: session.metadata,
              },
            })
            .eq("id", logId);
        }

        return new Response(JSON.stringify({ received: true }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      logStep("Metadata extracted", { userId, creditPackId, creditsToAdd });

      // Check if already processed via pending_credit_purchases (secondary idempotency)
      const { data: existingPurchase } = await supabaseAdmin
        .from("pending_credit_purchases")
        .select("id, status")
        .eq("stripe_checkout_session_id", session.id)
        .maybeSingle();

      if (existingPurchase?.status === "completed") {
        logStep("Purchase already completed, skipping", { purchaseId: existingPurchase.id });

        if (logId) {
          await supabaseAdmin
            .from("stripe_webhook_logs")
            .update({
              status: "success",
              processed_at: new Date().toISOString(),
              payload_summary: {
                type: event.type,
                session_id: session.id,
                already_completed: true,
              },
            })
            .eq("id", logId);
        }

        return new Response(JSON.stringify({ received: true, already_processed: true }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get current wallet balance
      const { data: wallet, error: walletError } = await supabaseAdmin
        .from("user_wallet")
        .select("credits")
        .eq("user_id", userId)
        .maybeSingle();

      if (walletError) {
        logStep("Error fetching wallet", { error: walletError.message });
        throw new Error(`Failed to fetch wallet: ${walletError.message}`);
      }

      const currentBalance = wallet?.credits ?? 0;
      const newBalance = currentBalance + creditsToAdd;

      logStep("Updating wallet", { currentBalance, creditsToAdd, newBalance });

      // Update wallet balance
      if (wallet) {
        const { error: updateError } = await supabaseAdmin
          .from("user_wallet")
          .update({ credits: newBalance, updated_at: new Date().toISOString() })
          .eq("user_id", userId);

        if (updateError) {
          throw new Error(`Failed to update wallet: ${updateError.message}`);
        }
      } else {
        const { error: insertWalletError } = await supabaseAdmin
          .from("user_wallet")
          .insert({ user_id: userId, credits: creditsToAdd });

        if (insertWalletError) {
          throw new Error(`Failed to create wallet: ${insertWalletError.message}`);
        }
      }

      logStep("Wallet updated successfully");

      // Insert transaction record
      const { error: txError } = await supabaseAdmin
        .from("vendor_credit_transactions")
        .insert({
          user_id: userId,
          amount: creditsToAdd,
          action: "credit_purchase",
          metadata: {
            credit_pack_id: creditPackId,
            stripe_checkout_session_id: session.id,
            stripe_payment_intent: session.payment_intent,
            amount_paid: session.amount_total,
            currency: session.currency,
            livemode: event.livemode,
          },
        });

      if (txError) {
        logStep("Warning: Failed to insert transaction record", { error: txError.message });
      } else {
        logStep("Transaction record created");
      }

      // Update pending purchase status
      if (existingPurchase) {
        const { error: updatePendingError } = await supabaseAdmin
          .from("pending_credit_purchases")
          .update({
            status: "completed",
            completed_at: new Date().toISOString(),
            stripe_payment_intent_id: typeof session.payment_intent === "string"
              ? session.payment_intent
              : session.payment_intent?.id,
          })
          .eq("id", existingPurchase.id);

        if (updatePendingError) {
          logStep("Warning: Failed to update pending purchase", { error: updatePendingError.message });
        }
      }

      // Create notification for user
      const { error: notifError } = await supabaseAdmin
        .from("notifications")
        .insert({
          user_id: userId,
          type: "credit_purchase_success",
          title: "Credits Added",
          body: `Your purchase of ${creditsToAdd} credits was successful. Your new balance is ${newBalance} credits.`,
        });

      if (notifError) {
        logStep("Warning: Failed to create notification", { error: notifError.message });
      } else {
        logStep("Notification created");
      }

      logStep("Purchase completed successfully", { userId, creditsToAdd, newBalance });

      // Update log to success
      if (logId) {
        await supabaseAdmin
          .from("stripe_webhook_logs")
          .update({
            status: "success",
            processed_at: new Date().toISOString(),
            payload_summary: {
              type: event.type,
              session_id: session.id,
              user_id: userId,
              credits_added: creditsToAdd,
              new_balance: newBalance,
              livemode: event.livemode,
            },
          })
          .eq("id", logId);
      }
    } else {
      // Unhandled event type
      logStep("Ignoring event type", { eventType: event.type });
      
      if (logId) {
        await supabaseAdmin
          .from("stripe_webhook_logs")
          .update({
            status: "ignored",
            processed_at: new Date().toISOString(),
          })
          .eq("id", logId);
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { requestId, message: errorMessage });

    // Update log with error
    if (logId) {
      await supabaseAdmin
        .from("stripe_webhook_logs")
        .update({
          status: "error",
          error_message: errorMessage,
          processed_at: new Date().toISOString(),
        })
        .eq("id", logId);
    }

    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
