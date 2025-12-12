import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ProcessMatchesRequest {
  vendorUserId: string;
  vendorEmail: string;
  vendorCompanyName?: string;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body: ProcessMatchesRequest = await req.json();
    const { vendorUserId, vendorEmail, vendorCompanyName } = body;

    console.log("process-vendor-contact-matches called:", { vendorUserId, vendorEmail, vendorCompanyName });

    if (!vendorUserId || !vendorEmail) {
      return new Response(
        JSON.stringify({ error: "Missing vendorUserId or vendorEmail" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const vendorEmailLower = vendorEmail.toLowerCase();
    const vendorDomain = vendorEmailLower.split("@")[1] || "";

    // SCENARIO A: Exact email match - auto-link
    const { data: exactMatches, error: exactError } = await supabase
      .from("rep_vendor_contacts")
      .select("id, rep_user_id, company_name, contact_name, email")
      .eq("is_active", true)
      .eq("is_converted_to_vendor", false)
      .ilike("email", vendorEmailLower);

    if (exactError) {
      console.error("Error finding exact matches:", exactError);
    }

    let exactMatchesProcessed = 0;
    let connectionsCreated = 0;

    if (exactMatches && exactMatches.length > 0) {
      console.log(`Found ${exactMatches.length} exact email matches`);

      for (const contact of exactMatches) {
        // Check if connection already exists
        const { data: existingConnection } = await supabase
          .from("vendor_connections")
          .select("id, status")
          .eq("vendor_id", vendorUserId)
          .eq("field_rep_id", contact.rep_user_id)
          .maybeSingle();

        if (!existingConnection) {
          // Create new connection
          const { error: connError } = await supabase
            .from("vendor_connections")
            .insert({
              vendor_id: vendorUserId,
              field_rep_id: contact.rep_user_id,
              status: "connected",
              requested_by: "vendor",
              requested_at: new Date().toISOString(),
              responded_at: new Date().toISOString(),
            });

          if (connError) {
            console.error("Error creating connection:", connError);
          } else {
            connectionsCreated++;
          }
        } else if (existingConnection.status !== "connected") {
          // Reactivate if ended
          await supabase
            .from("vendor_connections")
            .update({
              status: "connected",
              responded_at: new Date().toISOString(),
            })
            .eq("id", existingConnection.id);
        }

        // Mark contact as converted
        const { error: updateError } = await supabase
          .from("rep_vendor_contacts")
          .update({
            is_converted_to_vendor: true,
            is_active: false,
            converted_vendor_id: vendorUserId,
          })
          .eq("id", contact.id);

        if (updateError) {
          console.error("Error marking contact as converted:", updateError);
        } else {
          exactMatchesProcessed++;
        }
      }
    }

    // SCENARIO B: Soft match - same domain or similar company name
    let softMatchesUpdated = 0;

    if (vendorDomain) {
      // Find contacts with same domain but different email (not already exact matched)
      const { data: domainMatches, error: domainError } = await supabase
        .from("rep_vendor_contacts")
        .select("id, rep_user_id, company_name, contact_name, email")
        .eq("is_active", true)
        .eq("is_converted_to_vendor", false)
        .is("potential_vendor_profile_id", null)
        .neq("email", vendorEmailLower); // Exclude exact matches

      if (domainError) {
        console.error("Error finding domain matches:", domainError);
      }

      if (domainMatches) {
        for (const contact of domainMatches) {
          const contactDomain = contact.email.toLowerCase().split("@")[1] || "";
          const contactCompanyLower = (contact.company_name || "").toLowerCase().trim();
          const vendorCompanyLower = (vendorCompanyName || "").toLowerCase().trim();

          // Check domain match OR company name similarity
          const domainMatch = contactDomain === vendorDomain;
          const companyMatch = contactCompanyLower && vendorCompanyLower && 
            (contactCompanyLower.includes(vendorCompanyLower) || 
             vendorCompanyLower.includes(contactCompanyLower) ||
             // Simple fuzzy: check if significant words overlap
             hasSignificantWordOverlap(contactCompanyLower, vendorCompanyLower));

          if (domainMatch || companyMatch) {
            const { error: softMatchError } = await supabase
              .from("rep_vendor_contacts")
              .update({ potential_vendor_profile_id: vendorUserId })
              .eq("id", contact.id);

            if (softMatchError) {
              console.error("Error setting soft match:", softMatchError);
            } else {
              softMatchesUpdated++;
              console.log(`Soft match: ${contact.email} -> vendor ${vendorUserId} (domain: ${domainMatch}, company: ${companyMatch})`);
            }
          }
        }
      }
    }

    console.log(`Processed: ${exactMatchesProcessed} exact matches, ${connectionsCreated} connections created, ${softMatchesUpdated} soft matches`);

    return new Response(
      JSON.stringify({
        success: true,
        exactMatchesProcessed,
        connectionsCreated,
        softMatchesUpdated,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Error in process-vendor-contact-matches:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Helper: Check if two company names share significant words
function hasSignificantWordOverlap(name1: string, name2: string): boolean {
  const stopWords = new Set(["the", "and", "of", "inc", "llc", "ltd", "corp", "company", "co", "services", "group"]);
  
  const words1 = name1.split(/\s+/).filter(w => w.length > 2 && !stopWords.has(w));
  const words2 = name2.split(/\s+/).filter(w => w.length > 2 && !stopWords.has(w));
  
  if (words1.length === 0 || words2.length === 0) return false;
  
  const overlap = words1.filter(w => words2.includes(w));
  // Require at least one significant word overlap
  return overlap.length >= 1;
}
