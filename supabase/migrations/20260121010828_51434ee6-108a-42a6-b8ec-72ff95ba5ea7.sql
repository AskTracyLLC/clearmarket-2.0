BEGIN;

-- Fix 1: Enable RLS on counties with permissive read policy
ALTER TABLE public.counties ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read counties" ON public.counties;
CREATE POLICY "Anyone can read counties"
  ON public.counties
  FOR SELECT
  TO public
  USING (true);

DROP POLICY IF EXISTS "Admins can manage counties" ON public.counties;
CREATE POLICY "Admins can manage counties"
  ON public.counties
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.is_admin = true
    )
  );

-- Fix 2: Recreate view with security_invoker = true
DROP VIEW IF EXISTS public.county_rep_counts;
CREATE VIEW public.county_rep_counts
WITH (security_invoker = true)
AS
SELECT
  c.geoid AS county_geoid,
  c.state_abbr,
  c.county_name,
  COUNT(*) FILTER (WHERE p.id IS NOT NULL)::INTEGER AS rep_count
FROM public.counties c
LEFT JOIN public.rep_coverage_counties rcc ON rcc.county_geoid = c.geoid
LEFT JOIN public.profiles p ON p.id = rcc.rep_user_id AND p.is_fieldrep = true
GROUP BY c.geoid, c.state_abbr, c.county_name;

-- Authenticated only (vendors/reps/admins)
REVOKE ALL ON public.county_rep_counts FROM anon;
GRANT SELECT ON public.county_rep_counts TO authenticated;

COMMIT;