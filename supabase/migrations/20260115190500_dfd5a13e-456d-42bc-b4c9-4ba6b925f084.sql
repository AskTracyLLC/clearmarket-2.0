-- ============================================================================
-- ClearMarket: Score Summary Tables (SAFE / Idempotent)
-- Creates lightweight summary tables for fast list sorting + display.
-- NOTE: This does NOT compute scores yet. It establishes the storage layer.
-- Add/adjust a refresh job later once score sources are finalized.
-- ============================================================================

-- 1) Rep score summary
CREATE TABLE IF NOT EXISTS public.rep_score_summary (
  rep_user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  trust_score integer NOT NULL DEFAULT 0,
  community_score integer NOT NULL DEFAULT 0,
  refreshed_at timestamptz NOT NULL DEFAULT now()
);

-- Helpful index for sorting/filtering (trust/community)
CREATE INDEX IF NOT EXISTS idx_rep_score_summary_trust_score
  ON public.rep_score_summary (trust_score DESC);

CREATE INDEX IF NOT EXISTS idx_rep_score_summary_community_score
  ON public.rep_score_summary (community_score DESC);

-- 2) Vendor score summary (optional but requested)
CREATE TABLE IF NOT EXISTS public.vendor_score_summary (
  vendor_user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  trust_score integer NOT NULL DEFAULT 0,
  refreshed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vendor_score_summary_trust_score
  ON public.vendor_score_summary (trust_score DESC);

-- 3) RLS (readable by app roles; admin can read too)
ALTER TABLE public.rep_score_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_score_summary ENABLE ROW LEVEL SECURITY;

-- Public read for scores
CREATE POLICY "rep_score_summary_select_all"
  ON public.rep_score_summary
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "vendor_score_summary_select_all"
  ON public.vendor_score_summary
  FOR SELECT
  TO anon, authenticated
  USING (true);