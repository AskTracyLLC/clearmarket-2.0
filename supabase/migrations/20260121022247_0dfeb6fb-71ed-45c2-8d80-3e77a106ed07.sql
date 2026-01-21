-- Drop and recreate public_state_network_counts view with proper state mapping
DROP VIEW IF EXISTS public.public_state_network_counts;

CREATE OR REPLACE VIEW public.public_state_network_counts
WITH (security_invoker = true)
AS
WITH states AS (
  SELECT * FROM (VALUES
    ('AL','Alabama'), ('AK','Alaska'), ('AZ','Arizona'), ('AR','Arkansas'),
    ('CA','California'), ('CO','Colorado'), ('CT','Connecticut'), ('DE','Delaware'),
    ('FL','Florida'), ('GA','Georgia'), ('HI','Hawaii'), ('ID','Idaho'),
    ('IL','Illinois'), ('IN','Indiana'), ('IA','Iowa'), ('KS','Kansas'),
    ('KY','Kentucky'), ('LA','Louisiana'), ('ME','Maine'), ('MD','Maryland'),
    ('MA','Massachusetts'), ('MI','Michigan'), ('MN','Minnesota'), ('MS','Mississippi'),
    ('MO','Missouri'), ('MT','Montana'), ('NE','Nebraska'), ('NV','Nevada'),
    ('NH','New Hampshire'), ('NJ','New Jersey'), ('NM','New Mexico'), ('NY','New York'),
    ('NC','North Carolina'), ('ND','North Dakota'), ('OH','Ohio'), ('OK','Oklahoma'),
    ('OR','Oregon'), ('PA','Pennsylvania'), ('RI','Rhode Island'), ('SC','South Carolina'),
    ('SD','South Dakota'), ('TN','Tennessee'), ('TX','Texas'), ('UT','Utah'),
    ('VT','Vermont'), ('VA','Virginia'), ('WA','Washington'), ('WV','West Virginia'),
    ('WI','Wisconsin'), ('WY','Wyoming'), ('DC','District of Columbia')
  ) AS t(state_code, state_name)
),
rep_counts AS (
  SELECT 
    UPPER(TRIM(rca.state_code)) AS state_code,
    COUNT(DISTINCT rca.user_id) AS rep_count
  FROM public.rep_coverage_areas rca
  JOIN public.profiles p ON p.id = rca.user_id
  WHERE p.account_status = 'active'
    AND p.is_fieldrep = true
    AND rca.state_code IS NOT NULL
    AND TRIM(rca.state_code) <> ''
    AND LENGTH(UPPER(TRIM(rca.state_code))) = 2
  GROUP BY UPPER(TRIM(rca.state_code))
),
vendor_counts AS (
  SELECT 
    UPPER(TRIM(state_code)) AS state_code,
    COUNT(DISTINCT user_id) AS vendor_count
  FROM (
    -- From regions_covered array
    SELECT vp.user_id, s.state_code
    FROM public.vendor_profile vp
    JOIN public.profiles p ON p.id = vp.user_id
    CROSS JOIN LATERAL UNNEST(COALESCE(vp.regions_covered, '{}'::text[])) AS s(state_code)
    WHERE p.account_status = 'active'
      AND p.is_vendor_admin = true
      AND LENGTH(UPPER(TRIM(s.state_code))) = 2
    
    UNION
    
    -- From state column (vendor HQ location) - supports 'IL' OR 'Illinois'
    SELECT vp.user_id,
           CASE
             WHEN LENGTH(UPPER(TRIM(vp.state))) = 2 THEN UPPER(TRIM(vp.state))
             ELSE st.state_code
           END AS state_code
    FROM public.vendor_profile vp
    JOIN public.profiles p ON p.id = vp.user_id
    LEFT JOIN states st ON LOWER(TRIM(vp.state)) = LOWER(st.state_name)
    WHERE p.account_status = 'active'
      AND p.is_vendor_admin = true
      AND vp.state IS NOT NULL
      AND TRIM(vp.state) <> ''
      AND (
        LENGTH(UPPER(TRIM(vp.state))) = 2
        OR st.state_code IS NOT NULL
      )
  ) combined
  WHERE state_code IS NOT NULL
    AND LENGTH(state_code) = 2
  GROUP BY UPPER(TRIM(state_code))
)
SELECT 
  s.state_code,
  s.state_name,
  COALESCE(rc.rep_count, 0) AS rep_count,
  CASE 
    WHEN COALESCE(rc.rep_count, 0) = 0 THEN '0'
    WHEN COALESCE(rc.rep_count, 0) >= 100 THEN '100+'
    ELSE COALESCE(rc.rep_count, 0)::text
  END AS rep_count_display,
  COALESCE(vc.vendor_count, 0) AS vendor_count,
  CASE 
    WHEN COALESCE(vc.vendor_count, 0) = 0 THEN '0'
    WHEN COALESCE(vc.vendor_count, 0) >= 100 THEN '100+'
    ELSE COALESCE(vc.vendor_count, 0)::text
  END AS vendor_count_display,
  COALESCE(rc.rep_count, 0) + COALESCE(vc.vendor_count, 0) AS total_count,
  CASE 
    WHEN COALESCE(rc.rep_count, 0) + COALESCE(vc.vendor_count, 0) = 0 THEN '0'
    WHEN COALESCE(rc.rep_count, 0) + COALESCE(vc.vendor_count, 0) >= 100 THEN '100+'
    ELSE (COALESCE(rc.rep_count, 0) + COALESCE(vc.vendor_count, 0))::text
  END AS total_count_display,
  now() AS last_updated_at
FROM states s
LEFT JOIN rep_counts rc ON rc.state_code = s.state_code
LEFT JOIN vendor_counts vc ON vc.state_code = s.state_code;

-- Revoke access from anon, grant to authenticated only
REVOKE ALL ON public.public_state_network_counts FROM anon;
GRANT SELECT ON public.public_state_network_counts TO authenticated;