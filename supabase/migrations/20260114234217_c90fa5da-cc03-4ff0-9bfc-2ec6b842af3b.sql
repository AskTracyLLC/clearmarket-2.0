-- Index for NULL-safe lookups and admin reporting on snapshot labels
CREATE INDEX IF NOT EXISTS idx_vendor_activity_events_owner_label_created
  ON public.vendor_activity_events (vendor_owner_label, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_vendor_activity_events_actor_label_created
  ON public.vendor_activity_events (actor_label, created_at DESC);