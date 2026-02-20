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
    const url = new URL(req.url);
    const slug = url.searchParams.get('slug');

    if (!slug || typeof slug !== 'string') {
      return new Response(
        JSON.stringify({ error: 'SLUG_REQUIRED' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client with service role key
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Look up the profile by share_profile_slug
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, full_name, last_seen_at, is_fieldrep, is_vendor_admin, share_profile_enabled, community_score, anonymous_id, hide_trust_score_override, hide_community_score_override')
      .eq('share_profile_slug', slug)
      .eq('share_profile_enabled', true)
      .maybeSingle();

    if (profileError || !profile) {
      console.error('Profile not found:', profileError);
      return new Response(
        JSON.stringify({ error: 'PROFILE_NOT_FOUND' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = profile.id;
    const isRep = profile.is_fieldrep === true;
    const isVendor = profile.is_vendor_admin === true;

    // Fetch reviews for trust score calculation
    const { data: reviews, error: reviewsError } = await supabase
      .from('reviews')
      .select('rating_on_time, rating_quality, rating_communication, comment, created_at, direction')
      .eq('reviewee_id', userId)
      .eq('exclude_from_trust_score', false)
      .eq('is_hidden', false)
      .eq('status', 'published')
      .order('created_at', { ascending: false });

    if (reviewsError) {
      console.error('Reviews fetch error:', reviewsError);
    }

    // Calculate trust score
    let trustScore = 3.0; // Default baseline
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

      // Average of all ratings
      const allRatings = [];
      if (countOnTime > 0) allRatings.push(dimensions.on_time);
      if (countQuality > 0) allRatings.push(dimensions.quality);
      if (countCommunication > 0) allRatings.push(dimensions.communication);
      
      if (allRatings.length > 0) {
        trustScore = allRatings.reduce((a, b) => a + b, 0) / allRatings.length;
      }
    }

    // Recent reviews (up to 3)
    const recentReviews = (reviews || []).slice(0, 3).map(r => ({
      direction: r.direction,
      dimension_scores: {
        on_time: r.rating_on_time,
        quality: r.rating_quality,
        communication: r.rating_communication
      },
      comment: r.comment,
      created_at: r.created_at
    }));

    let profileData: any;

    if (isRep) {
      // Fetch rep profile
      const { data: repProfile, error: repError } = await supabase
        .from('rep_profile')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (repError) {
        console.error('Rep profile fetch error:', repError);
        return new Response(
          JSON.stringify({ error: 'PROFILE_NOT_FOUND' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Fetch coverage areas
      const { data: coverage } = await supabase
        .from('rep_coverage_areas')
        .select('state_code, state_name, county_name, covers_entire_state, covers_entire_county, region_note')
        .eq('user_id', userId)
        .order('state_code');

      // Build coverage summary
      const coverageByState = new Map<string, any>();
      (coverage || []).forEach(c => {
        if (!coverageByState.has(c.state_code)) {
          coverageByState.set(c.state_code, {
            state_code: c.state_code,
            state_name: c.state_name,
            covers_entire_state: c.covers_entire_state,
            counties: [],
            notes: []
          });
        }
        const state = coverageByState.get(c.state_code);
        if (c.county_name) {
          state.counties.push(c.county_name);
        }
        if (c.region_note && !state.notes.includes(c.region_note)) {
          state.notes.push(c.region_note);
        }
        if (c.covers_entire_state) {
          state.covers_entire_state = true;
        }
      });

      const coverageSummary = Array.from(coverageByState.values()).map(s => {
        if (s.covers_entire_state) {
          return `${s.state_name}: All counties`;
        }
        if (s.counties.length > 0) {
          const countyList = s.counties.length > 5 
            ? `${s.counties.slice(0, 5).join(', ')}... (+${s.counties.length - 5} more)`
            : s.counties.join(', ');
          return `${s.state_name}: ${countyList}`;
        }
        return s.state_name;
      });

      // Extract display name (first name + last initial)
      const fullName = profile.full_name || '';
      const nameParts = fullName.trim().split(' ');
      const firstName = nameParts[0] || '';
      const lastInitial = nameParts.length > 1 ? nameParts[nameParts.length - 1].charAt(0) + '.' : '';
      const displayName = firstName ? `${firstName} ${lastInitial}`.trim() : repProfile.anonymous_id;

      // Background check status
      let backgroundCheckStatus = 'Not provided';
      if (repProfile.background_check_is_active) {
        const provider = repProfile.background_check_provider === 'aspen_grove' 
          ? 'AspenGrove' 
          : repProfile.background_check_provider_other_name || 'Verified';
        backgroundCheckStatus = `Completed (${provider})`;
      } else if (repProfile.willing_to_obtain_background_check) {
        backgroundCheckStatus = 'Willing to obtain';
      }

      profileData = {
        role: 'rep',
        anonymous_id: profile.anonymous_id || repProfile.anonymous_id,
        display_name: displayName,
        location: [repProfile.city, repProfile.state].filter(Boolean).join(', ') || null,
        bio: repProfile.bio,
        trust_score: trustScore,
        review_count: reviewCount,
        community_score: profile.community_score || 0,
        hide_trust_score_override: profile.hide_trust_score_override ?? false,
        hide_community_score_override: profile.hide_community_score_override ?? false,
        dimensions,
        systems_used: repProfile.systems_used || [],
        inspection_types: repProfile.inspection_types || [],
        coverage_summary: coverageSummary,
        coverage_states: Array.from(coverageByState.keys()),
        background_check_status: backgroundCheckStatus,
        has_hud_keys: repProfile.has_hud_keys,
        hud_keys_details: repProfile.hud_keys_details,
        equipment_notes: repProfile.equipment_notes,
        certifications: repProfile.certifications || [],
        is_accepting_new_vendors: repProfile.is_accepting_new_vendors,
        willing_to_travel: repProfile.willing_to_travel_out_of_state,
        last_active: profile.last_seen_at,
        recent_reviews: recentReviews
      };

    } else if (isVendor) {
      // Fetch vendor profile
      const { data: vendorProfile, error: vendorError } = await supabase
        .from('vendor_profile')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (vendorError) {
        console.error('Vendor profile fetch error:', vendorError);
        return new Response(
          JSON.stringify({ error: 'PROFILE_NOT_FOUND' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Fetch coverage areas
      const { data: coverage } = await supabase
        .from('vendor_coverage_areas')
        .select('state_code, state_name, coverage_mode, region_note, excluded_county_ids, included_county_ids')
        .eq('user_id', userId)
        .order('state_code');

      const coverageByState = new Map<string, any>();
      (coverage || []).forEach(c => {
        if (!coverageByState.has(c.state_code)) {
          coverageByState.set(c.state_code, {
            state_code: c.state_code,
            state_name: c.state_name,
            coverage_mode: c.coverage_mode || 'selected_counties',
            excluded_county_ids: c.excluded_county_ids || [],
            included_county_ids: c.included_county_ids || [],
            notes: []
          });
        }
        const state = coverageByState.get(c.state_code);
        if (c.region_note && !state.notes.includes(c.region_note)) {
          state.notes.push(c.region_note);
        }
      });

      // Resolve county names for partial-coverage states
      const allCountyIds: string[] = [];
      for (const s of coverageByState.values()) {
        if (s.coverage_mode === 'entire_state_except' && s.excluded_county_ids?.length) {
          allCountyIds.push(...s.excluded_county_ids);
        }
        if (s.coverage_mode === 'selected_counties' && s.included_county_ids?.length) {
          allCountyIds.push(...s.included_county_ids);
        }
      }

      let countyNameMap = new Map<string, string>();
      if (allCountyIds.length > 0) {
        const uniqueIds = [...new Set(allCountyIds)];
        const { data: countyRows } = await supabase
          .from('us_counties')
          .select('id, county_name')
          .in('id', uniqueIds);
        (countyRows || []).forEach((r: any) => countyNameMap.set(r.id, r.county_name));
      }

      // Build structured coverage details
      const coverageDetails = Array.from(coverageByState.values()).map(s => {
        let counties: string[] = [];
        if (s.coverage_mode === 'entire_state_except' && s.excluded_county_ids?.length) {
          counties = s.excluded_county_ids.map((id: string) => countyNameMap.get(id) || id).sort();
        } else if (s.coverage_mode === 'selected_counties' && s.included_county_ids?.length) {
          counties = s.included_county_ids.map((id: string) => countyNameMap.get(id) || id).sort();
        }
        return {
          state_code: s.state_code,
          state_name: s.state_name,
          coverage_mode: s.coverage_mode,
          counties,
        };
      });

      const coverageSummary = Array.from(coverageByState.values()).map(s => {
        if (s.coverage_mode === 'entire_state') {
          return `${s.state_name}: All counties`;
        }
        if (s.coverage_mode === 'entire_state_except') {
          return `${s.state_name}: Most counties`;
        }
        return s.state_name;
      });

      // Build seeking coverage areas from active posts + junction table (source of truth)
      let seekingCoverageAreas: { state_code: string; counties: string[] }[] = [];
      if (vendorProfile.show_seeking_coverage_on_public_profile) {
        // 1. Fetch all active, non-deleted posts for this vendor
        const { data: scPosts } = await supabase
          .from('seeking_coverage_posts')
          .select('id, state_code, covers_entire_state, county_id')
          .eq('vendor_id', userId)
          .eq('status', 'active')
          .is('deleted_at', null)
          .not('state_code', 'is', null);

        if (scPosts && scPosts.length > 0) {
          // Track which states are "entire state" vs need county resolution
          const stateEntire = new Set<string>();
          const stateCountyIds = new Map<string, Set<string>>();

          for (const post of scPosts) {
            const sc = post.state_code as string;
            if (post.covers_entire_state) {
              stateEntire.add(sc);
            } else {
              if (!stateCountyIds.has(sc)) stateCountyIds.set(sc, new Set());
            }
          }

          // 2. Fetch junction-table county_ids for non-entire-state posts
          const nonEntirePostIds = scPosts
            .filter(p => !p.covers_entire_state)
            .map(p => p.id);

          if (nonEntirePostIds.length > 0) {
            const { data: junctionRows } = await supabase
              .from('seeking_coverage_post_counties')
              .select('post_id, county_id')
              .in('post_id', nonEntirePostIds);

            // Map junction rows back to their state
            const postStateMap = new Map<string, string>();
            for (const p of scPosts) {
              postStateMap.set(p.id, p.state_code as string);
            }

            for (const jr of (junctionRows || [])) {
              const sc = postStateMap.get(jr.post_id);
              if (sc && !stateEntire.has(sc)) {
                if (!stateCountyIds.has(sc)) stateCountyIds.set(sc, new Set());
                stateCountyIds.get(sc)!.add(jr.county_id);
              }
            }

            // 3. Also include legacy county_id from posts (fallback)
            for (const p of scPosts) {
              if (!p.covers_entire_state && p.county_id) {
                const sc = p.state_code as string;
                if (!stateEntire.has(sc)) {
                  if (!stateCountyIds.has(sc)) stateCountyIds.set(sc, new Set());
                  stateCountyIds.get(sc)!.add(p.county_id);
                }
              }
            }
          }

          // 4. Resolve county IDs to names
          const allIds: string[] = [];
          for (const ids of stateCountyIds.values()) {
            for (const id of ids) allIds.push(id);
          }
          const uniqueIds = [...new Set(allIds)];

          let scCountyNameMap = new Map<string, string>();
          if (uniqueIds.length > 0) {
            const { data: cRows } = await supabase
              .from('us_counties')
              .select('id, county_name')
              .in('id', uniqueIds);
            for (const r of (cRows || [])) {
              scCountyNameMap.set(r.id, r.county_name);
            }
          }

          // 5. Build final array grouped by state
          const allStates = new Set([...stateEntire, ...stateCountyIds.keys()]);
          const sortedStates = [...allStates].sort();

          seekingCoverageAreas = sortedStates.map(sc => {
            // Entire-state wins if ANY post in that state is entire-state
            if (stateEntire.has(sc)) {
              return { state_code: sc, counties: ['All counties'] };
            }
            const ids = stateCountyIds.get(sc);
            const names = ids
              ? [...ids].map(id => scCountyNameMap.get(id) || id).sort()
              : [];
            return { state_code: sc, counties: [...new Set(names)] };
          });
        }
      }

      // Extract display name
      const fullName = profile.full_name || '';
      const nameParts = fullName.trim().split(' ');
      const firstName = nameParts[0] || '';
      const lastInitial = nameParts.length > 1 ? nameParts[nameParts.length - 1].charAt(0) + '.' : '';
      const contactName = firstName ? `${firstName} ${lastInitial}`.trim() : null;

      profileData = {
        role: 'vendor',
        anonymous_id: vendorProfile.anonymous_id,
        company_name: vendorProfile.company_name,
        display_name: vendorProfile.company_name,
        contact_name: contactName,
        location: [vendorProfile.city, vendorProfile.state].filter(Boolean).join(', ') || null,
        company_description: vendorProfile.company_description,
        website: vendorProfile.website,
        trust_score: trustScore,
        review_count: reviewCount,
        community_score: profile.community_score || 0,
        hide_trust_score_override: profile.hide_trust_score_override ?? false,
        hide_community_score_override: profile.hide_community_score_override ?? false,
        dimensions,
        systems_used: vendorProfile.systems_used || [],
        inspection_types: vendorProfile.primary_inspection_types || [],
        coverage_summary: coverageSummary,
        coverage_details: coverageDetails,
        is_accepting_new_reps: vendorProfile.is_accepting_new_reps,
        seeking_coverage_areas: seekingCoverageAreas,
        last_active: profile.last_seen_at,
        recent_reviews: recentReviews
      };
    } else {
      return new Response(
        JSON.stringify({ error: 'INVALID_ROLE' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify(profileData),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in public-profile-share:', error);
    return new Response(
      JSON.stringify({ error: 'INTERNAL_ERROR' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
