-- Drop existing policies that cause infinite recursion on checklist_templates
DROP POLICY IF EXISTS "Admins can manage all templates" ON public.checklist_templates;
DROP POLICY IF EXISTS "Anyone can view system templates" ON public.checklist_templates;
DROP POLICY IF EXISTS "Users can view templates assigned to them" ON public.checklist_templates;
DROP POLICY IF EXISTS "Vendors can create their own templates" ON public.checklist_templates;
DROP POLICY IF EXISTS "Vendors can delete their own templates" ON public.checklist_templates;
DROP POLICY IF EXISTS "Vendors can update their own templates" ON public.checklist_templates;
DROP POLICY IF EXISTS "Vendors can view their own templates" ON public.checklist_templates;

-- Create non-recursive policies for checklist_templates

-- Allow anyone authenticated to view system templates (no self-reference)
CREATE POLICY "Anyone can view system templates"
ON public.checklist_templates
FOR SELECT
USING (owner_type = 'system');

-- Allow staff/admins to manage all templates using is_admin_user function
CREATE POLICY "Staff can manage all templates"
ON public.checklist_templates
FOR ALL
USING (is_admin_user(auth.uid()))
WITH CHECK (is_admin_user(auth.uid()));

-- Allow vendors to view their own templates
CREATE POLICY "Vendors can view own templates"
ON public.checklist_templates
FOR SELECT
USING (owner_type = 'vendor' AND owner_id = auth.uid());

-- Allow vendors to create their own templates
CREATE POLICY "Vendors can create own templates"
ON public.checklist_templates
FOR INSERT
WITH CHECK (owner_type = 'vendor' AND owner_id = auth.uid());

-- Allow vendors to update their own templates
CREATE POLICY "Vendors can update own templates"
ON public.checklist_templates
FOR UPDATE
USING (owner_type = 'vendor' AND owner_id = auth.uid())
WITH CHECK (owner_type = 'vendor' AND owner_id = auth.uid());

-- Allow vendors to delete their own templates
CREATE POLICY "Vendors can delete own templates"
ON public.checklist_templates
FOR DELETE
USING (owner_type = 'vendor' AND owner_id = auth.uid());