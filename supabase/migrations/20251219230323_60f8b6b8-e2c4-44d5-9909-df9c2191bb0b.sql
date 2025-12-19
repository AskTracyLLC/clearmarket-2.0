-- Create a view for broadcast metrics using proper LEFT JOINs
-- This avoids the inner join bug that wipes recipients when no feedback exists

CREATE OR REPLACE VIEW public.admin_broadcast_metrics AS
SELECT 
  b.id AS broadcast_id,
  COUNT(r.id) AS recipients_total,
  COUNT(r.id) FILTER (WHERE r.emailed_at IS NOT NULL) AS emails_sent,
  COUNT(r.id) FILTER (WHERE r.responded_at IS NOT NULL) AS responses,
  AVG(f.rating)::numeric(3,2) AS avg_rating,
  COUNT(f.id) FILTER (WHERE f.allow_spotlight = true) AS spotlight_ready
FROM public.admin_broadcasts b
LEFT JOIN public.admin_broadcast_recipients r ON r.broadcast_id = b.id
LEFT JOIN public.admin_broadcast_feedback f ON f.recipient_id = r.id
GROUP BY b.id;

-- Grant access to authenticated users (admins only via RLS on admin_broadcasts)
GRANT SELECT ON public.admin_broadcast_metrics TO authenticated;