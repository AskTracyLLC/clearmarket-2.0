
-- ============================================================
-- VENDOR VERIFICATION + STAFF MANAGEMENT MIGRATION
-- With all recommended safety fixes
-- ============================================================

-- 1) Safe enum creation (prevents duplicate_object errors)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'vendor_verification_status') THEN
    CREATE TYPE public.vendor_verification_status AS ENUM ('draft','pending','needs_review','verified','rejected','suspended');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'vendor_staff_role') THEN
    CREATE TYPE public.vendor_staff_role AS ENUM ('owner','admin','staff');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'vendor_staff_status') THEN
    CREATE TYPE public.vendor_staff_status AS ENUM ('invited','active','disabled');
  END IF;
END$$;

-- ============================================================
-- 2) Extend vendor_profile with verification + POC fields
-- ============================================================
ALTER TABLE public.vendor_profile
  ADD COLUMN IF NOT EXISTS vendor_verification_status public.vendor_verification_status DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS vendor_public_code text,
  ADD COLUMN IF NOT EXISTS vendor_public_code_requested text,
  ADD COLUMN IF NOT EXISTS business_bio text,
  ADD COLUMN IF NOT EXISTS business_established_year integer,
  ADD COLUMN IF NOT EXISTS website_url text,
  ADD COLUMN IF NOT EXISTS linkedin_url text,
  ADD COLUMN IF NOT EXISTS bbb_url text,
  ADD COLUMN IF NOT EXISTS ein_provided boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS gl_insurance_note text,
  ADD COLUMN IF NOT EXISTS verification_submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS verified_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS verification_notes text,
  ADD COLUMN IF NOT EXISTS poc_name text,
  ADD COLUMN IF NOT EXISTS poc_title text,
  ADD COLUMN IF NOT EXISTS poc_email text,
  ADD COLUMN IF NOT EXISTS poc_phone text;

-- Unique index for vendor_public_code (safe if column already existed)
CREATE UNIQUE INDEX IF NOT EXISTS vendor_profile_vendor_public_code_unique
ON public.vendor_profile (vendor_public_code)
WHERE vendor_public_code IS NOT NULL;

-- Check constraints for code formats (1-6 chars, A-Z/0-9 only)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'vendor_public_code_format'
  ) THEN
    ALTER TABLE public.vendor_profile
    ADD CONSTRAINT vendor_public_code_format
    CHECK (vendor_public_code ~ '^[A-Z0-9]{1,6}$');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'vendor_public_code_requested_format'
  ) THEN
    ALTER TABLE public.vendor_profile
    ADD CONSTRAINT vendor_public_code_requested_format
    CHECK (vendor_public_code_requested ~ '^[A-Z0-9]{1,6}$');
  END IF;
END$$;

-- ============================================================
-- 3) Normalization triggers for vendor codes (uppercase)
-- ============================================================
CREATE OR REPLACE FUNCTION public.normalize_vendor_codes()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.vendor_public_code IS NOT NULL THEN
    NEW.vendor_public_code := upper(btrim(NEW.vendor_public_code));
  END IF;

  IF NEW.vendor_public_code_requested IS NOT NULL THEN
    NEW.vendor_public_code_requested := upper(btrim(NEW.vendor_public_code_requested));
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_normalize_vendor_codes ON public.vendor_profile;
CREATE TRIGGER trg_normalize_vendor_codes
BEFORE INSERT OR UPDATE ON public.vendor_profile
FOR EACH ROW
EXECUTE FUNCTION public.normalize_vendor_codes();

