import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// Tightened CORS: only allow actual app origins
const ALLOWED_ORIGINS = [
  "https://useclearmarket.io",
  "https://www.useclearmarket.io",
  "https://useclearmarketio.lovable.app",
];

// Allow Lovable preview domains during development (matches id-preview--<guid>.lovable.app)
const LOVABLE_PREVIEW_PATTERN = /^https:\/\/[a-z0-9-]+\.lovable\.app$/;

function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowedOrigin =
    origin && (ALLOWED_ORIGINS.includes(origin) || LOVABLE_PREVIEW_PATTERN.test(origin))
      ? origin
      : ALLOWED_ORIGINS[0];

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-anon-session-id, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

// Rate limit configurations for contact access actions
const RATE_LIMIT_CONFIG: Record<string, { maxRequests: number; windowSeconds: number }> = {
  view_contact: { maxRequests: 30, windowSeconds: 60 },
  export_contact: { maxRequests: 10, windowSeconds: 60 },
};

// UUID v4 regex for validation
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Valid access types
const VALID_ACCESS_TYPES = ["view_contact", "unlock_contact", "export_contact"] as const;
type AccessType = typeof VALID_ACCESS_TYPES[number];

/**
 * guard_contact_access
 * 
 * Rate-limits + logs contact access, then optionally returns contact email.
 * Prevents network-level scraping by only returning email via this function.
 * 
 * Request body:
 *   repUserId: string (UUID)
 *   accessType: "view_contact" | "unlock_contact" | "export_contact"
 *   includeContact?: boolean  // only valid for view_contact/export_contact
 *   vendorProfileId?: string (UUID) // optional: for actor attribution when staff acts on behalf of vendor
 * 
 * Response:
 *   { allowed: true, contact?: { email?: string } }
 *   { allowed: false, reason: "RATE_LIMIT" | "NO_ACCESS" | "NOT_VENDOR" | ... }
 */

interface RequestBody {
  repUserId: string;
  accessType: string;
  includeContact?: boolean;
  vendorProfileId?: string;
}

interface ActorContext {
  actor_user_id: string;
  actor_role: string;
  actor_code: string | null;
}

