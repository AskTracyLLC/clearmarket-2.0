-- Add target_role column to vendor_message_templates to support both vendors and reps
ALTER TABLE public.vendor_message_templates
ADD COLUMN target_role text NOT NULL DEFAULT 'vendor' CHECK (target_role IN ('vendor', 'rep'));

-- Update the column comment
COMMENT ON COLUMN public.vendor_message_templates.target_role IS 'Role this template is intended for: vendor or rep';

-- Rename vendor_id to user_id for clarity (both vendors and reps use this)
ALTER TABLE public.vendor_message_templates
RENAME COLUMN vendor_id TO user_id;

-- Update RLS policies to work for both vendors and reps
DROP POLICY IF EXISTS "Vendors can view their own templates" ON public.vendor_message_templates;
DROP POLICY IF EXISTS "Vendors can create their own templates" ON public.vendor_message_templates;
DROP POLICY IF EXISTS "Vendors can update their own templates" ON public.vendor_message_templates;
DROP POLICY IF EXISTS "Vendors can delete their own templates" ON public.vendor_message_templates;

CREATE POLICY "Users can view their own templates"
ON public.vendor_message_templates
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own templates"
ON public.vendor_message_templates
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own templates"
ON public.vendor_message_templates
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own templates"
ON public.vendor_message_templates
FOR DELETE
USING (auth.uid() = user_id);