-- ============================================================
-- 4) vendor_code_reservations table (with format constraint)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.vendor_code_reservations (
  code text PRIMARY KEY,
  status text NOT NULL DEFAULT 'reserved' CHECK (status IN ('blocked','reserved')),
  reason text,
  reserved_for_vendor_id uuid REFERENCES public.vendor_profile(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- Add format constraint for reservation codes (1-6 chars, A-Z/0-9)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'vendor_code_reservations_code_format'
  ) THEN
    ALTER TABLE public.vendor_code_reservations
    ADD CONSTRAINT vendor_code_reservations_code_format
    CHECK (code ~ '^[A-Z0-9]{1,6}$');
  END IF;
END$$;

-- Enable RLS
ALTER TABLE public.vendor_code_reservations ENABLE ROW LEVEL SECURITY;

-- RLS: Only admins can manage reservations (WITH CHECK included)
DROP POLICY IF EXISTS "Admins can manage vendor code reservations" ON public.vendor_code_reservations;
CREATE POLICY "Admins can manage vendor code reservations"
  ON public.vendor_code_reservations
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.is_admin = true
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.is_admin = true
  ));

-- RLS: Only admins can SELECT (no public exposure of reserved codes)
DROP POLICY IF EXISTS "Admins can view vendor code reservations" ON public.vendor_code_reservations;
CREATE POLICY "Admins can view vendor code reservations"
  ON public.vendor_code_reservations
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.is_admin = true
  ));

-- Normalization trigger for reservation codes
CREATE OR REPLACE FUNCTION public.normalize_reservation_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.code := upper(btrim(NEW.code));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_normalize_reservation_code ON public.vendor_code_reservations;
CREATE TRIGGER trg_normalize_reservation_code
BEFORE INSERT OR UPDATE ON public.vendor_code_reservations
FOR EACH ROW
EXECUTE FUNCTION public.normalize_reservation_code();

-- Seed reserved placeholder codes
INSERT INTO public.vendor_code_reservations (code, status, reason)
VALUES
  ('MCS', 'reserved', 'Reserved for national vendor'),
  ('NFR', 'reserved', 'Reserved for national vendor'),
  ('SVCLNK', 'reserved', 'Reserved for national vendor'),
  ('ALTPPW', 'reserved', 'Reserved for national vendor')
ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- 5) vendor_staff table (FKs to auth.users for identity fields)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.vendor_staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES public.vendor_profile(id) ON DELETE CASCADE,
  staff_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  invited_name text NOT NULL,
  invited_email text NOT NULL,
  role public.vendor_staff_role NOT NULL DEFAULT 'staff',
  status public.vendor_staff_status NOT NULL DEFAULT 'invited',
  staff_code text,
  invited_by uuid REFERENCES auth.users(id),
  invited_at timestamptz DEFAULT now(),
  accepted_at timestamptz,
  disabled_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (vendor_id, invited_email)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_vendor_staff_vendor_id ON public.vendor_staff(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_staff_staff_user_id ON public.vendor_staff(staff_user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_vendor_staff_code_unique ON public.vendor_staff(staff_code) WHERE staff_code IS NOT NULL;

-- Enable RLS
ALTER TABLE public.vendor_staff ENABLE ROW LEVEL SECURITY;

-- RLS: Vendor owners/admins can manage staff (includes global admins) WITH CHECK
DROP POLICY IF EXISTS "Vendor owners and admins can manage staff" ON public.vendor_staff;
CREATE POLICY "Vendor owners and admins can manage staff"
  ON public.vendor_staff
  FOR ALL
  USING (
    -- Global admin bypass
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_admin = true
    )
    OR
    -- Vendor owner/admin
    EXISTS (
      SELECT 1 FROM public.vendor_staff vs
      WHERE vs.vendor_id = vendor_staff.vendor_id
        AND vs.staff_user_id = auth.uid()
        AND vs.role IN ('owner', 'admin')
        AND vs.status = 'active'
    )
    OR
    -- Vendor profile owner
    EXISTS (
      SELECT 1 FROM public.vendor_profile vp
      WHERE vp.id = vendor_staff.vendor_id
        AND vp.user_id = auth.uid()
    )
  )
  WITH CHECK (
    -- Global admin bypass
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_admin = true
    )
    OR
    -- Vendor owner/admin
    EXISTS (
      SELECT 1 FROM public.vendor_staff vs
      WHERE vs.vendor_id = vendor_staff.vendor_id
        AND vs.staff_user_id = auth.uid()
        AND vs.role IN ('owner', 'admin')
        AND vs.status = 'active'
    )
    OR
    -- Vendor profile owner
    EXISTS (
      SELECT 1 FROM public.vendor_profile vp
      WHERE vp.id = vendor_staff.vendor_id
        AND vp.user_id = auth.uid()
    )
  );

