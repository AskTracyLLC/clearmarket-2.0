
-- Add unique constraint on vendor_rep_agreements for upsert to work
ALTER TABLE public.vendor_rep_agreements
ADD CONSTRAINT vendor_rep_agreements_vendor_rep_unique UNIQUE (vendor_id, field_rep_id);

-- Fix the accept_territory_assignment function with proper enum casts
CREATE OR REPLACE FUNCTION public.accept_territory_assignment(
  p_assignment_id uuid,
  p_rep_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_assignment RECORD;
  v_connection_id uuid;
  v_connection_created boolean := false;
  v_work_type text;
BEGIN
  -- Get and verify assignment
  SELECT * INTO v_assignment
  FROM public.territory_assignments
  WHERE id = p_assignment_id
  FOR UPDATE;
  
  IF v_assignment IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Assignment not found');
  END IF;
  
  IF v_assignment.status <> 'pending_rep' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Assignment is not pending');
  END IF;
  
  IF v_assignment.rep_id <> p_rep_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized to accept this assignment');
  END IF;
  
  -- Update assignment to active
  UPDATE public.territory_assignments
  SET 
    status = 'active',
    rep_confirmed_at = now(),
    rep_confirmed_by = p_rep_user_id,
    updated_at = now()
  WHERE id = p_assignment_id;
  
  -- Update seeking coverage post if linked
  IF v_assignment.seeking_coverage_post_id IS NOT NULL THEN
    UPDATE public.seeking_coverage_posts
    SET 
      status = 'closed',
      closed_reason = 'filled',
      filled_by_rep_id = p_rep_user_id,
      filled_at = now(),
      has_pending_assignment = false,
      updated_at = now()
    WHERE id = v_assignment.seeking_coverage_post_id;
    
    -- Mark other interested reps as not_selected
    UPDATE public.rep_interest
    SET 
      status = 'not_selected',
      updated_at = now()
    WHERE post_id = v_assignment.seeking_coverage_post_id
      AND status = 'interested'
      AND rep_id <> v_assignment.rep_id;
    
    -- Decline other pending territory assignments for this post
    UPDATE public.territory_assignments
    SET 
      status = 'declined',
      decline_reason = 'Post filled by another rep',
      updated_at = now()
    WHERE seeking_coverage_post_id = v_assignment.seeking_coverage_post_id
      AND status = 'pending_rep'
      AND id <> p_assignment_id;
  END IF;
  
  -- Create or activate vendor-rep connection
  SELECT id INTO v_connection_id
  FROM public.vendor_connections
  WHERE vendor_id = v_assignment.vendor_id
    AND field_rep_id = v_assignment.rep_id;
  
  IF v_connection_id IS NULL THEN
    -- Create new connection with proper enum casts
    INSERT INTO public.vendor_connections (
      vendor_id,
      field_rep_id,
      status,
      requested_by,
      responded_at,
      conversation_id
    ) VALUES (
      v_assignment.vendor_id,
      v_assignment.rep_id,
      'connected'::vendor_connection_status,
      'vendor'::vendor_connection_initiator,
      now(),
      v_assignment.conversation_id
    )
    RETURNING id INTO v_connection_id;
    
    v_connection_created := true;
  ELSE
    -- Ensure existing connection is active
    UPDATE public.vendor_connections
    SET 
      status = 'connected'::vendor_connection_status,
      responded_at = COALESCE(responded_at, now()),
      updated_at = now()
    WHERE id = v_connection_id
      AND status <> 'connected'::vendor_connection_status;
    
    IF FOUND THEN
      v_connection_created := true;
    END IF;
  END IF;
  
  -- Create or update vendor_rep_agreements
  v_work_type := array_to_string(v_assignment.inspection_types, ', ');
  
  INSERT INTO public.vendor_rep_agreements (
    vendor_id,
    field_rep_id,
    status,
    base_rate,
    effective_date,
    source_seeking_coverage_post_id,
    states_covered,
    work_type
  ) VALUES (
    v_assignment.vendor_id,
    v_assignment.rep_id,
    'active'::vendor_rep_agreement_status,
    v_assignment.agreed_rate,
    v_assignment.effective_date::date,
    v_assignment.seeking_coverage_post_id,
    ARRAY[v_assignment.state_code],
    v_work_type
  )
  ON CONFLICT (vendor_id, field_rep_id) DO UPDATE
  SET 
    status = 'active'::vendor_rep_agreement_status,
    base_rate = EXCLUDED.base_rate,
    effective_date = EXCLUDED.effective_date,
    source_seeking_coverage_post_id = EXCLUDED.source_seeking_coverage_post_id,
    states_covered = EXCLUDED.states_covered,
    work_type = EXCLUDED.work_type,
    updated_at = now();
  
  -- Create notification for vendor
  INSERT INTO public.notifications (
    user_id,
    type,
    title,
    body,
    ref_id
  ) VALUES (
    v_assignment.vendor_id,
    'territory_assignment_accepted',
    'Territory assignment accepted',
    CASE 
      WHEN v_connection_created THEN
        'Rep accepted the assignment for ' || COALESCE(v_assignment.county_name || ', ', '') || v_assignment.state_code || 
        ' at $' || v_assignment.agreed_rate || '/order. They have been added to your network.'
      ELSE
        'Rep accepted the assignment for ' || COALESCE(v_assignment.county_name || ', ', '') || v_assignment.state_code || 
        ' at $' || v_assignment.agreed_rate || '/order.'
    END,
    p_assignment_id
  );
  
  -- Mark rep's pending notification as read
  UPDATE public.notifications
  SET is_read = true
  WHERE ref_id = p_assignment_id::text
    AND type = 'territory_assignment'
    AND user_id = p_rep_user_id;
  
  RETURN jsonb_build_object(
    'success', true, 
    'connection_created', v_connection_created,
    'connection_id', v_connection_id
  );
END;
$$;
