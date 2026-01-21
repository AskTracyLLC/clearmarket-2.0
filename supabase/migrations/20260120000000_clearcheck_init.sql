-- Migration: 20260120000000_clearcheck_init.sql

-- 1. Settings Table
CREATE TABLE IF NOT EXISTS public.clearcheck_settings (
    key text PRIMARY KEY,
    value jsonb NOT NULL
);

INSERT INTO public.clearcheck_settings (key, value)
VALUES ('worst_case_trigger_time', '"13:00"')
ON CONFLICT (key) DO NOTHING;

-- 2. Master Delay Reasons
CREATE TABLE IF NOT EXISTS public.clearcheck_delay_reasons (
    code text PRIMARY KEY,
    label text NOT NULL,
    is_active boolean DEFAULT true,
    sort_order integer DEFAULT 0
);

-- Seed Delay Reasons
INSERT INTO public.clearcheck_delay_reasons (code, label, sort_order) VALUES
('WEATHER', 'Weather Delay', 10),
('ACCESS', 'No Access / Lockbox Issue', 20),
('CLIENT_REQ', 'Client Requested Hold', 30),
('REP_SICK', 'Rep Illness / Emergency', 40),
('OTHER', 'Other (See Notes)', 99)
ON CONFLICT (code) DO NOTHING;

-- 3. Import Batches
CREATE TYPE public.clearcheck_import_type AS ENUM (
    'EZ_NEEDS_UPDATE',
    'IA_NEEDS_UPDATE',
    'IA_FOLLOW_UP',
    'EZ_STATUS_REFRESH',
    'IA_SUBMITTED_REFRESH',
    'IA_CANCELED_REFRESH'
);

CREATE TABLE IF NOT EXISTS public.clearcheck_import_batches (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    import_type public.clearcheck_import_type NOT NULL,
    system text NOT NULL CHECK (system IN ('EZ', 'IA')),
    filename text NOT NULL,
    row_count integer DEFAULT 0,
    warnings jsonb DEFAULT '[]'::jsonb,
    errors jsonb DEFAULT '[]'::jsonb,
    created_at timestamptz DEFAULT now(),
    created_by uuid REFERENCES auth.users(id)
);

-- 4. Staging Rows
CREATE TABLE IF NOT EXISTS public.clearcheck_staging_rows (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    batch_id uuid REFERENCES public.clearcheck_import_batches(id) ON DELETE CASCADE,
    raw jsonb NOT NULL,
    parsed jsonb,
    is_valid boolean DEFAULT false,
    error_text text
);

-- 5. ClearCheck Orders
CREATE TABLE IF NOT EXISTS public.clearcheck_orders (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    order_instance_key text UNIQUE NOT NULL, -- hash of composite identity
    system text NOT NULL,
    job_id text NOT NULL,
    job_name text,
    service text,
    ect date,
    street text,
    city text,
    state text,
    county text,
    zip text,
    rep_display_name text,
    rep_master_id uuid, -- link to profiles.id later
    status text,
    client_primary text,
    subclient text,
    due_client date,
    due_rep date,
    start_date date,
    created_date date,
    completed_date date,
    submitted_date date,
    form text,
    
    -- Derived / Computed
    is_open boolean GENERATED ALWAYS AS (
        status NOT IN ('Submitted', 'Canceled', 'Cancelled')
    ) STORED,
    
    -- is_past_due can be complex to verify if strictly computed in SQL due to "today", 
    -- but let's try a simple generation or manage it via triggers/views. 
    -- For MVP, we'll store it or calculate in view. Let's make it a regular column updated by application/trigger.
    is_past_due boolean DEFAULT false,
    days_late integer DEFAULT 0,

    -- Editable / Operational
    current_ecd date,
    current_delay_reason_code text REFERENCES public.clearcheck_delay_reasons(code),
    current_delay_reason_label text, -- Denormalized for export convenience

    updated_at timestamptz DEFAULT now(),
    updated_by uuid REFERENCES auth.users(id)
);

