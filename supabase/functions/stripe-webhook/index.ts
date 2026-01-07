import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Initialize Supabase admin client early for logging
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  let logId: string | null = null;
  let eventId = "unknown";

  try {
    logStep("Webhook received");

    const stripeKey = Deno.env.get("STRIPE_SECRET_TESTKEY");
    if (!stripeKey) {
      throw new Error("STRIPE_SECRET_TESTKEY is not set");
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    if (!webhookSecret) {
      throw new Error("STRIPE_WEBHOOK_SECRET is not set");
    }

    const body = await req.text();
    const signature = req.headers.get("stripe-signature");

    if (!signature) {
      throw new Error("No stripe-signature header");
    }

    // Try to extract event_id from raw body for logging before verification
    try {
      const rawPayload = JSON.parse(body);
      eventId = rawPayload.id || "unknown";
    } catch {
      // Ignore parse errors, we'll get the real ID after verification
    }

    // Insert initial log entry
    const { data: logData, error: logInsertError } = await supabaseAdmin
      .from("stripe_webhook_logs")
      .insert({
        event_id: eventId,
        status: "received",
        signature_valid: null,
        payload_summary: { raw_length: body.length },
      })
      .select("id")
      .single();

    if (logInsertError) {
      logStep("Warning: Failed to insert log entry", { error: logInsertError.message });
    } else {
      logId = logData?.id;
    }

    // Verify webhook signature
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logStep("Webhook signature verification failed", { error: errorMessage });

      // Update log with failure
      if (logId) {
        await supabaseAdmin
          .from("stripe_webhook_logs")
          .update({
            status: "failed",
            signature_valid: false,
            error_message: `Signature verification failed: ${errorMessage}`,
            processed_at: new Date().toISOString(),
          })
          .eq("id", logId);
      }

      return new Response(
        JSON.stringify({ error: "Invalid signature" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Update eventId with verified ID
    eventId = event.id;

    // Update log with verified event info
    if (logId) {
      await supabaseAdmin
        .from("stripe_webhook_logs")
        .update({
          event_id: eventId,
          event_type: event.type,
          signature_valid: true,
          payload_summary: {
            type: event.type,
            created: event.created,
            livemode: event.livemode,
          },
        })
        .eq("id", logId);
    }

    logStep("Event verified", { type: event.type, id: event.id });

    // Idempotency check: see if this event was already processed successfully
    const { data: existingLog } = await supabaseAdmin
      .from("stripe_webhook_logs")
      .select("id, status")
      .eq("event_id", eventId)
      .eq("status", "success")
      .maybeSingle();

    if (existingLog) {
      logStep("Event already processed successfully, skipping", { eventId });
      
      // Update current log entry to mark as duplicate
      if (logId && logId !== existingLog.id) {
        await supabaseAdmin
          .from("stripe_webhook_logs")
          .update({
            status: "duplicate",
            processed_at: new Date().toISOString(),
          })
          .eq("id", logId);
      }

      return new Response(JSON.stringify({ received: true, already_processed: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Handle checkout.session.completed event
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      logStep("Processing checkout session", { sessionId: session.id });

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
          headers: { "Content-Type": "application/json" },
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
          headers: { "Content-Type": "application/json" },
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
            },
          })
          .eq("id", logId);
      }
    } else {
      // Unhandled event type
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
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });

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

    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
});
