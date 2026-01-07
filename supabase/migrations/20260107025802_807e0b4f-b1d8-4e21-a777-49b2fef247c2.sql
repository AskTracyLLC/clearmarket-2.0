CREATE OR REPLACE FUNCTION public.accept_territory_assignment(
  p_assignment_id uuid,
  p_rep_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_assignment record;
  v_rep_profile_id uuid;
  v_connection_id uuid;
  v_connection_created boolean := false;
  v_post record;
  v_vendor_name text;
  v_coverage_summary text;
  v_pricing_summary text;
BEGIN
  -- Get rep_profile.id for this user
  SELECT id INTO v_rep_profile_id
  FROM public.rep_profile
  WHERE user_id = p_rep_user_id;

  IF v_rep_profile_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Rep profile not found');
  END IF;

  -- Get and lock the assignment
  SELECT * INTO v_assignment
  FROM public.territory_assignments
  WHERE id = p_assignment_id
  FOR UPDATE;

  IF v_assignment IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Assignment not found');
  END IF;

  IF v_assignment.status != 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Assignment is not pending');
  END IF;

  IF v_assignment.rep_user_id != p_rep_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized to accept this assignment');
  END IF;

  -- Get the post details
  SELECT * INTO v_post
  FROM public.seeking_coverage_posts
  WHERE id = v_assignment.seeking_coverage_post_id;

  -- Build coverage and pricing summaries
  IF v_assignment.county_name IS NOT NULL AND v_assignment.county_name != '' THEN
    v_coverage_summary := v_assignment.county_name || ', ' || v_assignment.state_code;
  ELSE
    v_coverage_summary := v_assignment.state_code;
  END IF;

  v_pricing_summary := '$' || trim(to_char(v_assignment.agreed_rate, 'FM999999990.00')) || '/order';

  -- Update assignment status to active
  UPDATE public.territory_assignments
  SET 
    status = 'active',
    rep_confirmed_at = now(),
    rep_confirmed_by = p_rep_user_id,
    updated_at = now()
  WHERE id = p_assignment_id;

  -- Update rep_interest status to connected using rep_profile.id
  UPDATE public.rep_interest
  SET 
    status = 'connected',
    connected_at = now(),
    updated_at = now()
  WHERE post_id = v_assignment.seeking_coverage_post_id
    AND rep_id = v_rep_profile_id;

  -- Close the seeking coverage post
  UPDATE public.seeking_coverage_posts
  SET 
    status = 'closed',
    filled_by_rep_id = p_rep_user_id,
    filled_at = now(),
    closed_reason = 'filled',
    updated_at = now()
  WHERE id = v_assignment.seeking_coverage_post_id;

  -- Mark other interested reps as not_selected
  UPDATE public.rep_interest
  SET 
    status = 'not_selected',
    updated_at = now()
  WHERE post_id = v_assignment.seeking_coverage_post_id
    AND rep_id != v_rep_profile_id
    AND status NOT IN ('not_selected', 'declined', 'not_interested');

  -- Auto-decline other pending assignments for this post
  UPDATE public.territory_assignments
  SET 
    status = 'declined',
    declined_reason = 'Post filled by another rep',
    updated_at = now()
  WHERE seeking_coverage_post_id = v_assignment.seeking_coverage_post_id
    AND id != p_assignment_id
    AND status = 'pending';

  -- Check for existing connection
  SELECT id INTO v_connection_id
  FROM public.vendor_connections
  WHERE vendor_id = v_assignment.vendor_user_id
    AND rep_id = p_rep_user_id;

  IF v_connection_id IS NULL THEN
    -- Create new connection
    INSERT INTO public.vendor_connections (
      vendor_id,
      rep_id,
      status,
      initiator,
      created_source,
      created_at,
      updated_at
    ) VALUES (
      v_assignment.vendor_user_id,
      p_rep_user_id,
      'connected'::vendor_connection_status,
      'vendor'::vendor_connection_initiator,
      'seeking_coverage_assignment',
      now(),
      now()
    )
    RETURNING id INTO v_connection_id;
    
    v_connection_created := true;
  ELSE
    -- Update existing connection to active
    UPDATE public.vendor_connections
    SET 
      status = 'connected'::vendor_connection_status,
      updated_at = now()
    WHERE id = v_connection_id;
  END IF;

  -- Create or update agreement with coverage and pricing summaries
  INSERT INTO public.vendor_rep_agreements (
    vendor_id,
    field_rep_id,
    effective_date,
    work_type,
    source_seeking_coverage_post_id,
    status,
    coverage_summary,
    pricing_summary,
    created_at,
    updated_at
  ) VALUES (
    v_assignment.vendor_user_id,
    p_rep_user_id,
    COALESCE(v_assignment.effective_date, CURRENT_DATE),
    v_post.work_type,
    v_assignment.seeking_coverage_post_id,
    'active'::vendor_rep_agreement_status,
    v_coverage_summary,
    v_pricing_summary,
    now(),
    now()
  )
  ON CONFLICT (vendor_id, field_rep_id) DO UPDATE SET
    effective_date = EXCLUDED.effective_date,
    work_type = EXCLUDED.work_type,
    source_seeking_coverage_post_id = EXCLUDED.source_seeking_coverage_post_id,
    status = 'active'::vendor_rep_agreement_status,
    coverage_summary = EXCLUDED.coverage_summary,
    pricing_summary = EXCLUDED.pricing_summary,
    updated_at = now();

  -- Mark the rep's pending notification as read
  UPDATE public.notifications
  SET 
    is_read = true,
    read_at = now()
  WHERE user_id = p_rep_user_id
    AND ref_id = p_assignment_id
    AND type = 'territory_assignment_pending'
    AND is_read = false;

  -- Get vendor name for notification
  SELECT full_name INTO v_vendor_name
  FROM public.profiles
  WHERE id = v_assignment.vendor_user_id;

  -- Notify the vendor
  INSERT INTO public.notifications (
    user_id,
    type,
    title,
    body,
    ref_id,
    target_url,
    metadata,
    created_at
  ) VALUES (
    v_assignment.vendor_user_id,
    'territory_assignment_accepted',
    'Territory assignment accepted',
    'Your territory assignment has been accepted',
    p_assignment_id,
    '/vendor/my-reps',
    jsonb_build_object(
      'assignment_id', p_assignment_id::text,
      'rep_user_id', p_rep_user_id::text,
      'state_code', v_assignment.state_code,
      'county_name', v_assignment.county_name
    ),
    now()
  );

  RETURN jsonb_build_object(
    'success', true,
    'connection_id', v_connection_id,
    'connection_created', v_connection_created
  );
END;
$$;