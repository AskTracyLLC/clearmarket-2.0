-- Create feature_flags table for managing beta/paid features
CREATE TABLE public.feature_flags (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    key TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    is_enabled BOOLEAN NOT NULL DEFAULT false,
    is_paid BOOLEAN NOT NULL DEFAULT false,
    beta_note TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

-- Allow anyone (authenticated) to read feature flags
CREATE POLICY "Anyone can read feature flags"
ON public.feature_flags
FOR SELECT
TO authenticated
USING (true);

-- Only admins can manage feature flags
CREATE POLICY "Admins can manage feature flags"
ON public.feature_flags
FOR ALL
TO authenticated
USING (is_admin_user(auth.uid()))
WITH CHECK (is_admin_user(auth.uid()));

-- Add trigger for updated_at
CREATE TRIGGER update_feature_flags_updated_at
    BEFORE UPDATE ON public.feature_flags
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Seed Match Assistant feature flag
INSERT INTO public.feature_flags (key, name, description, is_enabled, is_paid, beta_note)
VALUES (
    'match_assistant',
    'Match Assistant',
    'Shows near-miss work opportunities slightly below a rep''s base rate.',
    true,
    true,
    'Free during testing. This will become a paid feature after launch.'
);