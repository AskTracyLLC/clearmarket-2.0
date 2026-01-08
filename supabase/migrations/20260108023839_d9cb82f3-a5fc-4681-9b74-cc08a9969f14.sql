-- =============================================================================
-- VENDOR CLIENT PROPOSALS FEATURE
-- Vendor-only proposal builder (NOT visible to Field Reps)
-- =============================================================================

-- Table: vendor_client_proposals (header)
CREATE TABLE public.vendor_client_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  client_name text,
  disclaimer text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
  effective_as_of date,
  client_rep_name text,
  client_rep_email text,
  is_template boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Table: vendor_client_proposal_lines (line items)
CREATE TABLE public.vendor_client_proposal_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid NOT NULL REFERENCES public.vendor_client_proposals(id) ON DELETE CASCADE,
  state_code text NOT NULL,
  state_name text NOT NULL,
  county_id uuid,
  county_name text,
  is_all_counties boolean NOT NULL DEFAULT false,
  order_type text NOT NULL CHECK (order_type IN ('standard', 'appointment', 'rush')),
  proposed_rate numeric(10,2) NOT NULL DEFAULT 0,
  internal_rep_rate numeric(10,2),
  internal_note text,
  approved_rate numeric(10,2),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Partial unique index: only one all-counties row per state/order_type
CREATE UNIQUE INDEX vendor_proposal_lines_all_counties_uniq
ON public.vendor_client_proposal_lines (proposal_id, state_code, order_type)
WHERE is_all_counties = true;

-- Partial unique index: unique county overrides per state/county/order_type
CREATE UNIQUE INDEX vendor_proposal_lines_county_uniq
ON public.vendor_client_proposal_lines (proposal_id, state_code, county_name, order_type)
WHERE is_all_counties = false AND county_name IS NOT NULL;

-- Enable RLS
ALTER TABLE public.vendor_client_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_client_proposal_lines ENABLE ROW LEVEL SECURITY;

-- RLS Policies for vendor_client_proposals
CREATE POLICY "Vendors can view own proposals"
ON public.vendor_client_proposals
FOR SELECT
USING (auth.uid() = vendor_user_id);

CREATE POLICY "Vendors can insert own proposals"
ON public.vendor_client_proposals
FOR INSERT
WITH CHECK (auth.uid() = vendor_user_id);

CREATE POLICY "Vendors can update own proposals"
ON public.vendor_client_proposals
FOR UPDATE
USING (auth.uid() = vendor_user_id)
WITH CHECK (auth.uid() = vendor_user_id);

CREATE POLICY "Vendors can delete own proposals"
ON public.vendor_client_proposals
FOR DELETE
USING (auth.uid() = vendor_user_id);

-- Admin access to proposals (read-only)
CREATE POLICY "Admins can view all proposals"
ON public.vendor_client_proposals
FOR SELECT
USING (public.is_admin_user(auth.uid()));

-- RLS Policies for vendor_client_proposal_lines
CREATE POLICY "Vendors can view own proposal lines"
ON public.vendor_client_proposal_lines
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.vendor_client_proposals p
    WHERE p.id = proposal_id AND p.vendor_user_id = auth.uid()
  )
);

CREATE POLICY "Vendors can insert own proposal lines"
ON public.vendor_client_proposal_lines
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.vendor_client_proposals p
    WHERE p.id = proposal_id AND p.vendor_user_id = auth.uid()
  )
);

CREATE POLICY "Vendors can update own proposal lines"
ON public.vendor_client_proposal_lines
FOR UPDATE
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

CREATE POLICY "Vendors can delete own proposal lines"
ON public.vendor_client_proposal_lines
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.vendor_client_proposals p
    WHERE p.id = proposal_id AND p.vendor_user_id = auth.uid()
  )
);

-- Admin access to proposal lines (read-only)
CREATE POLICY "Admins can view all proposal lines"
ON public.vendor_client_proposal_lines
FOR SELECT
USING (public.is_admin_user(auth.uid()));

-- Triggers for updated_at (assumes function exists)
CREATE TRIGGER update_vendor_client_proposals_updated_at
BEFORE UPDATE ON public.vendor_client_proposals
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_vendor_client_proposal_lines_updated_at
BEFORE UPDATE ON public.vendor_client_proposal_lines
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();