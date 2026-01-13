import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { vendorProfileId } = await req.json();

    // Fetch vendor profile
    const { data: vp, error: vpError } = await serviceClient
      .from("vendor_profile")
      .select("*, profiles!vendor_profile_user_id_fkey(full_name, email)")
      .eq("id", vendorProfileId)
      .single();

    if (vpError || !vp) {
      return new Response(JSON.stringify({ error: "Vendor profile not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify ownership
    if (vp.user_id !== user.id) {
      return new Response(JSON.stringify({ error: "Not authorized" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update status to pending
    await serviceClient
      .from("vendor_profile")
      .update({
        vendor_verification_status: "pending",
        verification_submitted_at: new Date().toISOString(),
      })
      .eq("id", vendorProfileId);

    // Find or create admin user for verification thread
    const { data: adminProfile } = await serviceClient
      .from("profiles")
      .select("id")
      .eq("is_admin", true)
      .limit(1)
      .single();

    if (!adminProfile) {
      return new Response(JSON.stringify({ error: "No admin available" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find or create conversation - use category for support thread identification
    const [p1, p2] = [user.id, adminProfile.id].sort();
    const supportCategory = "support:vendor_verification";
    
    // Look for existing conversation by category (preferred) or conversation_type (legacy)
    let { data: existingConvo } = await serviceClient
      .from("conversations")
      .select("id")
      .eq("participant_one", p1)
      .eq("participant_two", p2)
      .eq("category", supportCategory)
      .maybeSingle();
    
    // Fallback: check for legacy conversation_type if no category match
    if (!existingConvo) {
      const { data: legacyConvo } = await serviceClient
        .from("conversations")
        .select("id")
        .eq("participant_one", p1)
        .eq("participant_two", p2)
        .eq("conversation_type", "vendor_verification")
        .maybeSingle();
      
      if (legacyConvo) {
        // Migrate legacy conversation to use category and conversation_type
        await serviceClient
          .from("conversations")
          .update({ 
            category: supportCategory,
            conversation_type: "support"
          })
          .eq("id", legacyConvo.id);
        existingConvo = legacyConvo;
      }
    }

    let conversationId: string;

    if (existingConvo) {
      conversationId = existingConvo.id;
    } else {
      // Default support code is CLRMRKT
      const supportCode = vp.vendor_public_code_requested || "CLRMRKT";
      
      const { data: newConvo, error: convoError } = await serviceClient
        .from("conversations")
        .insert({
          participant_one: p1,
          participant_two: p2,
          conversation_type: "support",
          category: supportCategory,
          hidden_for_one: false,
          hidden_for_two: false,
          post_title_snapshot: `Vendor Verification: ${supportCode}`,
        })
        .select("id")
        .single();

      if (convoError) throw convoError;
      conversationId = newConvo.id;
    }

    // Build snapshot message
    const snapshot = `
**Vendor Verification Request**

---

**A) Verification Request**
- Requested Code: ${vp.vendor_public_code_requested || "Not provided"}
- Established Year: ${vp.business_established_year || "Not provided"}
- Bio: ${vp.business_bio || "Not provided"}
- Website: ${vp.website_url || "Not provided"}
- LinkedIn: ${vp.linkedin_url || "Not provided"}
- BBB: ${vp.bbb_url || "Not provided"}
- EIN Provided: ${vp.ein_provided ? "Yes" : "No"}
- GL Note: ${vp.gl_insurance_note || "Not provided"}

---

**B) ClearMarket Account Information (Point of Contact)**
- POC Name: ${vp.poc_name || "Not provided"}
- POC Title: ${vp.poc_title || "Not provided"}
- POC Email: ${vp.poc_email || "Not provided"}
- POC Phone: ${vp.poc_phone || "Not provided"}

---

**C) Company Info (Rep-Facing)**
- Company Name: ${vp.company_name || "Not provided"}
- Company Website: ${vp.website || "Not provided"}
- Company Description: ${vp.company_description || "Not provided"}
- Location: ${vp.city || ""}${vp.city && vp.state ? ", " : ""}${vp.state || ""}
`;

    // Post message
    await serviceClient.from("messages").insert({
      conversation_id: conversationId,
      sender_id: user.id,
      recipient_id: adminProfile.id,
      body: snapshot.trim(),
      subject: "Vendor Verification Request",
    });

    // Update conversation preview
    await serviceClient
      .from("conversations")
      .update({
        last_message_at: new Date().toISOString(),
        last_message_preview: "Vendor Verification Request submitted",
      })
      .eq("id", conversationId);

    // Auto-complete the "Submit Vendor Verification" checklist item
    await serviceClient.rpc("complete_checklist_item_by_key", {
      p_user_id: user.id,
      p_auto_track_key: "vendor_verification_submitted",
    });

    return new Response(JSON.stringify({ success: true, conversationId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
