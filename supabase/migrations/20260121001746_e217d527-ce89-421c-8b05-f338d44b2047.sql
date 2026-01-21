BEGIN;

-- Fix rep_active_boost_status
DROP VIEW IF EXISTS public.rep_active_boost_status;
CREATE VIEW public.rep_active_boost_status
WITH (security_invoker = true)
AS
SELECT
  rep_user_id,
  true AS is_boosted,
  max(ends_at) AS active_ends_at,
  max(starts_at) AS active_starts_at
FROM public.rep_visibility_boosts
WHERE status = 'active' AND ends_at > now()
GROUP BY rep_user_id;

-- Fix rep_alert_sent_status
DROP VIEW IF EXISTS public.rep_alert_sent_status;
CREATE VIEW public.rep_alert_sent_status
WITH (security_invoker = true)
AS
SELECT
  p.id AS rep_user_id,
  EXISTS (
    SELECT 1
    FROM public.vendor_alerts va
    WHERE va.rep_user_id = p.id
      AND va.sent_at IS NOT NULL
  ) AS has_sent_alert
FROM public.profiles p
WHERE p.is_fieldrep = true;

-- Fix rep_onboarding_status
DROP VIEW IF EXISTS public.rep_onboarding_status;
CREATE VIEW public.rep_onboarding_status
WITH (security_invoker = true)
AS
SELECT
  p.id AS rep_user_id,
  (cardinality(x.missing_required) = 0) AS is_complete,
  x.missing_required
FROM public.profiles p
LEFT JOIN public.rep_profile rp ON rp.user_id = p.id
CROSS JOIN LATERAL (
  SELECT array_remove(ARRAY[
    CASE WHEN rp.user_id IS NULL THEN 'profile'::text ELSE NULL::text END,
    CASE WHEN rp.city IS NULL OR rp.state IS NULL THEN 'location'::text ELSE NULL::text END,
    CASE WHEN rp.inspection_types IS NULL OR COALESCE(array_length(rp.inspection_types, 1), 0) = 0 THEN 'inspection_types'::text ELSE NULL::text END,
    CASE WHEN NOT EXISTS (
      SELECT 1
      FROM public.rep_coverage_areas rca
      WHERE rca.user_id = p.id
        AND rca.base_price IS NOT NULL
        AND rca.base_price > 0::numeric
    ) THEN 'coverage_pricing'::text ELSE NULL::text END,
    CASE WHEN NOT EXISTS (
      SELECT 1
      FROM public.vendor_alerts va
      WHERE va.rep_user_id = p.id
        AND va.sent_at IS NOT NULL
    ) THEN 'route_alert_sent'::text ELSE NULL::text END
  ], NULL::text) AS missing_required
) x
WHERE p.is_fieldrep = true;

-- Fix rep_profile_pricing_status
DROP VIEW IF EXISTS public.rep_profile_pricing_status;
CREATE VIEW public.rep_profile_pricing_status
WITH (security_invoker = true)
AS
SELECT
  p.id AS rep_user_id,
  (cardinality(x.missing_required) = 0) AS is_complete,
  x.missing_required
FROM public.profiles p
LEFT JOIN public.rep_profile rp ON rp.user_id = p.id
CROSS JOIN LATERAL (
  SELECT array_remove(ARRAY[
    CASE WHEN rp.user_id IS NULL THEN 'profile'::text ELSE NULL::text END,
    CASE WHEN rp.city IS NULL OR rp.state IS NULL THEN 'location'::text ELSE NULL::text END,
    CASE WHEN rp.inspection_types IS NULL OR COALESCE(array_length(rp.inspection_types, 1), 0) = 0 THEN 'inspection_types'::text ELSE NULL::text END,
    CASE WHEN NOT EXISTS (
      SELECT 1
      FROM public.rep_coverage_areas rca
      WHERE rca.user_id = p.id
        AND rca.base_price IS NOT NULL
        AND rca.base_price > 0::numeric
    ) THEN 'coverage_pricing'::text ELSE NULL::text END
  ], NULL::text) AS missing_required
) x
WHERE p.is_fieldrep = true;

-- Fix support_queue_open_counts_by_category
DROP VIEW IF EXISTS public.support_queue_open_counts_by_category;
CREATE VIEW public.support_queue_open_counts_by_category
WITH (security_invoker = true)
AS
SELECT
  category,
  count(*)::integer AS open_count
FROM public.support_queue_items
WHERE status NOT IN ('resolved', 'cancelled')
GROUP BY category;

-- Fix vendor_onboarding_status
DROP VIEW IF EXISTS public.vendor_onboarding_status;
CREATE VIEW public.vendor_onboarding_status
WITH (security_invoker = true)
AS
SELECT
  vp.id AS vendor_id,
  (cardinality(x.missing_required) = 0) AS is_complete,
  x.missing_required
FROM public.vendor_profile vp
CROSS JOIN LATERAL (
  SELECT array_remove(ARRAY[
    CASE WHEN vp.company_name IS NULL THEN 'company_name'::text ELSE NULL::text END,
    CASE WHEN vp.city IS NULL OR vp.state IS NULL THEN 'location'::text ELSE NULL::text END,
    CASE WHEN vp.primary_inspection_types IS NULL OR COALESCE(array_length(vp.primary_inspection_types, 1), 0) = 0 THEN 'inspection_types'::text ELSE NULL::text END,
    CASE WHEN NOT EXISTS (
      SELECT 1
      FROM public.vendor_coverage_areas vca
      WHERE vca.user_id = vp.user_id
    ) THEN 'coverage_area'::text ELSE NULL::text END
  ], NULL::text) AS missing_required
) x;

-- Grant SELECT on all views to authenticated users
GRANT SELECT ON public.rep_active_boost_status TO authenticated;
GRANT SELECT ON public.rep_alert_sent_status TO authenticated;
GRANT SELECT ON public.rep_onboarding_status TO authenticated;
GRANT SELECT ON public.rep_profile_pricing_status TO authenticated;
GRANT SELECT ON public.support_queue_open_counts_by_category TO authenticated;
GRANT SELECT ON public.vendor_onboarding_status TO authenticated;

COMMIT;