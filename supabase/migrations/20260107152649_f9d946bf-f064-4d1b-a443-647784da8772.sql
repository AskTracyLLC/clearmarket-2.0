-- Drop and recreate the backfill function with corrected logic
DROP FUNCTION IF EXISTS public.backfill_working_terms_from_territory_assignments();

CREATE OR REPLACE FUNCTION public.backfill_working_terms_from_territory_assignments()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_created_requests integer := 0;
  v_created_rows integer := 0;
BEGIN
  /*
    Step A) Create an active working_terms_requests row for every vendor+rep pair
            that has at least one ACTIVE territory assignment and no active request.
  */
  WITH pairs AS (
    SELECT DISTINCT ta.vendor_id, ta.rep_id
    FROM public.territory_assignments ta
    WHERE ta.status = 'active'
  ),
  inserted AS (
    INSERT INTO public.working_terms_requests (
      vendor_id,
      rep_id,
      requested_states,
      requested_counties,
      message_from_vendor,
      status,
      created_at,
      updated_at
    )
    SELECT
      p.vendor_id,
      p.rep_id,
      (SELECT array_agg(DISTINCT x.state_code) FILTER (WHERE x.state_code IS NOT NULL AND btrim(x.state_code) <> '')
       FROM public.territory_assignments x
       WHERE x.vendor_id = p.vendor_id AND x.rep_id = p.rep_id AND x.status = 'active'),
      (SELECT array_agg(DISTINCT x.county_name) FILTER (WHERE x.county_name IS NOT NULL AND btrim(x.county_name) <> '')
       FROM public.territory_assignments x
       WHERE x.vendor_id = p.vendor_id AND x.rep_id = p.rep_id AND x.status = 'active'),
      'Auto-backfilled from active territory assignments.',
      'active',
      now(),
      now()
    FROM pairs p
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.working_terms_requests r
      WHERE r.vendor_id = p.vendor_id
        AND r.rep_id = p.rep_id
        AND r.status = 'active'
    )
    RETURNING 1
  )
  SELECT count(*) INTO v_created_requests FROM inserted;

  /*
    Step B) Insert missing working_terms_rows for each active assignment + each inspection_type
            (or 'general' if array is empty).
            We attach rows to the most recent active working_terms_request for that pair.
  */
  WITH active_req AS (
    SELECT DISTINCT ON (vendor_id, rep_id)
      id AS working_terms_request_id,
      vendor_id,
      rep_id
    FROM public.working_terms_requests
    WHERE status = 'active'
    ORDER BY vendor_id, rep_id, created_at DESC
  ),
  expanded AS (
    SELECT
      ar.working_terms_request_id,
      ta.vendor_id,
      ta.rep_id,
      ta.state_code,
      NULLIF(btrim(ta.county_name), '') AS county_name,
      COALESCE(NULLIF(btrim(it.inspection_type), ''), 'general') AS inspection_type,
      ta.agreed_rate AS rate,
      COALESCE(ta.effective_date, current_date) AS effective_from
    FROM public.territory_assignments ta
    JOIN active_req ar
      ON ar.vendor_id = ta.vendor_id AND ar.rep_id = ta.rep_id
    LEFT JOIN LATERAL (
      SELECT unnest(ta.inspection_types) AS inspection_type
      UNION ALL
      SELECT 'general' WHERE COALESCE(array_length(ta.inspection_types, 1), 0) = 0
    ) it ON true
    WHERE ta.status = 'active'
  ),
  inserted_rows AS (
    INSERT INTO public.working_terms_rows (
      working_terms_request_id,
      vendor_id,
      rep_id,
      state_code,
      county_name,
      inspection_type,
      rate,
      turnaround_days,
      source,
      included,
      effective_from,
      status,
      created_at,
      updated_at
    )
    SELECT
      e.working_terms_request_id,
      e.vendor_id,
      e.rep_id,
      e.state_code,
      e.county_name,
      e.inspection_type,
      e.rate,
      NULL,
      'territory_assignment_backfill',
      true,
      e.effective_from,
      'active',
      now(),
      now()
    FROM expanded e
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.working_terms_rows w
      WHERE w.working_terms_request_id = e.working_terms_request_id
        AND w.vendor_id = e.vendor_id
        AND w.rep_id = e.rep_id
        AND w.state_code = e.state_code
        AND COALESCE(w.county_name, '') = COALESCE(e.county_name, '')
        AND w.inspection_type = e.inspection_type
        AND w.status = 'active'
    )
    RETURNING 1
  )
  SELECT count(*) INTO v_created_rows FROM inserted_rows;

  /*
    Step C) Refresh requested_states/requested_counties arrays for all active requests
  */
  UPDATE public.working_terms_requests r
  SET
    requested_states = (
      SELECT array_agg(DISTINCT ta.state_code) FILTER (WHERE ta.state_code IS NOT NULL AND btrim(ta.state_code) <> '')
      FROM public.territory_assignments ta
      WHERE ta.vendor_id = r.vendor_id
        AND ta.rep_id = r.rep_id
        AND ta.status = 'active'
    ),
    requested_counties = (
      SELECT array_agg(DISTINCT ta.county_name) FILTER (WHERE ta.county_name IS NOT NULL AND btrim(ta.county_name) <> '')
      FROM public.territory_assignments ta
      WHERE ta.vendor_id = r.vendor_id
        AND ta.rep_id = r.rep_id
        AND ta.status = 'active'
    ),
    updated_at = now()
  WHERE r.status = 'active';

  RETURN jsonb_build_object(
    'success', true,
    'created_requests', v_created_requests,
    'created_rows', v_created_rows
  );
END;
$$;