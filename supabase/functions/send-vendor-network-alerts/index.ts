import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendAlertRequest {
  alertId?: string; // For immediate send of a specific alert
  processScheduled?: boolean; // For cron to process due scheduled alerts
}

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body: SendAlertRequest = await req.json().catch(() => ({}));
    const { alertId, processScheduled } = body;

    console.log("send-vendor-network-alerts called:", { alertId, processScheduled });

    let alertsToProcess: any[] = [];

    if (alertId) {
      // Send a specific alert immediately
      const { data: alert, error } = await supabase
        .from("rep_network_alerts")
        .select("*")
        .eq("id", alertId)
        .single();

      if (error || !alert) {
        console.error("Alert not found:", alertId, error);
        return new Response(
          JSON.stringify({ error: "Alert not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (alert.status === "sent") {
        return new Response(
          JSON.stringify({ error: "Alert already sent" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      alertsToProcess = [alert];
    } else if (processScheduled) {
      // Process all scheduled alerts that are due
      const { data: dueAlerts, error } = await supabase
        .from("rep_network_alerts")
        .select("*")
        .eq("status", "scheduled")
        .lte("scheduled_at", new Date().toISOString());

      if (error) {
        console.error("Error fetching scheduled alerts:", error);
        throw error;
      }

      alertsToProcess = dueAlerts || [];
      console.log(`Found ${alertsToProcess.length} scheduled alerts to process`);
    } else {
      return new Response(
        JSON.stringify({ error: "Must provide alertId or processScheduled=true" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results = [];

    for (const alert of alertsToProcess) {
      try {
        // Mark as sending
        await supabase
          .from("rep_network_alerts")
          .update({ status: "sending" })
          .eq("id", alert.id);

        // Get vendor info for notification title
        const { data: vendorProfile } = await supabase
          .from("vendor_profile")
          .select("company_name, anonymous_id")
          .eq("user_id", alert.vendor_id)
          .single();

        const vendorName = vendorProfile?.company_name || vendorProfile?.anonymous_id || "A Vendor";

        // Get connected reps
        const { data: connections, error: connectionsError } = await supabase
          .from("vendor_connections")
          .select("field_rep_id")
          .eq("vendor_id", alert.vendor_id)
          .eq("status", "connected");

        if (connectionsError) throw connectionsError;

        let repIds = connections?.map(c => c.field_rep_id) || [];

        // Filter by state if target_scope is by_state
        if (alert.target_scope === "by_state" && alert.target_state_codes?.length > 0) {
          // Get rep coverage areas for these states
          const { data: coverageAreas } = await supabase
            .from("rep_coverage_areas")
            .select("user_id, state_code")
            .in("user_id", repIds)
            .in("state_code", alert.target_state_codes);

          const repsInStates = new Set(coverageAreas?.map(c => c.user_id) || []);
          repIds = repIds.filter(id => repsInStates.has(id));
        }

        console.log(`Alert ${alert.id}: sending to ${repIds.length} reps`);

        // Create notifications for each rep
        for (const repId of repIds) {
          await supabase.from("notifications").insert({
            user_id: repId,
            type: "vendor_network_alert",
            title: `Network alert from ${vendorName}`,
            body: `${alert.title}: ${alert.body.substring(0, 150)}${alert.body.length > 150 ? '...' : ''}`,
            ref_id: alert.id,
          });
        }

        // Mark as sent
        await supabase
          .from("rep_network_alerts")
          .update({
            status: "sent",
            sent_at: new Date().toISOString(),
            recipient_count: repIds.length,
          })
          .eq("id", alert.id);

        results.push({ alertId: alert.id, status: "sent", recipientCount: repIds.length });
        console.log(`Alert ${alert.id} sent successfully to ${repIds.length} reps`);

      } catch (alertError: any) {
        console.error(`Error processing alert ${alert.id}:`, alertError);
        
        // Mark as failed
        await supabase
          .from("rep_network_alerts")
          .update({
            status: "failed",
            error_message: alertError.message || "Unknown error",
          })
          .eq("id", alert.id);

        results.push({ alertId: alert.id, status: "failed", error: alertError.message });
      }
    }

    return new Response(
      JSON.stringify({ success: true, results }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Error in send-vendor-network-alerts:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
