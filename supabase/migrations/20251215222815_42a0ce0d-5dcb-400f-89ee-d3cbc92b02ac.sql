-- Create enums for checklist system
CREATE TYPE public.checklist_role AS ENUM ('field_rep', 'vendor', 'both');
CREATE TYPE public.checklist_owner_type AS ENUM ('system', 'vendor');
CREATE TYPE public.checklist_item_status AS ENUM ('pending', 'completed');
CREATE TYPE public.checklist_completed_by AS ENUM ('system', 'user');

-- Create checklist_templates table
CREATE TABLE public.checklist_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  role checklist_role NOT NULL,
  owner_type checklist_owner_type NOT NULL DEFAULT 'system',
  owner_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  is_default BOOLEAN NOT NULL DEFAULT false,
  requires_paid_plan BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create checklist_items table
CREATE TABLE public.checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES public.checklist_templates(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  role checklist_role NOT NULL DEFAULT 'both',
  auto_track_key TEXT,
  is_required BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user_checklist_assignments table
CREATE TABLE public.user_checklist_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES public.checklist_templates(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, template_id)
);

-- Create user_checklist_items table
CREATE TABLE public.user_checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES public.user_checklist_assignments(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.checklist_items(id) ON DELETE CASCADE,
  status checklist_item_status NOT NULL DEFAULT 'pending',
  completed_at TIMESTAMP WITH TIME ZONE,
  completed_by checklist_completed_by,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(assignment_id, item_id)
);

-- Enable RLS on all tables
ALTER TABLE public.checklist_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_checklist_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_checklist_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for checklist_templates
CREATE POLICY "Anyone can view system templates"
ON public.checklist_templates FOR SELECT
USING (owner_type = 'system');

CREATE POLICY "Vendors can view their own templates"
ON public.checklist_templates FOR SELECT
USING (owner_type = 'vendor' AND owner_id = auth.uid());

CREATE POLICY "Users can view templates assigned to them"
ON public.checklist_templates FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_checklist_assignments
    WHERE template_id = checklist_templates.id
    AND user_id = auth.uid()
  )
);

CREATE POLICY "Vendors can create their own templates"
ON public.checklist_templates FOR INSERT
WITH CHECK (owner_type = 'vendor' AND owner_id = auth.uid());

CREATE POLICY "Vendors can update their own templates"
ON public.checklist_templates FOR UPDATE
USING (owner_type = 'vendor' AND owner_id = auth.uid());

CREATE POLICY "Vendors can delete their own templates"
ON public.checklist_templates FOR DELETE
USING (owner_type = 'vendor' AND owner_id = auth.uid());

CREATE POLICY "Admins can manage all templates"
ON public.checklist_templates FOR ALL
USING (is_admin_user(auth.uid()));

-- RLS Policies for checklist_items
CREATE POLICY "Anyone can view items of system templates"
ON public.checklist_items FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.checklist_templates
    WHERE id = checklist_items.template_id
    AND owner_type = 'system'
  )
);

CREATE POLICY "Vendors can view items of their templates"
ON public.checklist_items FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.checklist_templates
    WHERE id = checklist_items.template_id
    AND owner_type = 'vendor'
    AND owner_id = auth.uid()
  )
);

CREATE POLICY "Users can view items of assigned templates"
ON public.checklist_items FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_checklist_assignments ua
    JOIN public.checklist_templates ct ON ct.id = ua.template_id
    WHERE ct.id = checklist_items.template_id
    AND ua.user_id = auth.uid()
  )
);

CREATE POLICY "Vendors can manage items of their templates"
ON public.checklist_items FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.checklist_templates
    WHERE id = checklist_items.template_id
    AND owner_type = 'vendor'
    AND owner_id = auth.uid()
  )
);

CREATE POLICY "Admins can manage all items"
ON public.checklist_items FOR ALL
USING (is_admin_user(auth.uid()));

-- RLS Policies for user_checklist_assignments
CREATE POLICY "Users can view their own assignments"
ON public.user_checklist_assignments FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Vendors can view assignments for their templates"
ON public.user_checklist_assignments FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.checklist_templates
    WHERE id = user_checklist_assignments.template_id
    AND owner_type = 'vendor'
    AND owner_id = auth.uid()
  )
);

CREATE POLICY "Vendors can assign their templates"
ON public.user_checklist_assignments FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.checklist_templates
    WHERE id = template_id
    AND owner_type = 'vendor'
    AND owner_id = auth.uid()
  )
);

