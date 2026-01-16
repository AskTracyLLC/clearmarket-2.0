-- =====================================================
-- A) VENDOR STAFF NOTES (audience: public/private)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.vendor_staff_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES public.vendor_profile(id) ON DELETE CASCADE,
  staff_user_id uuid NOT NULL,
  created_by uuid NOT NULL,
  audience text NOT NULL DEFAULT 'private' CHECK (audience IN ('public','private')),
  note_type text NULL DEFAULT 'other',
  note text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vendor_staff_notes_vendor_staff 
  ON public.vendor_staff_notes(vendor_id, staff_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vendor_staff_notes_vendor 
  ON public.vendor_staff_notes(vendor_id, created_at DESC);

ALTER TABLE public.vendor_staff_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vendor_staff_notes_select" ON public.vendor_staff_notes;
CREATE POLICY "vendor_staff_notes_select" ON public.vendor_staff_notes
  FOR SELECT TO authenticated
  USING (
    has_vendor_access_by_profile(vendor_id)
    AND (
      audience = 'public'
      OR created_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.vendor_profile vp WHERE vp.id = vendor_id AND vp.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.vendor_staff vs 
        WHERE vs.vendor_id = vendor_staff_notes.vendor_id 
          AND vs.staff_user_id = auth.uid() 
          AND vs.status = 'active' 
          AND vs.role IN ('owner','admin')
      )
    )
  );

DROP POLICY IF EXISTS "vendor_staff_notes_insert" ON public.vendor_staff_notes;
CREATE POLICY "vendor_staff_notes_insert" ON public.vendor_staff_notes
  FOR INSERT TO authenticated
  WITH CHECK (
    has_vendor_access_by_profile(vendor_id)
    AND created_by = auth.uid()
  );

DROP POLICY IF EXISTS "vendor_staff_notes_update" ON public.vendor_staff_notes;
CREATE POLICY "vendor_staff_notes_update" ON public.vendor_staff_notes
  FOR UPDATE TO authenticated
  USING (
    has_vendor_access_by_profile(vendor_id)
    AND (
      created_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.vendor_profile vp WHERE vp.id = vendor_id AND vp.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.vendor_staff vs 
        WHERE vs.vendor_id = vendor_staff_notes.vendor_id 
          AND vs.staff_user_id = auth.uid() 
          AND vs.status = 'active' 
          AND vs.role IN ('owner','admin')
      )
    )
  )
  WITH CHECK (
    has_vendor_access_by_profile(vendor_id)
    AND (
      created_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.vendor_profile vp WHERE vp.id = vendor_id AND vp.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.vendor_staff vs 
        WHERE vs.vendor_id = vendor_staff_notes.vendor_id 
          AND vs.staff_user_id = auth.uid() 
          AND vs.status = 'active' 
          AND vs.role IN ('owner','admin')
      )
    )
  );

DROP POLICY IF EXISTS "vendor_staff_notes_delete" ON public.vendor_staff_notes;
CREATE POLICY "vendor_staff_notes_delete" ON public.vendor_staff_notes
  FOR DELETE TO authenticated
  USING (
    has_vendor_access_by_profile(vendor_id)
    AND (
      created_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.vendor_profile vp WHERE vp.id = vendor_id AND vp.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.vendor_staff vs 
        WHERE vs.vendor_id = vendor_staff_notes.vendor_id 
          AND vs.staff_user_id = auth.uid() 
          AND vs.status = 'active' 
          AND vs.role IN ('owner','admin')
      )
    )
  );

-- =====================================================
-- B) VENDOR REP NOTES
-- =====================================================

CREATE TABLE IF NOT EXISTS public.vendor_rep_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES public.vendor_profile(id) ON DELETE CASCADE,
  rep_user_id uuid NOT NULL,
  created_by uuid NOT NULL,
  note_type text NULL DEFAULT 'general',
  note text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vendor_rep_notes_vendor_rep 
  ON public.vendor_rep_notes(vendor_id, rep_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vendor_rep_notes_vendor 
  ON public.vendor_rep_notes(vendor_id, created_at DESC);

ALTER TABLE public.vendor_rep_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vendor_rep_notes_select" ON public.vendor_rep_notes;
CREATE POLICY "vendor_rep_notes_select" ON public.vendor_rep_notes
  FOR SELECT TO authenticated
  USING (has_vendor_access_by_profile(vendor_id));

DROP POLICY IF EXISTS "vendor_rep_notes_insert" ON public.vendor_rep_notes;
CREATE POLICY "vendor_rep_notes_insert" ON public.vendor_rep_notes
  FOR INSERT TO authenticated
  WITH CHECK (
    has_vendor_access_by_profile(vendor_id)
    AND created_by = auth.uid()
  );

DROP POLICY IF EXISTS "vendor_rep_notes_update" ON public.vendor_rep_notes;
CREATE POLICY "vendor_rep_notes_update" ON public.vendor_rep_notes
  FOR UPDATE TO authenticated
  USING (
    has_vendor_access_by_profile(vendor_id)
    AND (
      created_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.vendor_profile vp WHERE vp.id = vendor_id AND vp.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.vendor_staff vs 
        WHERE vs.vendor_id = vendor_rep_notes.vendor_id 
          AND vs.staff_user_id = auth.uid() 
          AND vs.status = 'active' 
          AND vs.role IN ('owner','admin')
      )
    )
  )
  WITH CHECK (
    has_vendor_access_by_profile(vendor_id)
    AND (
      created_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.vendor_profile vp WHERE vp.id = vendor_id AND vp.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.vendor_staff vs 
        WHERE vs.vendor_id = vendor_rep_notes.vendor_id 
          AND vs.staff_user_id = auth.uid() 
          AND vs.status = 'active' 
          AND vs.role IN ('owner','admin')
      )
    )
  );

