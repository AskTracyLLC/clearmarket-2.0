-- Shared Vendor Beta Onboarding checklist: Clean up duplicate staff assignments
-- This migration ensures only the vendor owner has the assignment, not individual staff members

DO $$
DECLARE
  v_template uuid := '22222222-2222-2222-2222-222222222222';
BEGIN
  -- 1) Ensure every vendor owner has an assignment for this template
  --    when they have active staff (prevents deleting staff assignment with no owner replacement)
  INSERT INTO public.user_checklist_assignments (user_id, template_id, assigned_at, created_at, updated_at)
  SELECT
    vp.user_id,
    v_template,
    now(),
    now(),
    now()
  FROM public.vendor_staff vs
  JOIN public.vendor_profile vp
    ON vp.id = vs.vendor_id
  WHERE vs.status = 'active'
  AND vp.user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.user_checklist_assignments a
    WHERE a.user_id = vp.user_id
      AND a.template_id = v_template
  );

  -- 2) Delete checklist items for duplicate staff assignments
  DELETE FROM public.user_checklist_items i
  WHERE i.assignment_id IN (
    SELECT a_staff.id
    FROM public.vendor_staff vs
    JOIN public.vendor_profile vp
      ON vp.id = vs.vendor_id
    JOIN public.user_checklist_assignments a_staff
      ON a_staff.user_id = vs.staff_user_id
     AND a_staff.template_id = v_template
    WHERE vs.status = 'active'
      AND vp.user_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.user_checklist_assignments a_owner
        WHERE a_owner.user_id = vp.user_id
          AND a_owner.template_id = v_template
      )
  );

  -- 3) Delete the duplicate staff assignments themselves
  DELETE FROM public.user_checklist_assignments a
  WHERE a.id IN (
    SELECT a_staff.id
    FROM public.vendor_staff vs
    JOIN public.vendor_profile vp
      ON vp.id = vs.vendor_id
    JOIN public.user_checklist_assignments a_staff
      ON a_staff.user_id = vs.staff_user_id
     AND a_staff.template_id = v_template
    WHERE vs.status = 'active'
      AND vp.user_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.user_checklist_assignments a_owner
        WHERE a_owner.user_id = vp.user_id
          AND a_owner.template_id = v_template
      )
  );

END $$;