-- 6. Order Snapshots (History)
CREATE TABLE IF NOT EXISTS public.clearcheck_order_snapshots (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id uuid REFERENCES public.clearcheck_orders(id) ON DELETE CASCADE,
    batch_id uuid REFERENCES public.clearcheck_import_batches(id),
    snapshot_date date NOT NULL, -- usually batch created_at date
    status text,
    rep_display_name text,
    client_primary text,
    due_client date,
    due_rep date,
    current_ecd_at_time date,
    current_delay_reason_code_at_time text,
    notes jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now()
);

-- 7. Contact Attempts
CREATE TYPE public.clearcheck_contact_method AS ENUM (
    'TEXT',
    'CALL',
    'EMAIL',
    'FOLLOWUP'
);

CREATE TABLE IF NOT EXISTS public.clearcheck_contact_attempts (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id uuid REFERENCES public.clearcheck_orders(id) ON DELETE CASCADE,
    attempted_at timestamptz DEFAULT now(),
    method public.clearcheck_contact_method NOT NULL,
    attempted_by uuid REFERENCES auth.users(id),
    bulk_batch_id uuid
);

-- 8. Responses
CREATE TYPE public.clearcheck_response_via AS ENUM (
    'TEXT',
    'CALL',
    'EMAIL'
);

CREATE TABLE IF NOT EXISTS public.clearcheck_responses (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id uuid REFERENCES public.clearcheck_orders(id) ON DELETE CASCADE,
    response_logged_at timestamptz DEFAULT now(),
    received_via public.clearcheck_response_via NOT NULL,
    logged_by uuid REFERENCES auth.users(id),
    ecd date,
    delay_reason_code text
);

-- RLS POLICIES ----------------------------------------------------------------

ALTER TABLE public.clearcheck_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clearcheck_delay_reasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clearcheck_import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clearcheck_staging_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clearcheck_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clearcheck_order_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clearcheck_contact_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clearcheck_responses ENABLE ROW LEVEL SECURITY;

-- Helper function to check if user is internal ops or admin
CREATE OR REPLACE FUNCTION public.is_internal_ops()
RETURNS boolean AS $$
BEGIN
  -- Check if user has is_admin = true in profiles
  -- OR (future) is_internal_ops = true
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND (is_admin = true OR is_support = true) -- using is_support as proxy for ops for MVP
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Policies
-- Settings: Read-only for authenticated, write for admins
CREATE POLICY "Allow read settings" ON public.clearcheck_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow write settings" ON public.clearcheck_settings FOR ALL TO authenticated USING (public.is_internal_ops());

-- Delay Reasons: Read-only for authenticated, write for admins
CREATE POLICY "Allow read delay reasons" ON public.clearcheck_delay_reasons FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow write delay reasons" ON public.clearcheck_delay_reasons FOR ALL TO authenticated USING (public.is_internal_ops());

-- Import Batches: Internal Only
CREATE POLICY "Internal Only Batches" ON public.clearcheck_import_batches FOR ALL TO authenticated USING (public.is_internal_ops());

-- Staging Rows: Internal Only
CREATE POLICY "Internal Only Staging" ON public.clearcheck_staging_rows FOR ALL TO authenticated USING (public.is_internal_ops());

-- Orders: Internal Only
CREATE POLICY "Internal Only Orders" ON public.clearcheck_orders FOR ALL TO authenticated USING (public.is_internal_ops());

-- Snapshots: Internal Only
CREATE POLICY "Internal Only Snapshots" ON public.clearcheck_order_snapshots FOR ALL TO authenticated USING (public.is_internal_ops());

-- Contact Attempts: Internal Only
CREATE POLICY "Internal Only Contacts" ON public.clearcheck_contact_attempts FOR ALL TO authenticated USING (public.is_internal_ops());

-- Responses: Internal Only
CREATE POLICY "Internal Only Responses" ON public.clearcheck_responses FOR ALL TO authenticated USING (public.is_internal_ops());

-- Updated At Trigger
CREATE TRIGGER update_clearcheck_orders_modtime
    BEFORE UPDATE ON public.clearcheck_orders
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