CREATE POLICY "Admins can manage all assignments"
ON public.user_checklist_assignments FOR ALL
USING (is_admin_user(auth.uid()));

-- RLS Policies for user_checklist_items
CREATE POLICY "Users can view their own checklist items"
ON public.user_checklist_items FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_checklist_assignments
    WHERE id = user_checklist_items.assignment_id
    AND user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their own checklist items"
ON public.user_checklist_items FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.user_checklist_assignments
    WHERE id = user_checklist_items.assignment_id
    AND user_id = auth.uid()
  )
);

CREATE POLICY "Vendors can view checklist items for their assignments"
ON public.user_checklist_items FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_checklist_assignments ua
    JOIN public.checklist_templates ct ON ct.id = ua.template_id
    WHERE ua.id = user_checklist_items.assignment_id
    AND ct.owner_type = 'vendor'
    AND ct.owner_id = auth.uid()
  )
);

CREATE POLICY "Vendors can update checklist items for their assignments"
ON public.user_checklist_items FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.user_checklist_assignments ua
    JOIN public.checklist_templates ct ON ct.id = ua.template_id
    WHERE ua.id = user_checklist_items.assignment_id
    AND ct.owner_type = 'vendor'
    AND ct.owner_id = auth.uid()
  )
);

CREATE POLICY "Admins can manage all checklist items"
ON public.user_checklist_items FOR ALL
USING (is_admin_user(auth.uid()));

-- Create indexes for performance
CREATE INDEX idx_checklist_items_template ON public.checklist_items(template_id);
CREATE INDEX idx_checklist_items_auto_track ON public.checklist_items(auto_track_key) WHERE auto_track_key IS NOT NULL;
CREATE INDEX idx_user_checklist_assignments_user ON public.user_checklist_assignments(user_id);
CREATE INDEX idx_user_checklist_assignments_template ON public.user_checklist_assignments(template_id);
CREATE INDEX idx_user_checklist_items_assignment ON public.user_checklist_items(assignment_id);
CREATE INDEX idx_user_checklist_items_item ON public.user_checklist_items(item_id);
CREATE INDEX idx_user_checklist_items_status ON public.user_checklist_items(status);

-- Create function to auto-complete checklist items by key
CREATE OR REPLACE FUNCTION public.complete_checklist_item_by_key(p_user_id UUID, p_auto_track_key TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.user_checklist_items uci
  SET 
    status = 'completed',
    completed_at = now(),
    completed_by = 'system',
    updated_at = now()
  FROM public.user_checklist_assignments uca
  JOIN public.checklist_items ci ON ci.id = uci.item_id
  WHERE uci.assignment_id = uca.id
    AND uca.user_id = p_user_id
    AND ci.auto_track_key = p_auto_track_key
    AND uci.status = 'pending';
END;
$$;

-- Create function to assign default checklists to new users
CREATE OR REPLACE FUNCTION public.assign_default_checklists(p_user_id UUID, p_role TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_template RECORD;
  v_assignment_id UUID;
  v_item RECORD;
BEGIN
  -- Find default templates for the role
  FOR v_template IN 
    SELECT id FROM public.checklist_templates 
    WHERE is_default = true 
    AND owner_type = 'system'
    AND (role::text = p_role OR role::text = 'both')
  LOOP
    -- Create assignment
    INSERT INTO public.user_checklist_assignments (user_id, template_id)
    VALUES (p_user_id, v_template.id)
    ON CONFLICT (user_id, template_id) DO NOTHING
    RETURNING id INTO v_assignment_id;
    
    -- If assignment was created, create item records
    IF v_assignment_id IS NOT NULL THEN
      FOR v_item IN
        SELECT id FROM public.checklist_items WHERE template_id = v_template.id
      LOOP
        INSERT INTO public.user_checklist_items (assignment_id, item_id)
        VALUES (v_assignment_id, v_item.id)
        ON CONFLICT (assignment_id, item_id) DO NOTHING;
      END LOOP;
    END IF;
  END LOOP;
END;
$$;

-- Create updated_at trigger
CREATE TRIGGER update_checklist_templates_updated_at
BEFORE UPDATE ON public.checklist_templates
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_checklist_items_updated_at
BEFORE UPDATE ON public.checklist_items
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_checklist_assignments_updated_at
BEFORE UPDATE ON public.user_checklist_assignments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_checklist_items_updated_at
BEFORE UPDATE ON public.user_checklist_items
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();