-- RLS: Staff members can view their own vendor's staff
DROP POLICY IF EXISTS "Staff members can view own vendor staff" ON public.vendor_staff;
CREATE POLICY "Staff members can view own vendor staff"
  ON public.vendor_staff
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.vendor_staff vs
      WHERE vs.vendor_id = vendor_staff.vendor_id
        AND vs.staff_user_id = auth.uid()
        AND vs.status = 'active'
    )
  );

-- ============================================================
-- 6) Helper functions for staff code generation
-- ============================================================
CREATE OR REPLACE FUNCTION public.compute_initials(p_name text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  words text[];
  initials text := '';
  word text;
BEGIN
  IF p_name IS NULL OR btrim(p_name) = '' THEN
    RETURN 'XX';
  END IF;

  words := regexp_split_to_array(btrim(p_name), '\s+');

  FOREACH word IN ARRAY words LOOP
    IF length(word) > 0 THEN
      initials := initials || upper(left(word, 1));
    END IF;
  END LOOP;

  IF length(initials) < 2 THEN
    initials := initials || 'X';
  END IF;

  RETURN left(initials, 3);
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_vendor_staff_code(p_vendor_id uuid, p_name text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_vendor_code text;
  v_initials text;
  v_base_code text;
  v_candidate text;
  v_suffix int := 1;
BEGIN
  SELECT vendor_public_code INTO v_vendor_code
  FROM public.vendor_profile
  WHERE id = p_vendor_id;

  IF v_vendor_code IS NULL THEN
    RAISE EXCEPTION 'Vendor does not have an assigned vendor_public_code';
  END IF;

  v_initials := public.compute_initials(p_name);
  v_base_code := v_vendor_code || '_' || v_initials;
  v_candidate := v_base_code;

  WHILE EXISTS (SELECT 1 FROM public.vendor_staff WHERE staff_code = v_candidate) LOOP
    v_suffix := v_suffix + 1;
    v_candidate := v_base_code || v_suffix::text;
  END LOOP;

  RETURN v_candidate;
END;
$$;

-- ============================================================
-- 7) Trigger to enforce verified status + code before staff invite
-- ============================================================
CREATE OR REPLACE FUNCTION public.enforce_vendor_has_public_code_for_staff()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text;
  v_status public.vendor_verification_status;
BEGIN
  SELECT vendor_public_code, vendor_verification_status 
  INTO v_code, v_status
  FROM public.vendor_profile
  WHERE id = NEW.vendor_id;

  IF v_code IS NULL THEN
    RAISE EXCEPTION 'Vendor must have a vendor_public_code before inviting staff';
  END IF;

  IF v_status IS NULL OR v_status <> 'verified' THEN
    RAISE EXCEPTION 'Vendor must be verified (status=verified) before inviting staff';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_vendor_code_for_staff ON public.vendor_staff;
CREATE TRIGGER trg_enforce_vendor_code_for_staff
BEFORE INSERT ON public.vendor_staff
FOR EACH ROW
EXECUTE FUNCTION public.enforce_vendor_has_public_code_for_staff();

-- ============================================================
-- 8) Trigger to auto-set staff_code on insert
-- ============================================================
CREATE OR REPLACE FUNCTION public.trigger_set_staff_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.staff_code IS NULL THEN
    NEW.staff_code := public.generate_vendor_staff_code(NEW.vendor_id, NEW.invited_name);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_staff_code ON public.vendor_staff;
