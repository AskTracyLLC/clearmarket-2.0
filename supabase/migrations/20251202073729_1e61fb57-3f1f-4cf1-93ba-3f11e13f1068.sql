-- Create rep_match_settings table
CREATE TABLE IF NOT EXISTS public.rep_match_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  states_interested text[] NOT NULL DEFAULT '{}',
  inspection_types text[] DEFAULT NULL,
  minimum_pay numeric DEFAULT NULL,
  notify_email boolean NOT NULL DEFAULT true,
  notify_in_app boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

COMMENT ON TABLE public.rep_match_settings IS
  'Field rep preferences for automatic matching alerts when new Seeking Coverage posts are created.';

COMMENT ON COLUMN public.rep_match_settings.states_interested IS
  'Array of state codes the rep wants to receive alerts for. Defaults to their coverage areas.';

COMMENT ON COLUMN public.rep_match_settings.inspection_types IS
  'Optional: filter alerts by specific inspection types.';

COMMENT ON COLUMN public.rep_match_settings.minimum_pay IS
  'Optional: only alert for posts offering at least this rate.';

-- Enable RLS
ALTER TABLE public.rep_match_settings ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Reps can manage their own match settings"
ON public.rep_match_settings
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_rep_match_settings_updated_at
  BEFORE UPDATE ON public.rep_match_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();