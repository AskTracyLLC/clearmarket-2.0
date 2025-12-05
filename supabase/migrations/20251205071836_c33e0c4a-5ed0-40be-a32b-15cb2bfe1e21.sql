-- Create vendor_office_hours table for recurring weekly hours
CREATE TABLE public.vendor_office_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  weekday int NOT NULL CHECK (weekday >= 0 AND weekday <= 6),
  open_time time without time zone,
  close_time time without time zone,
  timezone text NOT NULL DEFAULT 'America/Chicago',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(vendor_id, weekday)
);

-- Create vendor_calendar_events table for specific dates
CREATE TABLE public.vendor_calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  event_date date NOT NULL,
  event_type text NOT NULL CHECK (event_type IN ('office_closed', 'pay_day', 'note')),
  title text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on both tables
ALTER TABLE public.vendor_office_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_calendar_events ENABLE ROW LEVEL SECURITY;

-- RLS for vendor_office_hours
CREATE POLICY "Vendors can manage their own office hours"
ON public.vendor_office_hours
FOR ALL
USING (auth.uid() = vendor_id)
WITH CHECK (auth.uid() = vendor_id);

CREATE POLICY "Admins can manage all office hours"
ON public.vendor_office_hours
FOR ALL
USING (is_admin_user(auth.uid()))
WITH CHECK (is_admin_user(auth.uid()));

CREATE POLICY "Connected reps can view vendor office hours"
ON public.vendor_office_hours
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM vendor_connections vc
    WHERE vc.vendor_id = vendor_office_hours.vendor_id
    AND vc.field_rep_id = auth.uid()
    AND vc.status = 'connected'
  )
);

-- RLS for vendor_calendar_events
CREATE POLICY "Vendors can manage their own calendar events"
ON public.vendor_calendar_events
FOR ALL
USING (auth.uid() = vendor_id)
WITH CHECK (auth.uid() = vendor_id);

CREATE POLICY "Admins can manage all calendar events"
ON public.vendor_calendar_events
FOR ALL
USING (is_admin_user(auth.uid()))
WITH CHECK (is_admin_user(auth.uid()));

CREATE POLICY "Connected reps can view vendor calendar events"
ON public.vendor_calendar_events
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM vendor_connections vc
    WHERE vc.vendor_id = vendor_calendar_events.vendor_id
    AND vc.field_rep_id = auth.uid()
    AND vc.status = 'connected'
  )
);

-- Update triggers for updated_at
CREATE TRIGGER update_vendor_office_hours_updated_at
BEFORE UPDATE ON public.vendor_office_hours
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_vendor_calendar_events_updated_at
BEFORE UPDATE ON public.vendor_calendar_events
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();