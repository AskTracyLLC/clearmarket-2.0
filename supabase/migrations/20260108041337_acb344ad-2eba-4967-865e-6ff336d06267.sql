-- Create snapshot table for storing rep rate snapshots per proposal
CREATE TABLE IF NOT EXISTS public.vendor_proposal_rep_rate_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid NOT NULL REFERENCES public.vendor_client_proposals(id) ON DELETE CASCADE,
  rep_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  state_code text NOT NULL,
  county_id uuid NULL,
  region_key text NOT NULL,
  order_type text NOT NULL CHECK (order_type IN ('standard', 'appointment', 'rush')),
  rep_rate numeric(10,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Data integrity
ALTER TABLE public.vendor_proposal_rep_rate_snapshots
  DROP CONSTRAINT IF EXISTS snapshots_all_counties_county_null_chk;
ALTER TABLE public.vendor_proposal_rep_rate_snapshots
  ADD CONSTRAINT snapshots_all_counties_county_null_chk
  CHECK (
    (region_key = '__ALL__' AND county_id IS NULL)
    OR (region_key <> '__ALL__')
  );

-- Prevent duplicate snapshot rows for same rep + region + order type
CREATE UNIQUE INDEX IF NOT EXISTS vendor_proposal_rep_snapshots_uniq
ON public.vendor_proposal_rep_rate_snapshots (proposal_id, rep_user_id, state_code, region_key, order_type);

-- Indexes for lookups
CREATE INDEX IF NOT EXISTS idx_proposal_rep_snapshots_proposal
ON public.vendor_proposal_rep_rate_snapshots(proposal_id);
CREATE INDEX IF NOT EXISTS idx_proposal_rep_snapshots_lookup
ON public.vendor_proposal_rep_rate_snapshots(proposal_id, state_code, region_key, order_type);

-- Enable RLS
ALTER TABLE public.vendor_proposal_rep_rate_snapshots ENABLE ROW LEVEL SECURITY;

-- Vendors can CRUD rows where proposal belongs to them
DROP POLICY IF EXISTS "Vendors can manage their proposal snapshots"
ON public.vendor_proposal_rep_rate_snapshots;
CREATE POLICY "Vendors can manage their proposal snapshots"
ON public.vendor_proposal_rep_rate_snapshots
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.vendor_client_proposals p
    WHERE p.id = proposal_id AND p.vendor_user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.vendor_client_proposals p
    WHERE p.id = proposal_id AND p.vendor_user_id = auth.uid()
  )
);

-- Admins can read (use your existing helper)
DROP POLICY IF EXISTS "Admins can read proposal snapshots"
ON public.vendor_proposal_rep_rate_snapshots;
CREATE POLICY "Admins can read proposal snapshots"
ON public.vendor_proposal_rep_rate_snapshots
FOR SELECT
USING (public.is_admin_user(auth.uid()));

-- Add baseline columns to proposal lines
ALTER TABLE public.vendor_client_proposal_lines
  ADD COLUMN IF NOT EXISTS internal_rep_rate_baseline numeric(10,2),
  ADD COLUMN IF NOT EXISTS internal_rep_source_rep_id uuid;

-- Optional FK for cleanliness (recommended)
ALTER TABLE public.vendor_client_proposal_lines
  DROP CONSTRAINT IF EXISTS vendor_client_proposal_lines_internal_rep_source_fk;
ALTER TABLE public.vendor_client_proposal_lines
  ADD CONSTRAINT vendor_client_proposal_lines_internal_rep_source_fk
  FOREIGN KEY (internal_rep_source_rep_id) REFERENCES auth.users(id) ON DELETE SET NULL;