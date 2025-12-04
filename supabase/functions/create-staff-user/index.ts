import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CreateStaffRequest {
  email: string;
  full_name: string;
  role: "admin" | "moderator" | "support";
  note?: string;
  // Legacy support for old format
  roles?: {
    is_admin?: boolean;
    is_moderator?: boolean;
    is_support?: boolean;
  };
  resend?: boolean; // If true, just resend invite to existing user
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
      console.error("Missing Supabase environment variables");
      return new Response(
        JSON.stringify({ success: false, error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the authorization header to identify the caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create a client with the user's auth to verify their identity
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: callerUser }, error: authError } = await userClient.auth.getUser();
    if (authError || !callerUser) {
      console.error("Auth error:", authError);
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify caller is a super admin using service role client
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);
    
    const { data: callerProfile, error: profileError } = await serviceClient
      .from("profiles")
      .select("is_super_admin")
      .eq("id", callerUser.id)
      .single();

    if (profileError || !callerProfile?.is_super_admin) {
      console.error("Caller is not a super admin:", callerUser.id);
      return new Response(
        JSON.stringify({ success: false, error: "Only Super Admins can create staff accounts" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const body: CreateStaffRequest = await req.json();
    const { email, full_name, role, note, roles, resend } = body;

    if (!email || !full_name) {
      return new Response(
        JSON.stringify({ success: false, error: "Email and full name are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid email format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine role flags - support both new 'role' field and legacy 'roles' object
    let is_admin = false;
    let is_moderator = false;
    let is_support = false;
    let staff_role = role || null;

    if (role) {
      is_admin = role === "admin";
      is_moderator = role === "moderator";
      is_support = role === "support";
    } else if (roles) {
      // Legacy support
      is_admin = roles.is_admin ?? false;
      is_moderator = roles.is_moderator ?? false;
      is_support = roles.is_support ?? false;
      // Derive staff_role from legacy flags
      if (is_admin) staff_role = "admin";
      else if (is_moderator) staff_role = "moderator";
      else if (is_support) staff_role = "support";
    }

    console.log("Creating/inviting staff user:", email, "with role:", staff_role, "resend:", resend);

    // Check if user already exists
    const { data: existingUsers } = await serviceClient.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase());

    let userId: string;
    const now = new Date().toISOString();

    if (existingUser) {
      userId = existingUser.id;
      console.log("User already exists:", userId);

      if (resend) {
        // Resend invite - generate a recovery link (password reset)
        const { data: linkData, error: linkError } = await serviceClient.auth.admin.generateLink({
          type: "recovery",
          email: email,
        });

        if (linkError) {
          console.error("Failed to generate recovery link:", linkError);
          return new Response(
            JSON.stringify({ success: false, error: "Failed to generate invite link" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Note: Supabase sends the email automatically when using generateLink with proper email settings
        // Update invite sent timestamp
        await serviceClient
          .from("profiles")
          .update({ staff_invite_sent_at: now })
          .eq("id", userId);

        console.log("Resent invite to existing user:", email);

        return new Response(
          JSON.stringify({
            success: true,
            user_id: userId,
            email: email,
            role: staff_role,
            resent: true,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } else {
        // Just update the existing user's profile with staff flags
        const { error: updateError } = await serviceClient
          .from("profiles")
          .update({
            full_name: full_name,
            is_admin,
            is_moderator,
            is_support,
            staff_role,
            staff_invited_at: now,
            staff_invite_note: note || null,
            has_signed_terms: true,
            terms_signed_at: now,
            terms_version: "staff_bypass",
          })
          .eq("id", userId);

        if (updateError) {
          console.error("Profile update error:", updateError);
        }

        return new Response(
          JSON.stringify({
            success: true,
            user_id: userId,
            email: email,
            role: staff_role,
            existing_user: true,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Create new user via invite
    const { data: inviteData, error: inviteError } = await serviceClient.auth.admin.inviteUserByEmail(
      email,
      {
        data: { full_name },
      }
    );

    if (inviteError) {
      console.error("Invite error:", inviteError);
      if (inviteError.message?.includes("already registered")) {
        return new Response(
          JSON.stringify({ success: false, error: "This email is already registered" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ success: false, error: inviteError.message || "Failed to send invite" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!inviteData.user) {
      return new Response(
        JSON.stringify({ success: false, error: "Failed to create user" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    userId = inviteData.user.id;
    console.log("User created with ID:", userId);

    // Upsert profile with staff roles and onboarding metadata
    const { error: profileUpsertError } = await serviceClient
      .from("profiles")
      .upsert({
        id: userId,
        email: email,
        full_name: full_name,
        is_admin,
        is_moderator,
        is_support,
        staff_role,
        staff_invited_at: now,
        staff_invite_sent_at: now,
        staff_invite_note: note || null,
        // Staff members bypass normal onboarding
        has_signed_terms: true,
        terms_signed_at: now,
        terms_version: "staff_bypass",
      }, { onConflict: "id" });

    if (profileUpsertError) {
      console.error("Profile upsert error:", profileUpsertError);
      return new Response(
        JSON.stringify({ 
          success: true, 
          user_id: userId, 
          email: email,
          role: staff_role,
          warning: "User created but profile update may have failed" 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Staff user created successfully:", email);

    return new Response(
      JSON.stringify({
        success: true,
        user_id: userId,
        email: email,
        role: staff_role,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ success: false, error: "An unexpected error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
