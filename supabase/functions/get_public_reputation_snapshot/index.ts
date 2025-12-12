import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.86.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { slug } = await req.json();

    if (!slug || typeof slug !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Slug is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client with service role key
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Look up the share link
    const { data: shareLink, error: linkError } = await supabase
      .from('reputation_share_links')
      .select('*')
      .eq('slug', slug)
      .eq('is_enabled', true)
      .maybeSingle();

    if (linkError || !shareLink) {
      console.error('Share link not found:', linkError);
      return new Response(
        JSON.stringify({ error: 'Snapshot not found or disabled' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { user_id, role_type } = shareLink;

    // Fetch profile data
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('full_name, last_seen_at')
      .eq('id', user_id)
      .single();

    if (profileError) {
      console.error('Profile fetch error:', profileError);
      return new Response(
        JSON.stringify({ error: 'Unable to load profile data' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch accepted reviews for trust score calculation
    const { data: reviews, error: reviewsError } = await supabase
      .from('reviews')
      .select('rating_on_time, rating_quality, rating_communication, comment, created_at, direction, state_code, county_name, inspection_category, is_spotlighted')
      .eq('reviewee_id', user_id)
      .eq('exclude_from_trust_score', false)
      .eq('is_hidden', false)
      .eq('workflow_status', 'accepted')
      .neq('status', 'coaching')
      .order('created_at', { ascending: false });

    if (reviewsError) {
      console.error('Reviews fetch error:', reviewsError);
    }

    // Fetch spotlighted reviews separately (only accepted + spotlighted)
    const { data: spotlightedReviews, error: spotlightedError } = await supabase
      .from('reviews')
      .select(`
        rating_on_time, rating_quality, rating_communication, comment, created_at, 
        state_code, county_name, inspection_category,
        reviewer:reviewer_id (
          id
        )
      `)
      .eq('reviewee_id', user_id)
      .eq('workflow_status', 'accepted')
      .eq('is_spotlighted', true)
      .neq('status', 'coaching')
      .order('created_at', { ascending: false })
      .limit(5);

    if (spotlightedError) {
      console.error('Spotlighted reviews fetch error:', spotlightedError);
    }

    // Fetch vendor profiles for spotlighted reviews
    const spotlightedWithVendor = [];
    if (spotlightedReviews && spotlightedReviews.length > 0) {
      for (const review of spotlightedReviews) {
        const reviewerId = (review.reviewer as any)?.id;
        let vendorName = 'Anonymous Vendor';
        
        if (reviewerId) {
          const { data: vendorProfile } = await supabase
            .from('vendor_profile')
            .select('anonymous_id, company_name')
            .eq('user_id', reviewerId)
            .maybeSingle();
          
          if (vendorProfile) {
            vendorName = vendorProfile.company_name || vendorProfile.anonymous_id || 'Anonymous Vendor';
          }
        }
        
        spotlightedWithVendor.push({
          ...review,
          vendor_name: vendorName
        });
      }
    }

    // Calculate trust score
    let trustScore = 0;
    let dimensions = { on_time: 0, quality: 0, communication: 0 };
    const reviewCount = reviews?.length || 0;

    if (reviews && reviews.length > 0) {
      let totalOnTime = 0, totalQuality = 0, totalCommunication = 0;
      let countOnTime = 0, countQuality = 0, countCommunication = 0;

      for (const review of reviews) {
        if (review.rating_on_time !== null) {
          totalOnTime += review.rating_on_time;
          countOnTime++;
        }
        if (review.rating_quality !== null) {
          totalQuality += review.rating_quality;
          countQuality++;
        }
        if (review.rating_communication !== null) {
          totalCommunication += review.rating_communication;
          countCommunication++;
        }
      }

      dimensions.on_time = countOnTime > 0 ? totalOnTime / countOnTime : 0;
      dimensions.quality = countQuality > 0 ? totalQuality / countQuality : 0;
      dimensions.communication = countCommunication > 0 ? totalCommunication / countCommunication : 0;

      // Trust Score is the average of the three dimensions (1-5 scale)
      trustScore = (dimensions.on_time + dimensions.quality + dimensions.communication) / 3;
    }

    const getTrustLabel = (score: number) => {
      if (score >= 4.5) return 'Excellent';
      if (score >= 4.0) return 'Very Good';
      if (score >= 3.5) return 'Good';
      if (score >= 3.0) return 'Average';
      if (score > 0) return 'Building Reputation';
      return 'No Reviews Yet';
    };

    // Format area helper
    const formatArea = (stateCode: string | null, countyName: string | null) => {
      if (countyName && stateCode) return `${countyName}, ${stateCode}`;
      if (stateCode) return stateCode;
      return 'Overall';
    };

    // Recent reviews (up to 3)
    const recentReviews = (reviews || []).slice(0, 3).map(r => ({
      direction: r.direction,
      dimension_scores: {
        on_time: r.rating_on_time,
        quality: r.rating_quality,
        communication: r.rating_communication
      },
      comment: r.comment,
      created_at: r.created_at,
      area: formatArea(r.state_code, r.county_name),
      work_type: r.inspection_category || 'Overall'
    }));

    // Spotlighted reviews formatted
    const formattedSpotlighted = spotlightedWithVendor.map(r => ({
      vendor_name: r.vendor_name,
      dimension_scores: {
        on_time: r.rating_on_time,
        quality: r.rating_quality,
        communication: r.rating_communication
      },
      comment: r.comment,
      created_at: r.created_at,
      area: formatArea(r.state_code, r.county_name),
      work_type: r.inspection_category || 'Overall'
    }));

    let snapshot: any;

    if (role_type === 'rep') {
      // Fetch rep profile
      const { data: repProfile, error: repError } = await supabase
        .from('rep_profile')
        .select('anonymous_id, city, state, zip_code, systems_used, inspection_types, background_check_is_active, background_check_provider, willing_to_obtain_background_check, has_hud_keys, hud_keys_details, equipment_notes, is_accepting_new_vendors')
        .eq('user_id', user_id)
        .single();

      if (repError) {
        console.error('Rep profile fetch error:', repError);
        return new Response(
          JSON.stringify({ error: 'Unable to load rep profile' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Fetch coverage summary
      const { data: coverage } = await supabase
        .from('rep_coverage_areas')
        .select('state_code, state_name, region_note')
        .eq('user_id', user_id);

      const coverageStates = [...new Set((coverage || []).map(c => c.state_code))].sort();
      const coverageNotes = (coverage || [])
        .filter(c => c.region_note)
        .map(c => c.region_note)
        .join('; ');

      const coverageSummary = coverageStates.length > 0
        ? `${coverageStates.join(', ')}${coverageNotes ? ' – ' + coverageNotes : ''}`
        : 'Coverage not specified';

      // Extract first name + last initial
      const displayName = profile.full_name
        ? `${repProfile.anonymous_id} (${profile.full_name.split(' ')[0]} ${profile.full_name.split(' ').slice(-1)[0]?.charAt(0) || ''}.)`
        : repProfile.anonymous_id;

      snapshot = {
        anonymous_id: repProfile.anonymous_id,
        display_name: displayName,
        location: [repProfile.city, repProfile.state].filter(Boolean).join(', ') || 'Location not specified',
        trust_score: trustScore,
        trust_score_label: getTrustLabel(trustScore),
        dimensions,
        review_count: reviewCount,
        background_check: {
          has_active: repProfile.background_check_is_active || false,
          provider: repProfile.background_check_provider || null,
          is_willing_to_obtain: repProfile.willing_to_obtain_background_check || false
        },
        hud_keys: repProfile.has_hud_keys ? (repProfile.hud_keys_details || 'Yes') : null,
        equipment_summary: repProfile.equipment_notes || null,
        coverage_summary: coverageSummary,
        systems_used: repProfile.systems_used || [],
        inspection_types: repProfile.inspection_types || [],
        last_active: profile.last_seen_at,
        accepting_new_vendors: repProfile.is_accepting_new_vendors,
        recent_reviews: recentReviews,
        spotlighted_reviews: formattedSpotlighted
      };

    } else if (role_type === 'vendor') {
      // Fetch vendor profile
      const { data: vendorProfile, error: vendorError } = await supabase
        .from('vendor_profile')
        .select('anonymous_id, company_name, city, state, systems_used, primary_inspection_types, is_accepting_new_reps, company_description')
        .eq('user_id', user_id)
        .single();

      if (vendorError) {
        console.error('Vendor profile fetch error:', vendorError);
        return new Response(
          JSON.stringify({ error: 'Unable to load vendor profile' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Fetch coverage summary
      const { data: coverage } = await supabase
        .from('vendor_coverage_areas')
        .select('state_code, state_name, region_note')
        .eq('user_id', user_id);

      const coverageStates = [...new Set((coverage || []).map(c => c.state_code))].sort();
      const coverageNotes = (coverage || [])
        .filter(c => c.region_note)
        .map(c => c.region_note)
        .join('; ');

      const coverageSummary = coverageStates.length > 0
        ? `${coverageStates.join(', ')}${coverageNotes ? ' – ' + coverageNotes : ''}`
        : 'Coverage not specified';

      const displayName = profile.full_name
        ? `${vendorProfile.company_name} (${profile.full_name.split(' ')[0]} ${profile.full_name.split(' ').slice(-1)[0]?.charAt(0) || ''}.)`
        : vendorProfile.company_name;

      snapshot = {
        anonymous_id: vendorProfile.anonymous_id,
        company_name: vendorProfile.company_name,
        display_name: displayName,
        location: [vendorProfile.city, vendorProfile.state].filter(Boolean).join(', ') || 'Location not specified',
        trust_score: trustScore,
        trust_score_label: getTrustLabel(trustScore),
        dimensions,
        review_count: reviewCount,
        coverage_summary: coverageSummary,
        systems_used: vendorProfile.systems_used || [],
        inspection_types: vendorProfile.primary_inspection_types || [],
        accepting_new_reps: vendorProfile.is_accepting_new_reps,
        company_description: vendorProfile.company_description,
        last_active: profile.last_seen_at,
        recent_reviews: recentReviews
      };
    } else {
      return new Response(
        JSON.stringify({ error: 'Invalid role type' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Increment view count
    await supabase
      .from('reputation_share_links')
      .update({
        view_count: shareLink.view_count + 1,
        last_viewed_at: new Date().toISOString()
      })
      .eq('id', shareLink.id);

    return new Response(
      JSON.stringify({
        slug,
        role_type,
        user_id,
        snapshot
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in get_public_reputation_snapshot:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});