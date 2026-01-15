-- ============================================================================
-- ClearMarket: Rate Limiting - Schema Fix (SAFE)
-- Migrates older rate_limit_counters schema to the new schema without dropping.
-- ============================================================================

BEGIN;

-- Ensure table exists
CREATE TABLE IF NOT EXISTS public.rate_limit_counters (
  -- placeholder minimal; will be altered below as needed
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 1) Rename legacy columns if present
DO $$
BEGIN
  -- action_type -> action
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='rate_limit_counters' AND column_name='action_type'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='rate_limit_counters' AND column_name='action'
  ) THEN
    EXECUTE 'ALTER TABLE public.rate_limit_counters RENAME COLUMN action_type TO action';
  END IF;

  -- user_id -> actor_key (convert to text)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='rate_limit_counters' AND column_name='user_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='rate_limit_counters' AND column_name='actor_key'
  ) THEN
    EXECUTE 'ALTER TABLE public.rate_limit_counters ADD COLUMN actor_key text';
    EXECUTE 'UPDATE public.rate_limit_counters SET actor_key = user_id::text WHERE actor_key IS NULL';
    EXECUTE 'ALTER TABLE public.rate_limit_counters DROP COLUMN user_id';
  END IF;
END $$;

-- 2) Add missing required columns
ALTER TABLE public.rate_limit_counters
  ADD COLUMN IF NOT EXISTS window_start timestamptz,
  ADD COLUMN IF NOT EXISTS window_seconds integer,
  ADD COLUMN IF NOT EXISTS count integer NOT NULL DEFAULT 0;

-- 3) Backfill window_seconds if null (default to 60s)
UPDATE public.rate_limit_counters
SET window_seconds = 60
WHERE window_seconds IS NULL;

-- 4) Make required columns NOT NULL when safe
-- Only enforce NOT NULL after backfill
ALTER TABLE public.rate_limit_counters
  ALTER COLUMN actor_key SET NOT NULL,
  ALTER COLUMN action SET NOT NULL,
  ALTER COLUMN window_start SET NOT NULL,
  ALTER COLUMN window_seconds SET NOT NULL;

-- 5) Primary key: add if missing (requires uniqueness)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'rate_limit_counters_pkey'
      AND conrelid = 'public.rate_limit_counters'::regclass
  ) THEN
    -- If duplicates exist from legacy schema, dedupe by keeping the latest
    -- (safe best-effort; if you prefer, we can delete all rows instead)
    WITH ranked AS (
      SELECT ctid,
             row_number() OVER (
               PARTITION BY actor_key, action, window_start, window_seconds
               ORDER BY updated_at DESC
             ) AS rn
      FROM public.rate_limit_counters
    )
    DELETE FROM public.rate_limit_counters r
    USING ranked
    WHERE r.ctid = ranked.ctid AND ranked.rn > 1;

    EXECUTE 'ALTER TABLE public.rate_limit_counters
             ADD CONSTRAINT rate_limit_counters_pkey
             PRIMARY KEY (actor_key, action, window_start, window_seconds)';
  END IF;
END $$;

-- 6) Index (idempotent)
CREATE INDEX IF NOT EXISTS idx_rate_limit_counters_action_window
  ON public.rate_limit_counters (action, window_start DESC);

-- 7) RLS enable
ALTER TABLE public.rate_limit_counters ENABLE ROW LEVEL SECURITY;

-- 8) Deny policies (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='rate_limit_counters' AND policyname='deny_all_select'
  ) THEN
    CREATE POLICY deny_all_select
      ON public.rate_limit_counters
      FOR SELECT
      TO anon, authenticated
      USING (false);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='rate_limit_counters' AND policyname='deny_all_insert'
  ) THEN
    CREATE POLICY deny_all_insert
      ON public.rate_limit_counters
      FOR INSERT
      TO anon, authenticated
      WITH CHECK (false);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='rate_limit_counters' AND policyname='deny_all_update'
  ) THEN
    CREATE POLICY deny_all_update
      ON public.rate_limit_counters
      FOR UPDATE
      TO anon, authenticated
      USING (false);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='rate_limit_counters' AND policyname='deny_all_delete'
  ) THEN
    CREATE POLICY deny_all_delete
      ON public.rate_limit_counters
      FOR DELETE
      TO anon, authenticated
      USING (false);
  END IF;
END $$;

-- 9) Function (safe replace)
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_action text,
  p_max_requests integer,
  p_window_seconds integer,
  p_identifier text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_key text;
  v_now timestamptz := now();
  v_window_start timestamptz;
  v_new_count integer;
BEGIN
  v_actor_key := COALESCE(auth.uid()::text, NULLIF(p_identifier, ''), 'anon');

  v_window_start := to_timestamp(
    floor(extract(epoch from v_now) / p_window_seconds) * p_window_seconds
  );

  INSERT INTO public.rate_limit_counters (actor_key, action, window_start, window_seconds, count, updated_at)
  VALUES (v_actor_key, p_action, v_window_start, p_window_seconds, 1, v_now)
  ON CONFLICT (actor_key, action, window_start, window_seconds)
  DO UPDATE SET
    count = public.rate_limit_counters.count + 1,
    updated_at = v_now
  RETURNING count INTO v_new_count;

  RETURN (v_new_count <= p_max_requests);
END;
$$;

REVOKE ALL ON FUNCTION public.check_rate_limit(text, integer, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(text, integer, integer, text) TO anon, authenticated;

COMMIT;