CREATE TRIGGER trg_set_staff_code
BEFORE INSERT ON public.vendor_staff
FOR EACH ROW
EXECUTE FUNCTION public.trigger_set_staff_code();

-- ============================================================
-- 9) Add conversation_type to conversations table
-- ============================================================
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS conversation_type text DEFAULT 'direct';

CREATE INDEX IF NOT EXISTS idx_conversations_type ON public.conversations(conversation_type);

-- Backfill existing rows
UPDATE public.conversations
SET conversation_type = 'direct'
WHERE conversation_type IS NULL;

-- ============================================================
-- 10) RPC: check_vendor_code_available (public-facing, no exposure)
-- ============================================================
CREATE OR REPLACE FUNCTION public.check_vendor_code_available(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_normalized text;
  v_is_reserved boolean := false;
  v_is_taken boolean := false;
BEGIN
  IF p_code IS NULL OR btrim(p_code) = '' THEN
    RETURN jsonb_build_object('available', false, 'reason', 'Code is required');
  END IF;

  v_normalized := upper(btrim(p_code));

  IF v_normalized !~ '^[A-Z0-9]{1,6}$' THEN
    RETURN jsonb_build_object('available', false, 'reason', 'Code must be 1-6 characters, A-Z or 0-9 only');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.vendor_code_reservations
    WHERE code = v_normalized
  ) INTO v_is_reserved;

  IF v_is_reserved THEN
    RETURN jsonb_build_object('available', false, 'reason', 'Code is not available');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.vendor_profile
    WHERE vendor_public_code = v_normalized
  ) INTO v_is_taken;

  IF v_is_taken THEN
    RETURN jsonb_build_object('available', false, 'reason', 'Code is already in use');
  END IF;

  RETURN jsonb_build_object('available', true, 'normalized', v_normalized);
END;
$$;

-- ============================================================
-- 11) RPC: admin_assign_vendor_code (admin-only)
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_assign_vendor_code(
  p_vendor_profile_id uuid,
  p_code text,
  p_admin_override boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id uuid := auth.uid();
  v_normalized text;
  v_reservation record;
  v_existing_vendor uuid;
BEGIN
  IF v_admin_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  IF NOT public.is_admin_user(v_admin_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Admin access required');
  END IF;

  IF p_code IS NULL OR btrim(p_code) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Code is required');
  END IF;

  v_normalized := upper(btrim(p_code));

  IF v_normalized !~ '^[A-Z0-9]{1,6}$' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Code must be 1-6 characters, A-Z or 0-9 only');
  END IF;

  SELECT id INTO v_existing_vendor
  FROM public.vendor_profile
  WHERE vendor_public_code = v_normalized
    AND id <> p_vendor_profile_id;

  IF v_existing_vendor IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Code is already assigned to another vendor');
  END IF;

  SELECT * INTO v_reservation
  FROM public.vendor_code_reservations
  WHERE code = v_normalized;

  IF v_reservation IS NOT NULL THEN
    IF v_reservation.reserved_for_vendor_id IS NOT NULL 
       AND v_reservation.reserved_for_vendor_id = p_vendor_profile_id THEN
      NULL;
    ELSIF p_admin_override = true THEN
      NULL;
    ELSE
      RETURN jsonb_build_object(
        'success', false, 
        'error', 'Code is reserved. Use admin_override=true to assign anyway.',
        'reservation_reason', v_reservation.reason
      );
    END IF;
  END IF;

  UPDATE public.vendor_profile
  SET 
    vendor_public_code = v_normalized,
    updated_at = now()
  WHERE id = p_vendor_profile_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Vendor profile not found');
  END IF;

  RETURN jsonb_build_object('success', true, 'assigned_code', v_normalized);
END;
$$;
