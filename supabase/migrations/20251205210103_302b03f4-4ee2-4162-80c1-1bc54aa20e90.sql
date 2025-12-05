-- Add recurrence columns to vendor_calendar_events
ALTER TABLE public.vendor_calendar_events
ADD COLUMN IF NOT EXISTS is_recurring boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS recurrence_type text,
ADD COLUMN IF NOT EXISTS recurrence_until date;

-- Add comments
COMMENT ON COLUMN public.vendor_calendar_events.is_recurring IS 'True if this event represents a recurring series (currently used for Pay Day events).';
COMMENT ON COLUMN public.vendor_calendar_events.recurrence_type IS 'Recurrence pattern for payday: weekly, biweekly, monthly_date.';
COMMENT ON COLUMN public.vendor_calendar_events.recurrence_until IS 'Optional end date for this recurrence series. NULL means open-ended.';

-- Add check constraint for valid recurrence types
ALTER TABLE public.vendor_calendar_events
ADD CONSTRAINT valid_recurrence_type CHECK (
  recurrence_type IS NULL OR recurrence_type IN ('weekly', 'biweekly', 'monthly_date')
);