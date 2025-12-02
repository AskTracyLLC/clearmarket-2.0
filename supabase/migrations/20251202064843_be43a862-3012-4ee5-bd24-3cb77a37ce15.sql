-- Create saved_searches table
CREATE TABLE IF NOT EXISTS public.saved_searches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role_context text NOT NULL, -- 'vendor_find_reps' or 'rep_find_vendors' or 'rep_find_work'
  name text NOT NULL,
  search_filters jsonb NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  last_run_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.saved_searches IS
  'Saved search filters for vendors and reps with alert capability.';

CREATE INDEX idx_saved_searches_user_id ON public.saved_searches(user_id);
CREATE INDEX idx_saved_searches_role_context ON public.saved_searches(role_context);
CREATE INDEX idx_saved_searches_is_active ON public.saved_searches(is_active);

-- Create saved_search_matches table for deduplication
CREATE TABLE IF NOT EXISTS public.saved_search_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  saved_search_id uuid NOT NULL REFERENCES public.saved_searches(id) ON DELETE CASCADE,
  target_user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(saved_search_id, target_user_id)
);

COMMENT ON TABLE public.saved_search_matches IS
  'Tracks which users/posts have already been notified for each saved search to prevent duplicates.';

CREATE INDEX idx_saved_search_matches_saved_search_id ON public.saved_search_matches(saved_search_id);
CREATE INDEX idx_saved_search_matches_target_user_id ON public.saved_search_matches(target_user_id);

-- RLS for saved_searches
ALTER TABLE public.saved_searches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User can manage own saved searches"
ON public.saved_searches
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- RLS for saved_search_matches
ALTER TABLE public.saved_search_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User can see own matches"
ON public.saved_search_matches
FOR SELECT
TO authenticated
USING (
  saved_search_id IN (
    SELECT id FROM public.saved_searches WHERE user_id = auth.uid()
  )
);

-- Trigger for updated_at
CREATE TRIGGER update_saved_searches_updated_at
BEFORE UPDATE ON public.saved_searches
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();