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
  console.log(`[${timestamp}] STRIPE-HEALTH: ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    // Initialize Supabase client for auth check
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    // Verify user is authenticated and is admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: "User not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    logStep("User authenticated", { userId: userData.user.id });

    // Check if user is staff (admin, moderator, or support)
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("is_admin, is_moderator, is_support, email")
      .eq("id", userData.user.id)
      .single();

    // Allow access if user is admin OR has the specific email (super admin safeguard)
    const isSuperAdmin = profile?.email?.toLowerCase() === "tracy@asktracyllc.com";
    const isStaff = profile?.is_admin || isSuperAdmin;

    if (profileError || !isStaff) {
      logStep("Access denied - not admin", { userId: userData.user.id });
      return new Response(JSON.stringify({ error: "Access denied. Admin only." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    logStep("Admin access verified");

    // Get Stripe keys
    const liveKey = Deno.env.get("STRIPE_SECRET_KEY");
    const testKey = Deno.env.get("STRIPE_SECRET_TESTKEY");

    // Determine which key to use (prefer LIVE for production check)
    const stripeKey = liveKey || testKey;
    
    if (!stripeKey) {
      return new Response(JSON.stringify({
        error: "No Stripe API keys configured",
        mode: "unknown",
        inferredFromKey: null,
        accountId: null,
        chargesEnabled: null,
        payoutsEnabled: null,
        lastEvent: null,
        lastWebhook: null,
        keysConfigured: {
          live: false,
          test: false,
        },
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Infer mode from key prefix
    const inferredFromKey = stripeKey.startsWith("sk_live_") ? "live" : "test";
    logStep("Key analysis", { 
      inferredFromKey,
      hasLiveKey: !!liveKey,
      hasTestKey: !!testKey,
    });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Get account info
    let accountId: string | null = null;
    let chargesEnabled: boolean | null = null;
    let payoutsEnabled: boolean | null = null;

    try {
      const account = await stripe.accounts.retrieve();
      accountId = account.id;
      chargesEnabled = account.charges_enabled ?? null;
      payoutsEnabled = account.payouts_enabled ?? null;
      logStep("Account retrieved", { accountId, chargesEnabled, payoutsEnabled });
    } catch (accountError) {
      logStep("Could not retrieve account info", { 
        error: accountError instanceof Error ? accountError.message : String(accountError) 
      });
    }

    // Get latest event to determine actual mode
    let mode: "live" | "test" | "unknown" = "unknown";
    let lastEvent: { type: string; created: number; livemode: boolean } | null = null;

    try {
      const events = await stripe.events.list({ limit: 1 });
      if (events.data.length > 0) {
        const event = events.data[0];
        mode = event.livemode ? "live" : "test";
        lastEvent = {
          type: event.type,
          created: event.created,
          livemode: event.livemode,
        };
        logStep("Latest Stripe event", { mode, eventType: event.type, created: event.created });
      } else {
        // No events, use inferred mode
        mode = inferredFromKey === "live" ? "live" : "test";
        logStep("No events found, using inferred mode", { mode });
      }
    } catch (eventsError) {
      logStep("Could not fetch events", { 
        error: eventsError instanceof Error ? eventsError.message : String(eventsError) 
      });
      // Fall back to inferred mode
      mode = inferredFromKey === "live" ? "live" : "test";
    }

    // Get latest webhook from our health table
    let lastWebhook: { eventType: string; eventId: string; livemode: boolean; receivedAt: string } | null = null;

    try {
      const { data: webhookHealth } = await supabaseAdmin
        .from("stripe_webhook_health")
        .select("event_type, event_id, livemode, received_at")
        .order("received_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (webhookHealth) {
        lastWebhook = {
          eventType: webhookHealth.event_type,
          eventId: webhookHealth.event_id,
          livemode: webhookHealth.livemode,
          receivedAt: webhookHealth.received_at,
        };
        logStep("Latest webhook from health table", lastWebhook);
      }
    } catch (webhookError) {
      logStep("Could not fetch webhook health", { 
        error: webhookError instanceof Error ? webhookError.message : String(webhookError) 
      });
    }

    const response = {
      mode,
      inferredFromKey,
      accountId,
      chargesEnabled,
      payoutsEnabled,
      lastEvent,
      lastWebhook,
      keysConfigured: {
        live: !!liveKey,
        test: !!testKey,
      },
    };

    logStep("Response ready", response);

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
