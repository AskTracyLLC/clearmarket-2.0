-- Create rep_network_alerts table for vendor → rep broadcast alerts
CREATE TABLE IF NOT EXISTS public.rep_network_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  send_mode text NOT NULL DEFAULT 'now',
  scheduled_at timestamptz,
  target_scope text NOT NULL DEFAULT 'all_connected',
  target_state_codes text[],
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  error_message text,
  recipient_count integer,
  CONSTRAINT rep_network_alerts_send_mode_check CHECK (send_mode IN ('now', 'scheduled')),
  CONSTRAINT rep_network_alerts_status_check CHECK (status IN ('pending', 'scheduled', 'sending', 'sent', 'cancelled', 'failed')),
  CONSTRAINT rep_network_alerts_target_scope_check CHECK (target_scope IN ('all_connected', 'by_state'))
);

COMMENT ON TABLE public.rep_network_alerts IS
  'Broadcast alerts vendors send to their connected field rep network.';

COMMENT ON COLUMN public.rep_network_alerts.send_mode IS
  'now = send immediately, scheduled = send at scheduled_at time';

COMMENT ON COLUMN public.rep_network_alerts.target_scope IS
  'all_connected = all reps, by_state = filter by target_state_codes';

COMMENT ON COLUMN public.rep_network_alerts.status IS
  'pending = ready to send, scheduled = waiting for scheduled time, sending = in progress, sent = completed, cancelled = user cancelled, failed = error occurred';

-- Enable RLS
ALTER TABLE public.rep_network_alerts ENABLE ROW LEVEL SECURITY;

-- RLS: Vendor can view own alerts
CREATE POLICY "Vendor can view own alerts"
ON public.rep_network_alerts
FOR SELECT
TO authenticated
USING (auth.uid() = vendor_id);

-- RLS: Vendor can create own alerts
CREATE POLICY "Vendor can create own alerts"
ON public.rep_network_alerts
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = vendor_id);

-- RLS: Vendor can update own alerts (only pending/scheduled, not sent)
CREATE POLICY "Vendor can update own pending alerts"
ON public.rep_network_alerts
FOR UPDATE
TO authenticated
USING (auth.uid() = vendor_id AND status IN ('pending', 'scheduled'))
WITH CHECK (auth.uid() = vendor_id);

-- RLS: Admins have full access
CREATE POLICY "Admins can manage all rep network alerts"
ON public.rep_network_alerts
FOR ALL
TO authenticated
USING (public.is_admin_user(auth.uid()))
WITH CHECK (public.is_admin_user(auth.uid()));

-- Create index for faster lookups
CREATE INDEX idx_rep_network_alerts_vendor_created 
ON public.rep_network_alerts(vendor_id, created_at DESC);

-- Create index for scheduled alerts processing
CREATE INDEX idx_rep_network_alerts_scheduled_status 
ON public.rep_network_alerts(status, scheduled_at) 
WHERE status = 'scheduled';