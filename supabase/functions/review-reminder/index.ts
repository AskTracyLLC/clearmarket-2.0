import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RepInterestRow {
  id: string;
  post_id: string;
  rep_id: string;
  status: string;
  connected_at: string | null;
  last_reminder_sent_at: string | null;
}

interface RepProfileRow {
  user_id: string;
  anonymous_id: string | null;
}

interface VendorProfileRow {
  user_id: string;
  company_name: string;
  anonymous_id: string | null;
}

interface SeekingCoveragePost {
  id: string;
  vendor_id: string;
  title: string;
}

interface ReviewRow {
  id: string;
  reviewer_id: string;
  reviewee_id: string;
  rep_interest_id: string | null;
  direction: string;
}

interface BlockRow {
  blocker_user_id: string;
  blocked_user_id: string;
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("[review-reminder] Starting 30-day review reminder job...");

    // Calculate cutoff: 30 days ago
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 30);
    const cutoffISO = cutoffDate.toISOString();

    console.log(`[review-reminder] Cutoff date: ${cutoffISO}`);

    // Find rep_interest rows that:
    // - status = 'connected'
    // - connected_at is not null and <= cutoff
    // - last_reminder_sent_at is null (haven't sent reminder yet)
    const { data: connections, error: connError } = await supabase
      .from("rep_interest")
      .select("id, post_id, rep_id, status, connected_at, last_reminder_sent_at")
      .eq("status", "connected")
      .not("connected_at", "is", null)
      .lte("connected_at", cutoffISO)
      .is("last_reminder_sent_at", null);

    if (connError) {
      console.error("[review-reminder] Error fetching connections:", connError);
      throw connError;
    }

    console.log(`[review-reminder] Found ${connections?.length || 0} eligible connections`);

    if (!connections || connections.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No connections need reminders", count: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Gather unique IDs for batch lookups
    const repProfileIds = [...new Set(connections.map((c) => c.rep_id))];
    const postIds = [...new Set(connections.map((c) => c.post_id))];

    // Fetch rep profiles to get user_id and anonymous_id
    const { data: repProfiles, error: repErr } = await supabase
      .from("rep_profile")
      .select("id, user_id, anonymous_id")
      .in("id", repProfileIds);

    if (repErr) {
      console.error("[review-reminder] Error fetching rep profiles:", repErr);
      throw repErr;
    }

    // Build map: rep_profile.id -> { user_id, anonymous_id }
    const repProfileMap: Record<string, { user_id: string; anonymous_id: string | null }> = {};
    for (const rp of repProfiles || []) {
      repProfileMap[rp.id] = { user_id: rp.user_id, anonymous_id: rp.anonymous_id };
    }

    // Fetch seeking_coverage_posts to get vendor_id and title
    const { data: posts, error: postErr } = await supabase
      .from("seeking_coverage_posts")
      .select("id, vendor_id, title")
      .in("id", postIds);

    if (postErr) {
      console.error("[review-reminder] Error fetching posts:", postErr);
      throw postErr;
    }

    // Build map: post_id -> { vendor_id, title }
    const postMap: Record<string, { vendor_id: string; title: string }> = {};
    for (const p of posts || []) {
      postMap[p.id] = { vendor_id: p.vendor_id, title: p.title };
    }

    // Get all vendor user IDs
    const vendorUserIds = [...new Set(Object.values(postMap).map((p) => p.vendor_id))];

    // Fetch vendor profiles
    const { data: vendorProfiles, error: vendorErr } = await supabase
      .from("vendor_profile")
      .select("user_id, company_name, anonymous_id")
      .in("user_id", vendorUserIds);

    if (vendorErr) {
      console.error("[review-reminder] Error fetching vendor profiles:", vendorErr);
      throw vendorErr;
    }

    // Build map: vendor_user_id -> { company_name, anonymous_id }
    const vendorProfileMap: Record<string, { company_name: string; anonymous_id: string | null }> = {};
    for (const vp of vendorProfiles || []) {
      vendorProfileMap[vp.user_id] = { company_name: vp.company_name, anonymous_id: vp.anonymous_id };
    }

    // Fetch all existing reviews for these rep_interest IDs to check if review already exists
    const repInterestIds = connections.map((c) => c.id);
    const { data: existingReviews, error: reviewErr } = await supabase
      .from("reviews")
      .select("id, reviewer_id, reviewee_id, rep_interest_id, direction")
      .in("rep_interest_id", repInterestIds);

    if (reviewErr) {
      console.error("[review-reminder] Error fetching existing reviews:", reviewErr);
      throw reviewErr;
    }

    // Build set of (rep_interest_id, direction) pairs that already have reviews
    const reviewedSet = new Set<string>();
    for (const r of existingReviews || []) {
      if (r.rep_interest_id) {
        reviewedSet.add(`${r.rep_interest_id}:${r.direction}`);
      }
    }

    // Fetch all blocks to respect block logic
    const allUserIds = [
      ...new Set([
        ...Object.values(repProfileMap).map((r) => r.user_id),
        ...vendorUserIds,
      ]),
    ];

    const { data: blocks, error: blockErr } = await supabase
      .from("user_blocks")
      .select("blocker_user_id, blocked_user_id")
      .or(`blocker_user_id.in.(${allUserIds.join(",")}),blocked_user_id.in.(${allUserIds.join(",")})`);

    if (blockErr) {
      console.error("[review-reminder] Error fetching blocks:", blockErr);
      // Continue without block check if it fails
    }

    // Build block pairs set
    const blockSet = new Set<string>();
    for (const b of blocks || []) {
      blockSet.add(`${b.blocker_user_id}:${b.blocked_user_id}`);
      blockSet.add(`${b.blocked_user_id}:${b.blocker_user_id}`);
    }

    let notificationsSent = 0;
    const processedConnections: string[] = [];

    for (const conn of connections) {
      const repInfo = repProfileMap[conn.rep_id];
      const postInfo = postMap[conn.post_id];

      if (!repInfo || !postInfo) {
        console.log(`[review-reminder] Skipping connection ${conn.id} - missing rep or post info`);
        continue;
      }

      const repUserId = repInfo.user_id;
      const vendorUserId = postInfo.vendor_id;
      const vendorInfo = vendorProfileMap[vendorUserId];

      if (!vendorInfo) {
        console.log(`[review-reminder] Skipping connection ${conn.id} - missing vendor profile`);
        continue;
      }

      // Check if blocked
      if (blockSet.has(`${repUserId}:${vendorUserId}`)) {
        console.log(`[review-reminder] Skipping connection ${conn.id} - users blocked each other`);
        continue;
      }

      const repAnon = repInfo.anonymous_id || "Field Rep";
      const vendorName = vendorInfo.company_name || vendorInfo.anonymous_id || "Vendor";

      // Check if vendor → rep review exists
      const vendorToRepKey = `${conn.id}:vendor_to_rep`;
      const needsVendorToRepReview = !reviewedSet.has(vendorToRepKey);

      // Check if rep → vendor review exists
      const repToVendorKey = `${conn.id}:rep_to_vendor`;
      const needsRepToVendorReview = !reviewedSet.has(repToVendorKey);

      // Send vendor notification if needed
      if (needsVendorToRepReview) {
        const vendorTitle = `Time to review ${repAnon}`;
        const vendorBody = `It's been about a month since you connected with ${repAnon} for "${postInfo.title}". Please rate their On-time performance, Quality of work, and Communication so your Trust Score stays accurate.`;

        const { error: vendorNotifErr } = await supabase.from("notifications").insert({
          user_id: vendorUserId,
          type: "review_reminder",
          title: vendorTitle,
          body: vendorBody,
          ref_id: conn.id, // ref_id points to rep_interest_id for deep-linking
        });

        if (vendorNotifErr) {
          console.error(`[review-reminder] Error creating vendor notification for ${conn.id}:`, vendorNotifErr);
        } else {
          console.log(`[review-reminder] Sent vendor reminder for connection ${conn.id}`);
          notificationsSent++;
        }
      }

      // Send rep notification if needed
      if (needsRepToVendorReview) {
        const repTitle = `How was ${vendorName} to work with?`;
        const repBody = `It's been about a month since you connected with ${vendorName} for "${postInfo.title}". Please rate their Helpfulness, Communication, and Reliability of pay.`;

        const { error: repNotifErr } = await supabase.from("notifications").insert({
          user_id: repUserId,
          type: "review_reminder",
          title: repTitle,
          body: repBody,
          ref_id: conn.id, // ref_id points to rep_interest_id for deep-linking
        });

        if (repNotifErr) {
          console.error(`[review-reminder] Error creating rep notification for ${conn.id}:`, repNotifErr);
        } else {
          console.log(`[review-reminder] Sent rep reminder for connection ${conn.id}`);
          notificationsSent++;
        }
      }

      // Mark connection as reminded (even if one side already reviewed)
      processedConnections.push(conn.id);
    }

    // Update last_reminder_sent_at for all processed connections
    if (processedConnections.length > 0) {
      const { error: updateErr } = await supabase
        .from("rep_interest")
        .update({ last_reminder_sent_at: new Date().toISOString() })
        .in("id", processedConnections);

      if (updateErr) {
        console.error("[review-reminder] Error updating last_reminder_sent_at:", updateErr);
      } else {
        console.log(`[review-reminder] Marked ${processedConnections.length} connections as reminded`);
      }
    }

    console.log(`[review-reminder] Job complete. Sent ${notificationsSent} notifications.`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Sent ${notificationsSent} review reminders`,
        connectionsProcessed: processedConnections.length,
        notificationsSent,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[review-reminder] Fatal error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