// Hash IP with server-side salt for privacy-preserving audit trail
async function hashIP(ip: string): Promise<string> {
  const salt = Deno.env.get("IP_HASH_SALT") || "clearmarket-default-salt-change-me";
  const data = new TextEncoder().encode(salt + ip);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Extract client IP from various headers (Cloudflare, proxies, etc.)
function getClientIP(req: Request): string | null {
  return (
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-real-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    null
  );
}

// Derive actor context server-side using the RPC
async function getActorContext(
  supabaseAdmin: SupabaseClient,
  userId: string,
  vendorProfileId: string | null
): Promise<ActorContext> {
  // If we have a vendor profile ID, use the RPC to get full context
  if (vendorProfileId && UUID_REGEX.test(vendorProfileId)) {
    const { data, error } = await supabaseAdmin.rpc("get_actor_context_for_vendor", {
      p_vendor_id: vendorProfileId,
    } as Record<string, unknown>);
    
    if (!error && data) {
      const result = data as { actor_user_id?: string; actor_role?: string; actor_code?: string | null };
      return {
        actor_user_id: result.actor_user_id || userId,
        actor_role: result.actor_role || "unknown",
        actor_code: result.actor_code || null,
      };
    }
  }

  // Fallback: check if user is admin, otherwise assume vendor_owner
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("is_admin")
    .eq("id", userId)
    .maybeSingle();

  const profileData = profile as { is_admin?: boolean } | null;
  if (profileData?.is_admin) {
    return {
      actor_user_id: userId,
      actor_role: "admin",
      actor_code: "ADMIN",
    };
  }

  // Default fallback for vendor owner without explicit profile ID
  return {
    actor_user_id: userId,
    actor_role: "vendor_owner",
    actor_code: null,
  };
}

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Only allow POST
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ allowed: false, reason: "METHOD_NOT_ALLOWED" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ allowed: false, reason: "NOT_AUTHENTICATED" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create client with user's JWT for auth validation
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    // Create service role client for privileged operations
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get authenticated user
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ allowed: false, reason: "NOT_AUTHENTICATED" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: RequestBody = await req.json();
    const { repUserId, accessType, includeContact, vendorProfileId } = body;

    // === INPUT VALIDATION ===

    // 1) Required params
    if (!repUserId || !accessType) {
      return new Response(
        JSON.stringify({ allowed: false, reason: "MISSING_PARAMS" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2) Validate repUserId is a UUID
    if (!UUID_REGEX.test(repUserId)) {
      return new Response(
        JSON.stringify({ allowed: false, reason: "INVALID_REP_USER_ID" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3) Validate accessType is one of allowed values
    if (!VALID_ACCESS_TYPES.includes(accessType as AccessType)) {
      return new Response(
        JSON.stringify({ allowed: false, reason: "INVALID_ACCESS_TYPE" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // === SERVER-SIDE RATE LIMITING (before any sensitive data access) ===
    const rateLimitConfig = RATE_LIMIT_CONFIG[accessType];
    if (rateLimitConfig) {
      // Read x-anon-session-id header for anonymous identifier (fallback for unauthenticated)
      const anonSessionId = req.headers.get("x-anon-session-id");
      // For authenticated users, check_rate_limit uses auth.uid() internally
      // For unauthenticated/anonymous, we pass the session id as identifier
      const identifier = user?.id || anonSessionId || null;

      const { data: rateLimitAllowed, error: rateLimitError } = await supabaseAdmin.rpc(
        "check_rate_limit",
        {
          p_action: accessType,
          p_max_requests: rateLimitConfig.maxRequests,
          p_window_seconds: rateLimitConfig.windowSeconds,
          p_identifier: identifier,
        } as Record<string, unknown>
      );

      // FAIL CLOSED: if rate limiter is unavailable, block to protect sensitive data
      if (rateLimitError) {
        console.error("Rate limit RPC error (fail closed):", rateLimitError);
        return new Response(
          JSON.stringify({ error: "Temporary protection check failed. Please retry." }),
          { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!rateLimitAllowed) {
        return new Response(
          JSON.stringify({ error: "Too many requests. Please wait and try again." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // 4) Prevent self-access logging spam
    const vendorUserId = user.id;
    if (repUserId === vendorUserId) {
      return new Response(
        JSON.stringify({ allowed: false, reason: "SELF_ACCESS_NOT_ALLOWED" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5) includeContact only valid for view_contact/export_contact
    const validatedIncludeContact =
      includeContact === true && (accessType === "view_contact" || accessType === "export_contact");

    // === AUTHORIZATION ===

    // Check if caller is a vendor or admin
    const { data: viewerProfile } = await supabaseAdmin
      .from("profiles")
      .select("is_vendor_admin, is_vendor_staff, is_admin")
      .eq("id", vendorUserId)
      .maybeSingle();

    const profileData = viewerProfile as { is_vendor_admin?: boolean; is_vendor_staff?: boolean; is_admin?: boolean } | null;
    const isVendor = profileData?.is_vendor_admin || profileData?.is_vendor_staff || false;
    const isAdmin = profileData?.is_admin || false;

    if (!isVendor && !isAdmin) {
      return new Response(
        JSON.stringify({ allowed: false, reason: "NOT_VENDOR" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // For unlock_contact: feature has been removed - return error
    if (accessType === "unlock_contact") {
      return new Response(
        JSON.stringify({ allowed: false, reason: "UNLOCK_REMOVED", message: "Contact unlock feature has been removed. Vendors must connect with reps to access contact details." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // For view_contact/export_contact: require connected OR admin (unlock removed)
    let isConnected = false;

    if (accessType === "view_contact" || accessType === "export_contact") {
      // Check connection status only (unlock feature removed)
      const connectionResult = await supabaseAdmin
        .from("vendor_connections")
        .select("id")
        .eq("vendor_id", vendorUserId)
        .eq("field_rep_id", repUserId)
        .eq("status", "connected")
        .maybeSingle();

      const connData = connectionResult.data as { id?: string } | null;
      isConnected = Boolean(connData?.id);

      // For view/export: must be connected or admin
      if (!isAdmin && !isConnected) {
        return new Response(
          JSON.stringify({ allowed: false, reason: "NO_ACCESS" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // === ACTOR ATTRIBUTION ===
    
    // Derive actor context server-side (trusted, no spoofing possible)
    const actorContext = await getActorContext(supabaseAdmin, vendorUserId, vendorProfileId || null);

    // === LOGGING + RATE LIMITING ===

    // Capture IP hash and user agent for audit trail
    const clientIP = getClientIP(req);
    const ipHash = clientIP ? await hashIP(clientIP) : null;
    const userAgent = req.headers.get("User-Agent") || null;

    // Call log_rep_contact_access RPC (handles rate limiting + logging)
    const { data: logResult, error: logError } = await supabaseAdmin.rpc(
      "log_rep_contact_access",
      {
        p_vendor_user_id: vendorUserId,
        p_rep_user_id: repUserId,
        p_access_type: accessType,
        p_source: "public_profile_dialog",
        p_metadata: { includeContact: validatedIncludeContact },
        p_ip_hash: ipHash,
        p_user_agent: userAgent,
        p_actor_user_id: actorContext.actor_user_id,
        p_actor_role: actorContext.actor_role,
        p_actor_code: actorContext.actor_code,
      } as Record<string, unknown>
    );

    if (logError) {
      console.error("log_rep_contact_access error:", logError);
      return new Response(
        JSON.stringify({ allowed: false, reason: "LOG_ERROR" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if rate limited
    const logResultData = logResult as { allowed?: boolean } | null;
    if (logResultData && !logResultData.allowed) {
      return new Response(
        JSON.stringify({ allowed: false, reason: "RATE_LIMIT" }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // === RETURN CONTACT IF AUTHORIZED ===

    let contact: { email?: string | null } | null = null;

    // Only return email for view_contact/export_contact when authorized
    if (validatedIncludeContact && (accessType === "view_contact" || accessType === "export_contact")) {
      const { data: repProfile } = await supabaseAdmin
        .from("profiles")
        .select("email")
        .eq("id", repUserId)
        .maybeSingle();

      const repData = repProfile as { email?: string } | null;
      contact = { email: repData?.email || null };
    }

    return new Response(
      JSON.stringify({ allowed: true, contact }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("guard_contact_access error:", error);
    const origin = req.headers.get("Origin");
    return new Response(
      JSON.stringify({ allowed: false, reason: "INTERNAL_ERROR" }),
      { status: 500, headers: { ...getCorsHeaders(origin), "Content-Type": "application/json" } }
    );
  }
});
