-- Fix Coverage Map vendor counts: recreate view WITHOUT security_invoker (default = definer)
-- so aggregate counts work across private tables, while exposing only aggregates.

-- First drop the view to recreate it without security_invoker
DROP VIEW IF EXISTS public.public_state_network_counts;

-- Recreate without security_invoker = true (uses owner privileges for aggregates)
CREATE VIEW public.public_state_network_counts AS
WITH states AS (
  SELECT t.state_code, t.state_name
  FROM (
    VALUES
      ('AL','Alabama'),('AK','Alaska'),('AZ','Arizona'),('AR','Arkansas'),
      ('CA','California'),('CO','Colorado'),('CT','Connecticut'),('DE','Delaware'),
      ('FL','Florida'),('GA','Georgia'),('HI','Hawaii'),('ID','Idaho'),
      ('IL','Illinois'),('IN','Indiana'),('IA','Iowa'),('KS','Kansas'),
      ('KY','Kentucky'),('LA','Louisiana'),('ME','Maine'),('MD','Maryland'),
      ('MA','Massachusetts'),('MI','Michigan'),('MN','Minnesota'),('MS','Mississippi'),
      ('MO','Missouri'),('MT','Montana'),('NE','Nebraska'),('NV','Nevada'),
      ('NH','New Hampshire'),('NJ','New Jersey'),('NM','New Mexico'),('NY','New York'),
      ('NC','North Carolina'),('ND','North Dakota'),('OH','Ohio'),('OK','Oklahoma'),
      ('OR','Oregon'),('PA','Pennsylvania'),('RI','Rhode Island'),('SC','South Carolina'),
      ('SD','South Dakota'),('TN','Tennessee'),('TX','Texas'),('UT','Utah'),
      ('VT','Vermont'),('VA','Virginia'),('WA','Washington'),('WV','West Virginia'),
      ('WI','Wisconsin'),('WY','Wyoming'),('DC','District of Columbia')
  ) AS t(state_code, state_name)
),
rep_counts AS (
  SELECT
    upper(trim(both from rca.state_code)) AS state_code,
    count(DISTINCT rca.user_id) AS rep_count
  FROM public.rep_coverage_areas rca
  JOIN public.profiles p ON p.id = rca.user_id
  WHERE
    p.account_status = 'active'
    AND p.is_fieldrep = true
    AND rca.state_code IS NOT NULL
    AND trim(both from rca.state_code) <> ''
    AND length(upper(trim(both from rca.state_code))) = 2
  GROUP BY upper(trim(both from rca.state_code))
),
vendor_counts AS (
  SELECT
    upper(trim(both from combined.state_code)) AS state_code,
    count(DISTINCT combined.user_id) AS vendor_count
  FROM (
    -- Regions covered array
    SELECT
      vp.user_id,
      region_item.state_code
    FROM public.vendor_profile vp
    JOIN public.profiles p ON p.id = vp.user_id
    CROSS JOIN LATERAL unnest(coalesce(vp.regions_covered, '{}'::text[])) AS region_item(state_code)
    WHERE
      p.account_status = 'active'
      AND p.is_vendor_admin = true
      AND length(upper(trim(both from region_item.state_code))) = 2

    UNION

    -- HQ state (either abbreviation or full name mapped via states CTE)
    SELECT
      vp.user_id,
      CASE
        WHEN length(upper(trim(both from vp.state))) = 2 THEN upper(trim(both from vp.state))
        ELSE st.state_code
      END AS state_code
    FROM public.vendor_profile vp
    JOIN public.profiles p ON p.id = vp.user_id
    LEFT JOIN states st ON lower(trim(both from vp.state)) = lower(st.state_name)
    WHERE
      p.account_status = 'active'
      AND p.is_vendor_admin = true
      AND vp.state IS NOT NULL
      AND trim(both from vp.state) <> ''
      AND (length(upper(trim(both from vp.state))) = 2 OR st.state_code IS NOT NULL)
  ) AS combined
  WHERE combined.state_code IS NOT NULL AND length(combined.state_code) = 2
  GROUP BY upper(trim(both from combined.state_code))
)
SELECT
  states.state_code,
  states.state_name,
  coalesce(rc.rep_count, 0::bigint) AS rep_count,
  CASE
    WHEN coalesce(rc.rep_count, 0::bigint) = 0 THEN '0'
    WHEN coalesce(rc.rep_count, 0::bigint) >= 100 THEN '100+'
    ELSE coalesce(rc.rep_count, 0::bigint)::text
  END AS rep_count_display,
  coalesce(vc.vendor_count, 0::bigint) AS vendor_count,
  CASE
    WHEN coalesce(vc.vendor_count, 0::bigint) = 0 THEN '0'
    WHEN coalesce(vc.vendor_count, 0::bigint) >= 100 THEN '100+'
    ELSE coalesce(vc.vendor_count, 0::bigint)::text
  END AS vendor_count_display,
  (coalesce(rc.rep_count, 0::bigint) + coalesce(vc.vendor_count, 0::bigint)) AS total_count,
  CASE
    WHEN (coalesce(rc.rep_count, 0::bigint) + coalesce(vc.vendor_count, 0::bigint)) = 0 THEN '0'
    WHEN (coalesce(rc.rep_count, 0::bigint) + coalesce(vc.vendor_count, 0::bigint)) >= 100 THEN '100+'
    ELSE (coalesce(rc.rep_count, 0::bigint) + coalesce(vc.vendor_count, 0::bigint))::text
  END AS total_count_display,
  now() AS last_updated_at
FROM states
LEFT JOIN rep_counts rc ON states.state_code = rc.state_code
LEFT JOIN vendor_counts vc ON states.state_code = vc.state_code;

-- Keep access restricted: authenticated only
REVOKE ALL ON public.public_state_network_counts FROM anon;
GRANT SELECT ON public.public_state_network_counts TO authenticated;