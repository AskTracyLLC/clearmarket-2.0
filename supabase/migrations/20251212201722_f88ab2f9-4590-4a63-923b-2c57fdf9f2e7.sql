-- 1. Add new columns to vendor_alerts for scheduled planned routes
ALTER TABLE public.vendor_alerts
ADD COLUMN IF NOT EXISTS route_date DATE,
ADD COLUMN IF NOT EXISTS route_state TEXT,
ADD COLUMN IF NOT EXISTS route_counties TEXT[],
ADD COLUMN IF NOT EXISTS is_scheduled BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS scheduled_status TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS sent_at TIMESTAMP WITH TIME ZONE;

-- Add check constraint for scheduled_status
ALTER TABLE public.vendor_alerts
ADD CONSTRAINT vendor_alerts_scheduled_status_check
CHECK (scheduled_status IS NULL OR scheduled_status IN ('pending_confirmation', 'confirmed_sent', 'canceled', 'expired'));

-- 2. Create vendor_alert_kudos table for thumbs-up feedback
CREATE TABLE public.vendor_alert_kudos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  alert_id UUID NOT NULL REFERENCES public.vendor_alerts(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rep_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(alert_id, vendor_id)
);

-- Enable RLS
ALTER TABLE public.vendor_alert_kudos ENABLE ROW LEVEL SECURITY;

-- RLS policies for vendor_alert_kudos
CREATE POLICY "Vendors can insert kudos for alerts they received"
ON public.vendor_alert_kudos
FOR INSERT
WITH CHECK (
  auth.uid() = vendor_id
  AND EXISTS (
    SELECT 1 FROM public.vendor_alerts
    WHERE id = alert_id
    AND (
      vendor_id = ANY(recipient_vendor_ids)
      OR rep_user_id != vendor_id
    )
  )
);

CREATE POLICY "Vendors can view their own kudos"
ON public.vendor_alert_kudos
FOR SELECT
USING (auth.uid() = vendor_id);

CREATE POLICY "Reps can view kudos they received"
ON public.vendor_alert_kudos
FOR SELECT
USING (auth.uid() = rep_id);

CREATE POLICY "Staff can view all kudos"
ON public.vendor_alert_kudos
FOR SELECT
USING (is_staff_user(auth.uid()));

-- Allow vendors to delete their own kudos (for undo)
CREATE POLICY "Vendors can delete their own kudos"
ON public.vendor_alert_kudos
FOR DELETE
USING (auth.uid() = vendor_id);

-- Create index for performance
CREATE INDEX idx_vendor_alert_kudos_rep_id ON public.vendor_alert_kudos(rep_id);
CREATE INDEX idx_vendor_alert_kudos_alert_id ON public.vendor_alert_kudos(alert_id);

-- Index on vendor_alerts for scheduled route queries
CREATE INDEX idx_vendor_alerts_scheduled ON public.vendor_alerts(rep_user_id, route_date, scheduled_status)
WHERE is_scheduled = true;