-- Create reputation share links table
CREATE TABLE IF NOT EXISTS public.reputation_share_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role_type text NOT NULL CHECK (role_type IN ('rep', 'vendor')),
  slug text NOT NULL UNIQUE,
  is_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_viewed_at timestamptz,
  view_count bigint NOT NULL DEFAULT 0
);

COMMENT ON TABLE public.reputation_share_links IS
  'Per-user shareable reputation snapshot links (tokenized URLs).';

COMMENT ON COLUMN public.reputation_share_links.slug IS
  'Short public token used in the share URL.';

-- Enable RLS
ALTER TABLE public.reputation_share_links ENABLE ROW LEVEL SECURITY;

-- Owner policies
CREATE POLICY "Users can manage their own share links"
ON public.reputation_share_links
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Add updated_at trigger
CREATE TRIGGER update_reputation_share_links_updated_at
  BEFORE UPDATE ON public.reputation_share_links
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for slug lookups
CREATE INDEX idx_reputation_share_links_slug ON public.reputation_share_links(slug) WHERE is_enabled = true;