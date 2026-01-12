import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Topic =
  | "billing"
  | "refund"
  | "support_ticket"
  | "user_report"
  | "dual_role_access"
  | "other";

type CreateSupportCaseBody = {
  topic: Topic;
  subject: string;           // shown as post_title_snapshot (list preview)
  message: string;           // first message content
  priority?: "normal" | "urgent";
  attachments?: string[];    // array of image URLs
  metadata?: Record<string, unknown>; // optional for future (keep small)
  requesterUserId?: string;  // optional: create the case for a specific requester (staff/admin use)
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function assertNonEmptyString(v: unknown, field: string, maxLen: number): string {
  if (typeof v !== "string" || !v.trim()) {
    throw new Error(`${field} is required`);
  }
  if (v.trim().length > maxLen) {
    throw new Error(`${field} must be <= ${maxLen} chars`);
  }
  return v.trim();
}

function isAllowedTopic(t: unknown): t is Topic {
  return (
    t === "billing" ||
    t === "refund" ||
    t === "support_ticket" ||
    t === "user_report" ||
    t === "dual_role_access" ||
    t === "other"
  );
}

function buildSupportCategory(topic: Topic, caseId: string): string {
  return `support:${topic}:${caseId}`;
}

function previewFromMessage(msg: string): string {
  const s = msg.replace(/\s+/g, " ").trim();
  return s.length > 180 ? s.slice(0, 177) + "…" : s;
}

/**
 * Maps topic to support_queue_items category
 */
function mapTopicToQueueCategory(topic: Topic): string {
  switch (topic) {
    case "billing":
    case "refund":
      return "billing";
    case "support_ticket":
      return "support_tickets";
    case "user_report":
      return "user_reports";
    case "dual_role_access":
      return "dual_role_requests";
    default:
      return "other";
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return json(405, { error: "Method not allowed" });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const SUPPORT_SYSTEM_USER_ID = Deno.env.get("SUPPORT_SYSTEM_USER_ID");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return json(500, { error: "Missing Supabase env vars" });
    }
    if (!SUPPORT_SYSTEM_USER_ID) {
      return json(500, { error: "Missing SUPPORT_SYSTEM_USER_ID env var" });
    }

    // Auth: require a logged-in user
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return json(401, { error: "Missing Authorization bearer token" });
    }

    // Service role client for inserts (bypasses RLS)
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    // Use the user's JWT to identify who is creating the case
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });

    const { data: authData, error: authErr } = await userClient.auth.getUser();
    if (authErr || !authData?.user) {
      return json(401, { error: "Invalid auth token" });
    }
    const actorUserId = authData.user.id;

    // Rate limiting: max 5 support cases per requester per hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count: recentCases, error: countErr } = await admin
      .from("conversations")
      .select("id", { count: "exact", head: true })
      .eq("participant_one", actorUserId)
      .eq("conversation_type", "support")
      .gte("created_at", oneHourAgo);

    if (countErr) {
      console.error("Rate limit check failed:", countErr);
      // Allow through if check fails (fail open)
    } else if ((recentCases ?? 0) >= 5) {
      return json(429, { 
        error: "rate_limited",
        message: "Too many support cases created. Please wait and try again.",
        retryAfterMinutes: 60,
      });
    }

    const body = (await req.json()) as Partial<CreateSupportCaseBody>;

    if (!isAllowedTopic(body.topic)) {
      return json(400, { error: "Invalid topic. Allowed: billing, refund, support_ticket, user_report, dual_role_access, other" });
    }

    const subject = assertNonEmptyString(body.subject, "subject", 120);
    const message = assertNonEmptyString(body.message, "message", 4000);
    const priority = body.priority === "urgent" ? "urgent" : "normal";
    const attachments = Array.isArray(body.attachments) ? body.attachments.filter((u) => typeof u === "string") : [];

    // Determine who the requester is (defaults to actor)
    let requesterUserId = actorUserId;
    if (typeof body.requesterUserId === "string" && body.requesterUserId.trim()) {
      const candidate = body.requesterUserId.trim();
      // Only allow overriding requester when actor is staff/admin
      if (candidate !== actorUserId) {
        const { data: actorProfile, error: actorProfileErr } = await admin
          .from("profiles")
          .select("is_admin, staff_role")
          .eq("id", actorUserId)
          .maybeSingle();

        if (actorProfileErr) {
          console.error("Failed to verify actor permissions:", actorProfileErr);
          return json(403, { error: "Not allowed to create case for another user" });
        }

        const isStaff = Boolean(actorProfile?.is_admin) || Boolean(actorProfile?.staff_role);
        if (!isStaff) {
          return json(403, { error: "Not allowed to create case for another user" });
        }
      }
      requesterUserId = candidate;
    }
    const caseId = crypto.randomUUID();
    const category = buildSupportCategory(body.topic, caseId);
    
    // Build message body with attachments appended
    let messageBody = message;
    if (attachments.length > 0) {
      messageBody += `\n\n---\nAttachments:\n${attachments.map(u => `• ${u}`).join("\n")}`;
    }

    // Create conversation
    const nowIso = new Date().toISOString();
    const conversationInsert = {
      participant_one: requesterUserId,
      participant_two: SUPPORT_SYSTEM_USER_ID,
      conversation_type: "support",
      category,
      post_title_snapshot: subject,
      last_message_at: nowIso,
      last_message_preview: previewFromMessage(message),
      updated_at: nowIso,
    };
    
    // Store attachments in conversation metadata if any
    if (attachments.length > 0) {
      (conversationInsert as Record<string, unknown>).metadata = { attachments };
    }

    const { data: conv, error: convErr } = await admin
      .from("conversations")
      .insert(conversationInsert)
      .select("id")
      .single();

    if (convErr || !conv?.id) {
      console.error("Failed to create conversation:", convErr);
      return json(500, { error: "Failed to create conversation", details: convErr?.message });
    }

    const conversationId = conv.id as string;

    // Insert first message using correct messages table schema:
    // sender_id, recipient_id, body, subject, conversation_id
    const messageInsert = {
      conversation_id: conversationId,
      sender_id: SUPPORT_SYSTEM_USER_ID,
      recipient_id: requesterUserId,
      body: messageBody,
      subject: subject,
      read: false,
    };

    const { error: msgErr } = await admin.from("messages").insert(messageInsert);
    if (msgErr) {
      console.error("Failed to create message:", msgErr);
      // Optionally clean up the conversation if message insert fails
      await admin.from("conversations").delete().eq("id", conversationId);
      return json(500, { error: "Failed to create message", details: msgErr.message });
    }

    console.log(`Support case created: ${category} for requester ${requesterUserId} (actor ${actorUserId})`);

    // --- Create support_queue_items record for admin queue ---
    let queueItemCreated = false;
    
    try {
      // Idempotency check: skip if already exists
      const { data: existingItem } = await admin
        .from("support_queue_items")
        .select("id")
        .eq("source_type", "support_case")
        .eq("source_id", caseId)
        .maybeSingle();

      if (!existingItem) {
        const queueCategory = mapTopicToQueueCategory(body.topic);
        const queuePriority = priority === "urgent" ? "high" : "normal";
        
        const queueItemInsert = {
          source_type: "support_case",
          source_id: caseId,
          title: subject,
          preview: previewFromMessage(message),
          priority: queuePriority,
          status: "open",
          category: queueCategory,
          target_url: `/messages/${conversationId}`,
          conversation_id: conversationId,
          metadata: {
            conversation_id: conversationId,
            case_id: caseId,
            support_category: category,
            topic: body.topic,
            created_by: actorUserId,
            requester_user_id: requesterUserId,
            ...(attachments.length > 0 ? { attachments } : {}),
          },
        };

        const { error: queueErr } = await admin
          .from("support_queue_items")
          .insert(queueItemInsert);

        if (queueErr) {
          console.error("Failed to create support queue item:", queueErr);
          // Don't fail the whole request - conversation + message are already created
        } else {
          queueItemCreated = true;
          console.log(`Support queue item created for case ${caseId}`);
        }
      } else {
        // Already exists (idempotent)
        queueItemCreated = true;
        console.log(`Support queue item already exists for case ${caseId}`);
      }
    } catch (queueError) {
      console.error("Error creating support queue item:", queueError);
      // Don't fail the whole request
    }

    return json(200, {
      conversationId,
      caseId,
      category,
      topic: body.topic,
      priority,
      queueItemCreated,
    });
  } catch (e) {
    console.error("create-support-case error:", e);
    return json(500, { error: e instanceof Error ? e.message : "Unknown error" });
  }
});
