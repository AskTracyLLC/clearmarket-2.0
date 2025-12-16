-- Cleanup: Remove misassigned checklist assignments
-- Field Rep Beta Onboarding should only have Field Reps
-- Vendor Beta Onboarding should only have Vendors

-- First, delete user_checklist_items for Field Rep template assigned to non-field-reps
DELETE FROM public.user_checklist_items
WHERE assignment_id IN (
  SELECT uca.id 
  FROM public.user_checklist_assignments uca
  JOIN public.checklist_templates ct ON ct.id = uca.template_id
  JOIN public.profiles p ON p.id = uca.user_id
  WHERE ct.name = 'Field Rep Beta Onboarding'
    AND ct.owner_type = 'system'
    AND p.is_fieldrep = false
);

-- Then delete the assignments themselves
DELETE FROM public.user_checklist_assignments
WHERE id IN (
  SELECT uca.id 
  FROM public.user_checklist_assignments uca
  JOIN public.checklist_templates ct ON ct.id = uca.template_id
  JOIN public.profiles p ON p.id = uca.user_id
  WHERE ct.name = 'Field Rep Beta Onboarding'
    AND ct.owner_type = 'system'
    AND p.is_fieldrep = false
);

-- Delete user_checklist_items for Vendor template assigned to non-vendors
DELETE FROM public.user_checklist_items
WHERE assignment_id IN (
  SELECT uca.id 
  FROM public.user_checklist_assignments uca
  JOIN public.checklist_templates ct ON ct.id = uca.template_id
  JOIN public.profiles p ON p.id = uca.user_id
  WHERE ct.name = 'Vendor Beta Onboarding'
    AND ct.owner_type = 'system'
    AND p.is_vendor_admin = false
);

-- Then delete the assignments themselves
DELETE FROM public.user_checklist_assignments
WHERE id IN (
  SELECT uca.id 
  FROM public.user_checklist_assignments uca
  JOIN public.checklist_templates ct ON ct.id = uca.template_id
  JOIN public.profiles p ON p.id = uca.user_id
  WHERE ct.name = 'Vendor Beta Onboarding'
    AND ct.owner_type = 'system'
    AND p.is_vendor_admin = false
);