DROP POLICY IF EXISTS "vendor_rep_notes_delete" ON public.vendor_rep_notes;
CREATE POLICY "vendor_rep_notes_delete" ON public.vendor_rep_notes
  FOR DELETE TO authenticated
  USING (
    has_vendor_access_by_profile(vendor_id)
    AND (
      created_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.vendor_profile vp WHERE vp.id = vendor_id AND vp.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.vendor_staff vs 
        WHERE vs.vendor_id = vendor_rep_notes.vendor_id 
          AND vs.staff_user_id = auth.uid() 
          AND vs.status = 'active' 
          AND vs.role IN ('owner','admin')
      )
    )
  );

-- =====================================================
-- C) EXTEND vendor_offline_rep_contacts for blocked reps
-- =====================================================

ALTER TABLE public.vendor_offline_rep_contacts 
  ADD COLUMN IF NOT EXISTS first_name text NULL,
  ADD COLUMN IF NOT EXISTS last_name text NULL,
  ADD COLUMN IF NOT EXISTS emails text[] NULL,
  ADD COLUMN IF NOT EXISTS phones text[] NULL,
  ADD COLUMN IF NOT EXISTS aliases text[] NULL,
  ADD COLUMN IF NOT EXISTS rep_user_id uuid NULL,
  ADD COLUMN IF NOT EXISTS created_by uuid NULL;

-- Ensure RLS is enabled
ALTER TABLE public.vendor_offline_rep_contacts ENABLE ROW LEVEL SECURITY;

-- Confirm/add vendor-scoped policies
DROP POLICY IF EXISTS "vendor_offline_rep_contacts_select" ON public.vendor_offline_rep_contacts;
CREATE POLICY "vendor_offline_rep_contacts_select" ON public.vendor_offline_rep_contacts
  FOR SELECT TO authenticated
  USING (has_vendor_access_by_owner(vendor_id));

DROP POLICY IF EXISTS "vendor_offline_rep_contacts_insert" ON public.vendor_offline_rep_contacts;
CREATE POLICY "vendor_offline_rep_contacts_insert" ON public.vendor_offline_rep_contacts
  FOR INSERT TO authenticated
  WITH CHECK (has_vendor_access_by_owner(vendor_id));

DROP POLICY IF EXISTS "vendor_offline_rep_contacts_update" ON public.vendor_offline_rep_contacts;
CREATE POLICY "vendor_offline_rep_contacts_update" ON public.vendor_offline_rep_contacts
  FOR UPDATE TO authenticated
  USING (has_vendor_access_by_owner(vendor_id))
  WITH CHECK (has_vendor_access_by_owner(vendor_id));

DROP POLICY IF EXISTS "vendor_offline_rep_contacts_delete" ON public.vendor_offline_rep_contacts;
CREATE POLICY "vendor_offline_rep_contacts_delete" ON public.vendor_offline_rep_contacts
  FOR DELETE TO authenticated
  USING (has_vendor_access_by_owner(vendor_id));

-- =====================================================
-- D) USER UI PREFERENCES (pinned sidebar persistence)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.user_ui_preferences (
  user_id uuid PRIMARY KEY,
  pinned_sidebar jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_ui_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_ui_preferences_select" ON public.user_ui_preferences;
CREATE POLICY "user_ui_preferences_select" ON public.user_ui_preferences
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "user_ui_preferences_insert" ON public.user_ui_preferences;
CREATE POLICY "user_ui_preferences_insert" ON public.user_ui_preferences
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "user_ui_preferences_update" ON public.user_ui_preferences;
CREATE POLICY "user_ui_preferences_update" ON public.user_ui_preferences
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- =====================================================
-- E) UPDATED_AT TRIGGERS
-- =====================================================

DROP TRIGGER IF EXISTS update_vendor_staff_notes_updated_at ON public.vendor_staff_notes;
CREATE TRIGGER update_vendor_staff_notes_updated_at
  BEFORE UPDATE ON public.vendor_staff_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_vendor_rep_notes_updated_at ON public.vendor_rep_notes;
CREATE TRIGGER update_vendor_rep_notes_updated_at
  BEFORE UPDATE ON public.vendor_rep_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_ui_preferences_updated_at ON public.user_ui_preferences;
CREATE TRIGGER update_user_ui_preferences_updated_at
  BEFORE UPDATE ON public.user_ui_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();