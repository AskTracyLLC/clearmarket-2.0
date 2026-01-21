BEGIN;

-- ============================================================
-- 1. CREATE public.counties TABLE (canonical county reference)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.counties (
  geoid TEXT PRIMARY KEY,
  state_abbr TEXT NOT NULL,
  county_name TEXT NOT NULL,
  state_fips TEXT,
  county_fips TEXT,
  centroid_lat NUMERIC,
  centroid_lng NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add unique constraint on (state_abbr, county_name) if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE c.conname = 'counties_state_county_unique'
      AND n.nspname = 'public'
      AND t.relname = 'counties'
  ) THEN
    ALTER TABLE public.counties
      ADD CONSTRAINT counties_state_county_unique UNIQUE (state_abbr, county_name);
  END IF;
END $$;

-- Create trigger function for updated_at on counties
CREATE OR REPLACE FUNCTION public.set_counties_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger on counties table
DROP TRIGGER IF EXISTS set_counties_updated_at ON public.counties;
CREATE TRIGGER set_counties_updated_at
  BEFORE UPDATE ON public.counties
  FOR EACH ROW
  EXECUTE FUNCTION public.set_counties_updated_at();

-- Counties is reference data - keep RLS off for public read access
ALTER TABLE public.counties DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- 2. CREATE public.rep_coverage_counties TABLE (join table)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.rep_coverage_counties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rep_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  county_geoid TEXT NOT NULL REFERENCES public.counties(geoid) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add unique constraint on (rep_user_id, county_geoid) if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE c.conname = 'rep_coverage_counties_unique'
      AND n.nspname = 'public'
      AND t.relname = 'rep_coverage_counties'
  ) THEN
    ALTER TABLE public.rep_coverage_counties
      ADD CONSTRAINT rep_coverage_counties_unique UNIQUE (rep_user_id, county_geoid);
  END IF;
END $$;

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_rep_coverage_counties_rep_user_id 
  ON public.rep_coverage_counties(rep_user_id);
CREATE INDEX IF NOT EXISTS idx_rep_coverage_counties_county_geoid 
  ON public.rep_coverage_counties(county_geoid);

-- Enable RLS on rep_coverage_counties
ALTER TABLE public.rep_coverage_counties ENABLE ROW LEVEL SECURITY;

-- RLS Policies for rep_coverage_counties
-- SELECT: authenticated users can read (for vendor search + rep directory)
DROP POLICY IF EXISTS "Authenticated users can read rep coverage counties" ON public.rep_coverage_counties;
CREATE POLICY "Authenticated users can read rep coverage counties"
  ON public.rep_coverage_counties
  FOR SELECT
  TO authenticated
  USING (true);

-- INSERT: rep can add their own coverage
DROP POLICY IF EXISTS "Reps can insert their own coverage counties" ON public.rep_coverage_counties;
CREATE POLICY "Reps can insert their own coverage counties"
  ON public.rep_coverage_counties
  FOR INSERT
  TO authenticated
  WITH CHECK (rep_user_id = auth.uid());

-- UPDATE: rep can update their own coverage (though typically delete/insert)
DROP POLICY IF EXISTS "Reps can update their own coverage counties" ON public.rep_coverage_counties;
CREATE POLICY "Reps can update their own coverage counties"
  ON public.rep_coverage_counties
  FOR UPDATE
  TO authenticated
  USING (rep_user_id = auth.uid())
  WITH CHECK (rep_user_id = auth.uid());

-- DELETE: rep can remove their own coverage
DROP POLICY IF EXISTS "Reps can delete their own coverage counties" ON public.rep_coverage_counties;
CREATE POLICY "Reps can delete their own coverage counties"
  ON public.rep_coverage_counties
  FOR DELETE
  TO authenticated
  USING (rep_user_id = auth.uid());

-- Admin policies (using is_admin from profiles)
DROP POLICY IF EXISTS "Admins can manage all rep coverage counties" ON public.rep_coverage_counties;
CREATE POLICY "Admins can manage all rep coverage counties"
  ON public.rep_coverage_counties
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

-- ============================================================
-- 3. CREATE public.county_rep_counts VIEW (aggregate for maps)
-- ============================================================
DROP VIEW IF EXISTS public.county_rep_counts;
CREATE VIEW public.county_rep_counts AS
SELECT
  c.geoid AS county_geoid,
  c.state_abbr,
  c.county_name,
  COUNT(*) FILTER (WHERE p.id IS NOT NULL)::INTEGER AS rep_count
FROM public.counties c
LEFT JOIN public.rep_coverage_counties rcc ON rcc.county_geoid = c.geoid
LEFT JOIN public.profiles p ON p.id = rcc.rep_user_id AND p.is_fieldrep = true
GROUP BY c.geoid, c.state_abbr, c.county_name;

-- Grant access to the view for anon and authenticated users
GRANT SELECT ON public.county_rep_counts TO anon;
GRANT SELECT ON public.county_rep_counts TO authenticated;

-- Grant access to counties table for all users (reference data)
GRANT SELECT ON public.counties TO anon;
GRANT SELECT ON public.counties TO authenticated;

-- Grant full access to rep_coverage_counties for authenticated (RLS handles restrictions)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rep_coverage_counties TO authenticated;

COMMIT;