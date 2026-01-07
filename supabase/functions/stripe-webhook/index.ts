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

      // Send purchase confirmation email via Resend
      const resendApiKey = Deno.env.get("RESEND_API_KEY");
      if (resendApiKey) {
        try {
          // Fetch user profile and vendor profile (for anonymous_id)
          const { data: userProfile } = await supabaseAdmin
            .from("profiles")
            .select("email, full_name")
            .eq("id", userId)
            .single();

          // Fetch vendor_profile and rep_profile to get the signup-assigned anonymous_id
          // User may be a Vendor (Vendor#X) or Field Rep (FieldRep#X)
          const [vendorProfileResult, repProfileResult] = await Promise.all([
            supabaseAdmin
              .from("vendor_profile")
              .select("anonymous_id")
              .eq("user_id", userId)
              .maybeSingle(),
            supabaseAdmin
              .from("rep_profile")
              .select("anonymous_id")
              .eq("user_id", userId)
              .maybeSingle(),
          ]);

          const vendorAnonymousId = vendorProfileResult.data?.anonymous_id;
          const repAnonymousId = repProfileResult.data?.anonymous_id;

          if (userProfile?.email) {
            const amountPaid = session.amount_total ? (session.amount_total / 100).toFixed(2) : "0.00";
            const currency = (session.currency || "usd").toUpperCase();
            const purchaseDate = new Date().toLocaleString("en-US", {
              timeZone: "America/Chicago",
              dateStyle: "long",
              timeStyle: "short",
            });
            const firstName = userProfile.full_name?.split(" ")[0] || "there";
            const checkoutSessionId = session.id;
            const paymentIntentId = typeof session.payment_intent === "string" 
              ? session.payment_intent 
              : session.payment_intent?.id || "";

            // Buyer details - prefer vendor ID, fallback to rep ID, then generic
            const buyerFullName = userProfile.full_name || "Not provided";
            const buyerEmail = userProfile.email;
            const buyerUserId = vendorAnonymousId || repAnonymousId || `User#${userId.substring(0, 6)}`;

            // Pack name lookup
            const packNames: Record<string, string> = {
              beta_test: "Beta Test",
              starter_10: "Starter Pack",
              standard_25: "Standard Pack",
              pro_50: "Pro Pack",
            };
            const packName = packNames[creditPackId] || creditPackId;

            // Email subject with amount and descriptor
            const emailSubject = `ClearMarket Credits Purchased — $${amountPaid} ${currency} — Charge appears as ASKTRACY LLC-CLRMRKT`;

            // Email body HTML
            const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background-color:#111827;color:#f9fafb;">
  <div style="max-width:600px;margin:0 auto;padding:32px 24px;">
    <div style="text-align:center;margin-bottom:24px;">
      <h1 style="color:#10b981;margin:0;font-size:24px;">ClearMarket</h1>
    </div>
    
    <div style="background-color:#1f2937;border-radius:12px;padding:24px;margin-bottom:24px;">
      <h2 style="color:#f9fafb;margin:0 0 16px 0;font-size:20px;">Thank you for your purchase, ${firstName}!</h2>
      
      <div style="background-color:#374151;border-left:4px solid #f59e0b;padding:16px;border-radius:0 8px 8px 0;margin-bottom:20px;">
        <p style="margin:0;color:#fbbf24;font-weight:600;font-size:14px;">📋 Card Statement Note</p>
        <p style="margin:8px 0 0 0;color:#e5e7eb;font-size:14px;">This purchase may appear on your card statement as <strong style="color:#f9fafb;">'ASKTRACY LLC-CLRMRKT'</strong>. This is the billing descriptor for ClearMarket.</p>
      </div>
      
      <div style="background-color:#374151;border-radius:8px;padding:16px;margin-bottom:20px;">
        <h3 style="color:#9ca3af;margin:0 0 12px 0;font-size:14px;text-transform:uppercase;letter-spacing:0.5px;">Buyer Details</h3>
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:6px 0;color:#9ca3af;font-size:14px;">Name</td>
            <td style="padding:6px 0;color:#f9fafb;font-size:14px;text-align:right;">${buyerFullName}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#9ca3af;font-size:14px;">Email</td>
            <td style="padding:6px 0;color:#f9fafb;font-size:14px;text-align:right;">${buyerEmail}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#9ca3af;font-size:14px;">User #</td>
            <td style="padding:6px 0;color:#10b981;font-size:14px;text-align:right;font-weight:600;">${buyerUserId}</td>
          </tr>
        </table>
      </div>
      
      <h3 style="color:#9ca3af;margin:0 0 12px 0;font-size:14px;text-transform:uppercase;letter-spacing:0.5px;">Purchase Details</h3>
      
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="padding:8px 0;color:#9ca3af;font-size:14px;">Pack</td>
          <td style="padding:8px 0;color:#f9fafb;font-size:14px;text-align:right;font-weight:500;">${packName}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#9ca3af;font-size:14px;">Credits Added</td>
          <td style="padding:8px 0;color:#10b981;font-size:14px;text-align:right;font-weight:600;">+${creditsToAdd}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#9ca3af;font-size:14px;">Amount Paid</td>
          <td style="padding:8px 0;color:#f9fafb;font-size:14px;text-align:right;font-weight:500;">$${amountPaid} ${currency}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#9ca3af;font-size:14px;">Date/Time</td>
          <td style="padding:8px 0;color:#f9fafb;font-size:14px;text-align:right;">${purchaseDate}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#9ca3af;font-size:14px;">New Balance</td>
          <td style="padding:8px 0;color:#10b981;font-size:16px;text-align:right;font-weight:700;">${newBalance} credits</td>
        </tr>
      </table>
      
      <div style="margin-top:20px;padding-top:16px;border-top:1px solid #374151;">
        <p style="margin:0 0 4px 0;color:#6b7280;font-size:12px;">Reference IDs</p>
        <p style="margin:0;color:#9ca3af;font-size:11px;font-family:monospace;word-break:break-all;">Session: ${checkoutSessionId}</p>
        ${paymentIntentId ? `<p style="margin:4px 0 0 0;color:#9ca3af;font-size:11px;font-family:monospace;word-break:break-all;">Payment: ${paymentIntentId}</p>` : ""}
      </div>
    </div>
    
    <div style="text-align:center;margin-bottom:24px;">
      <a href="https://useclearmarket.io/vendor/credits" style="display:inline-block;background-color:#10b981;color:#ffffff;text-decoration:none;padding:12px 32px;border-radius:8px;font-weight:600;font-size:14px;">View Your Credits</a>
    </div>
    
    <div style="text-align:center;color:#6b7280;font-size:12px;">
      <p style="margin:0;">Questions? Email <a href="mailto:hello@useclearmarket.io" style="color:#10b981;text-decoration:none;">hello@useclearmarket.io</a></p>
      <p style="margin:12px 0 0 0;">© ${new Date().getFullYear()} ClearMarket. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;

            const emailResponse = await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${resendApiKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                from: "ClearMarket <hello@useclearmarket.io>",
                reply_to: "hello@useclearmarket.io",
                to: [userProfile.email],
                subject: emailSubject,
                html: emailHtml,
              }),
            });

            const emailResult = await emailResponse.json();
            
            if (emailResponse.ok && emailResult.id) {
              logStep("Purchase confirmation email sent", { 
                messageId: emailResult.id, 
                to: userProfile.email,
                buyerUserId 
              });
            } else {
              logStep("Warning: Failed to send purchase email", { error: emailResult });
            }
          } else {
            logStep("Warning: User email not found for purchase confirmation", { userId });
          }
        } catch (emailError) {
          logStep("Warning: Exception sending purchase email", { 
            error: emailError instanceof Error ? emailError.message : String(emailError) 
          });
        }
      } else {
        logStep("Skipping purchase email: RESEND_API_KEY not configured");
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
