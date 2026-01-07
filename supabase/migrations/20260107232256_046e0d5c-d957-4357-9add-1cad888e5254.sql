-- Public state-level network counts (privacy-safe aggregates only)

CREATE OR REPLACE VIEW public.public_state_network_counts AS

WITH states AS (
  SELECT * FROM (VALUES
    ('AL','Alabama'),('AK','Alaska'),('AZ','Arizona'),('AR','Arkansas'),('CA','California'),
    ('CO','Colorado'),('CT','Connecticut'),('DE','Delaware'),('FL','Florida'),('GA','Georgia'),
    ('HI','Hawaii'),('ID','Idaho'),('IL','Illinois'),('IN','Indiana'),('IA','Iowa'),
    ('KS','Kansas'),('KY','Kentucky'),('LA','Louisiana'),('ME','Maine'),('MD','Maryland'),
    ('MA','Massachusetts'),('MI','Michigan'),('MN','Minnesota'),('MS','Mississippi'),('MO','Missouri'),
    ('MT','Montana'),('NE','Nebraska'),('NV','Nevada'),('NH','New Hampshire'),('NJ','New Jersey'),
    ('NM','New Mexico'),('NY','New York'),('NC','North Carolina'),('ND','North Dakota'),('OH','Ohio'),
    ('OK','Oklahoma'),('OR','Oregon'),('PA','Pennsylvania'),('RI','Rhode Island'),('SC','South Carolina'),
    ('SD','South Dakota'),('TN','Tennessee'),('TX','Texas'),('UT','Utah'),('VT','Vermont'),
    ('VA','Virginia'),('WA','Washington'),('WV','West Virginia'),('WI','Wisconsin'),('WY','Wyoming'),
    ('DC','District of Columbia')
  ) AS t(state_code, state_name)
),

rep_counts AS (
  SELECT
    UPPER(BTRIM(rca.state_code)) AS state_code,
    COUNT(DISTINCT rca.user_id) AS rep_count
  FROM public.rep_coverage_areas rca
  JOIN public.profiles p ON p.id = rca.user_id
  WHERE p.account_status = 'active'
    AND p.is_fieldrep = true
    AND rca.state_code IS NOT NULL
    AND BTRIM(rca.state_code) <> ''
    AND LENGTH(UPPER(BTRIM(rca.state_code))) = 2
  GROUP BY 1
),

vendor_counts AS (
  SELECT
    UPPER(BTRIM(s.state_code)) AS state_code,
    COUNT(DISTINCT vp.user_id) AS vendor_count
  FROM public.vendor_profile vp
  JOIN public.profiles p ON p.id = vp.user_id
  JOIN LATERAL unnest(COALESCE(vp.regions_covered, '{}'::text[])) AS s(state_code) ON true
  WHERE p.account_status = 'active'
    AND p.is_vendor_admin = true
    AND s.state_code IS NOT NULL
    AND BTRIM(s.state_code) <> ''
    AND LENGTH(UPPER(BTRIM(s.state_code))) = 2
  GROUP BY 1
)

SELECT
  st.state_code,
  st.state_name,
  COALESCE(rc.rep_count, 0)::int AS rep_count,
  CASE
    WHEN COALESCE(rc.rep_count, 0) = 0 THEN '0'
    WHEN COALESCE(rc.rep_count, 0) < 3 THEN '<3'
    ELSE COALESCE(rc.rep_count, 0)::text
  END AS rep_count_display,
  COALESCE(vc.vendor_count, 0)::int AS vendor_count,
  CASE
    WHEN COALESCE(vc.vendor_count, 0) = 0 THEN '0'
    WHEN COALESCE(vc.vendor_count, 0) < 3 THEN '<3'
    ELSE COALESCE(vc.vendor_count, 0)::text
  END AS vendor_count_display,
  (COALESCE(rc.rep_count, 0) + COALESCE(vc.vendor_count, 0))::int AS total_count,
  CASE
    WHEN (COALESCE(rc.rep_count, 0) + COALESCE(vc.vendor_count, 0)) = 0 THEN '0'
    WHEN (COALESCE(rc.rep_count, 0) + COALESCE(vc.vendor_count, 0)) < 3 THEN '<3'
    ELSE (COALESCE(rc.rep_count, 0) + COALESCE(vc.vendor_count, 0))::text
  END AS total_count_display,
  now() AS last_updated_at
FROM states st
LEFT JOIN rep_counts rc ON rc.state_code = st.state_code
LEFT JOIN vendor_counts vc ON vc.state_code = st.state_code;

-- Grant access to authenticated and anonymous users
GRANT SELECT ON public.public_state_network_counts TO authenticated;
GRANT SELECT ON public.public_state_network_counts TO anon;