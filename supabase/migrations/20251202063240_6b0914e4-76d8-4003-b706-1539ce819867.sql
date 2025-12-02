-- Create rep_availability table for time-off/availability tracking
CREATE TABLE IF NOT EXISTS public.rep_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rep_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date NOT NULL,
  reason text,
  auto_reply_enabled boolean NOT NULL DEFAULT false,
  auto_reply_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.rep_availability IS
  'Field rep availability / time-off ranges (used for vendor alerts and auto-replies).';

COMMENT ON COLUMN public.rep_availability.rep_user_id IS
  'The field rep who owns this availability entry.';

COMMENT ON COLUMN public.rep_availability.start_date IS
  'Start date of unavailability period (inclusive).';

COMMENT ON COLUMN public.rep_availability.end_date IS
  'End date of unavailability period (inclusive).';

COMMENT ON COLUMN public.rep_availability.reason IS
  'Optional explanation for time off (vacation, emergency, etc).';

COMMENT ON COLUMN public.rep_availability.auto_reply_enabled IS
  'Whether to send auto-reply messages during this period.';

COMMENT ON COLUMN public.rep_availability.auto_reply_message IS
  'Custom auto-reply message to send when unavailable.';

-- Enable RLS
ALTER TABLE public.rep_availability ENABLE ROW LEVEL SECURITY;

-- RLS: Rep can manage own availability
CREATE POLICY "Rep can manage own availability"
ON public.rep_availability
FOR ALL
TO authenticated
USING (auth.uid() = rep_user_id)
WITH CHECK (auth.uid() = rep_user_id);

-- Create vendor_alerts table for broadcast alert logging
CREATE TABLE IF NOT EXISTS public.vendor_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rep_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  alert_type text NOT NULL,
  message text NOT NULL,
  affected_start_date date,
  affected_end_date date,
  recipient_vendor_ids uuid[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.vendor_alerts IS
  'Log of broadcast alerts reps send to their vendor network.';

COMMENT ON COLUMN public.vendor_alerts.alert_type IS
  'Type of alert: availability, emergency, time_off_start, etc.';

COMMENT ON COLUMN public.vendor_alerts.message IS
  'The alert message sent to vendors.';

COMMENT ON COLUMN public.vendor_alerts.affected_start_date IS
  'Optional start date for time-off alerts.';

COMMENT ON COLUMN public.vendor_alerts.affected_end_date IS
  'Optional end date for time-off alerts.';

COMMENT ON COLUMN public.vendor_alerts.recipient_vendor_ids IS
  'Array of vendor user IDs who received this alert.';

-- Enable RLS
ALTER TABLE public.vendor_alerts ENABLE ROW LEVEL SECURITY;

-- RLS: Rep can see own alerts
CREATE POLICY "Rep can see own alerts"
ON public.vendor_alerts
FOR SELECT
TO authenticated
USING (auth.uid() = rep_user_id);

-- RLS: Rep can insert own alerts
CREATE POLICY "Rep can insert own alerts"
ON public.vendor_alerts
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = rep_user_id);

-- Create index for faster availability lookups
CREATE INDEX idx_rep_availability_rep_dates 
ON public.rep_availability(rep_user_id, start_date, end_date);

-- Create index for vendor alert lookups
CREATE INDEX idx_vendor_alerts_rep_created 
ON public.vendor_alerts(rep_user_id, created_at DESC);