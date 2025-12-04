import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CreateStaffRequest {
  email: string;
  full_name: string;
  roles: {
    is_admin?: boolean;
    is_moderator?: boolean;
    is_support?: boolean;
  };
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
    const { email, full_name, roles } = body;

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

    console.log("Creating staff user:", email, "with roles:", roles);

    // Use admin API to invite user by email
    const { data: inviteData, error: inviteError } = await serviceClient.auth.admin.inviteUserByEmail(
      email,
      {
        data: { full_name },
      }
    );

    if (inviteError) {
      console.error("Invite error:", inviteError);
      // Check for common errors
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

    const newUserId = inviteData.user.id;
    console.log("User created with ID:", newUserId);

    // Upsert profile with staff roles
    const { error: profileUpsertError } = await serviceClient
      .from("profiles")
      .upsert({
        id: newUserId,
        email: email,
        full_name: full_name,
        is_admin: roles.is_admin ?? false,
        is_moderator: roles.is_moderator ?? false,
        is_support: roles.is_support ?? false,
        // Staff members bypass normal onboarding
        has_signed_terms: true,
        terms_signed_at: new Date().toISOString(),
        terms_version: "staff_bypass",
      }, { onConflict: "id" });

    if (profileUpsertError) {
      console.error("Profile upsert error:", profileUpsertError);
      // User was created but profile failed - still return success but note the issue
      return new Response(
        JSON.stringify({ 
          success: true, 
          user_id: newUserId, 
          email: email,
          roles: roles,
          warning: "User created but profile update may have failed" 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Staff user created successfully:", email);

    return new Response(
      JSON.stringify({
        success: true,
        user_id: newUserId,
        email: email,
        roles: roles,
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
