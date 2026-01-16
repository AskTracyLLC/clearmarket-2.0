BEGIN;

-- =============================================================================
-- PLATFORM SYSTEMS USED - Admin-managed systems selection module
-- =============================================================================

-- 1) Create table (idempotent)
CREATE TABLE IF NOT EXISTS public.platform_systems_used (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  code text NOT NULL UNIQUE,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2) Defensive column adds (true idempotency even if table existed partially)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'platform_systems_used' AND column_name = 'label'
  ) THEN
    ALTER TABLE public.platform_systems_used ADD COLUMN label text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'platform_systems_used' AND column_name = 'code'
  ) THEN
    ALTER TABLE public.platform_systems_used ADD COLUMN code text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'platform_systems_used' AND column_name = 'description'
  ) THEN
    ALTER TABLE public.platform_systems_used ADD COLUMN description text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'platform_systems_used' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE public.platform_systems_used ADD COLUMN is_active boolean NOT NULL DEFAULT true;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'platform_systems_used' AND column_name = 'sort_order'
  ) THEN
    ALTER TABLE public.platform_systems_used ADD COLUMN sort_order integer NOT NULL DEFAULT 100;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'platform_systems_used' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE public.platform_systems_used ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'platform_systems_used' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE public.platform_systems_used ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
  END IF;
END $$;

-- 3) Indexes
CREATE INDEX IF NOT EXISTS idx_platform_systems_used_is_active
  ON public.platform_systems_used(is_active);

CREATE INDEX IF NOT EXISTS idx_platform_systems_used_sort_order
  ON public.platform_systems_used(sort_order);

-- 4) RLS
ALTER TABLE public.platform_systems_used ENABLE ROW LEVEL SECURITY;

-- Drop policies if they exist (idempotent)
DROP POLICY IF EXISTS "Authenticated users can read all systems" ON public.platform_systems_used;
DROP POLICY IF EXISTS "Staff can insert systems" ON public.platform_systems_used;
DROP POLICY IF EXISTS "Staff can update systems" ON public.platform_systems_used;
DROP POLICY IF EXISTS "Staff can delete systems" ON public.platform_systems_used;

-- Authenticated users can read all (so Work Setup can show inactive with badge)
CREATE POLICY "Authenticated users can read all systems"
  ON public.platform_systems_used
  FOR SELECT
  TO authenticated
  USING (true);

-- Staff/Admin can write (matches your existing profiles flags approach)
CREATE POLICY "Staff can insert systems"
  ON public.platform_systems_used
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND (profiles.is_admin = true OR profiles.is_moderator = true OR profiles.is_super_admin = true)
    )
  );

CREATE POLICY "Staff can update systems"
  ON public.platform_systems_used
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND (profiles.is_admin = true OR profiles.is_moderator = true OR profiles.is_super_admin = true)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND (profiles.is_admin = true OR profiles.is_moderator = true OR profiles.is_super_admin = true)
    )
  );

CREATE POLICY "Staff can delete systems"
  ON public.platform_systems_used
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND (profiles.is_admin = true OR profiles.is_moderator = true OR profiles.is_super_admin = true)
    )
  );

-- 5) updated_at trigger function (scope to public to avoid collisions)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.proname = 'update_updated_at_column'
      AND n.nspname = 'public'
  ) THEN
    CREATE OR REPLACE FUNCTION public.update_updated_at_column()
    RETURNS TRIGGER AS $func$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $func$ LANGUAGE plpgsql;
  END IF;
END $$;

DROP TRIGGER IF EXISTS update_platform_systems_used_updated_at ON public.platform_systems_used;

CREATE TRIGGER update_platform_systems_used_updated_at
  BEFORE UPDATE ON public.platform_systems_used
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 6) Seed data (idempotent upsert)
INSERT INTO public.platform_systems_used (code, label, description, is_active, sort_order)
VALUES
  ('EZINSPECTIONS', 'EZInspections', 'Property inspection management platform', true, 10),
  ('INSPECTORADE', 'InspectorADE', 'Inspection assignment and tracking system', true, 20),
  ('PPW', 'PPW / Property Pres Wizard', 'Property preservation workflow management', true, 30),
  ('FORM_COM', 'Form.com / Compass360', 'Mobile inspection form platform', true, 40),
  ('WORLDAPP', 'WorldApp', 'Enterprise inspection application', true, 50)
ON CONFLICT (code) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  is_active = EXCLUDED.is_active,
  sort_order = EXCLUDED.sort_order;

COMMIT;