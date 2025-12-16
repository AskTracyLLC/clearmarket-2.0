-- Add auto_assign_on_connect column to checklist_templates
ALTER TABLE public.checklist_templates
ADD COLUMN IF NOT EXISTS auto_assign_on_connect boolean DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN public.checklist_templates.auto_assign_on_connect IS 'When true, this template is automatically assigned to new reps when a vendor connects with them';