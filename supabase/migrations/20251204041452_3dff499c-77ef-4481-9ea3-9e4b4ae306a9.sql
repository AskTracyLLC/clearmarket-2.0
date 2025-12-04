-- Support Tickets table
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  subject text NOT NULL,
  category text NOT NULL,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  priority text NOT NULL DEFAULT 'normal',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_admin_reply_at timestamptz,
  last_user_reply_at timestamptz,
  closed_at timestamptz
);

ALTER TABLE public.support_tickets
  ADD CONSTRAINT support_tickets_status_check
  CHECK (status IN ('open', 'in_progress', 'resolved', 'closed'));

ALTER TABLE public.support_tickets
  ADD CONSTRAINT support_tickets_priority_check
  CHECK (priority IN ('normal', 'high'));

COMMENT ON TABLE public.support_tickets IS 'Top-level support issues created by users.';
COMMENT ON COLUMN public.support_tickets.message IS 'Initial message from user (first post in ticket).';

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tickets"
ON public.support_tickets FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own tickets"
ON public.support_tickets FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own open tickets"
ON public.support_tickets FOR UPDATE TO authenticated
USING (auth.uid() = user_id AND status IN ('open','in_progress'))
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all tickets"
ON public.support_tickets FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true
));

CREATE POLICY "Admins can update all tickets"
ON public.support_tickets FOR UPDATE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true
));

CREATE TRIGGER support_tickets_set_updated_at
BEFORE UPDATE ON public.support_tickets
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Support Ticket Messages table
CREATE TABLE IF NOT EXISTS public.support_ticket_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body text NOT NULL,
  is_internal_note boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.support_ticket_messages IS 'Messages and replies within a support ticket.';
COMMENT ON COLUMN public.support_ticket_messages.is_internal_note IS 'If true, visible only to admins.';

ALTER TABLE public.support_ticket_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own ticket messages"
ON public.support_ticket_messages FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.support_tickets t
    WHERE t.id = ticket_id AND t.user_id = auth.uid()
  )
  AND is_internal_note = false
);

CREATE POLICY "Admins can view all ticket messages"
ON public.support_ticket_messages FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true
));

CREATE POLICY "Users can reply on own tickets"
ON public.support_ticket_messages FOR INSERT TO authenticated
WITH CHECK (
  sender_id = auth.uid()
  AND is_internal_note = false
  AND EXISTS (
    SELECT 1 FROM public.support_tickets t
    WHERE t.id = ticket_id AND t.user_id = auth.uid()
      AND t.status IN ('open','in_progress')
  )
);

CREATE POLICY "Admins can reply on any ticket"
ON public.support_ticket_messages FOR INSERT TO authenticated
WITH CHECK (
  sender_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true
  )
);

-- Support Articles table
CREATE TABLE IF NOT EXISTS public.support_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  category text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.support_articles IS 'Help Center / FAQ articles surfaced on /help.';

ALTER TABLE public.support_articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read published articles"
ON public.support_articles FOR SELECT TO public
USING (is_published = true);

CREATE POLICY "Admins can manage articles"
ON public.support_articles FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true
));

CREATE TRIGGER support_articles_set_updated_at
BEFORE UPDATE ON public.support_articles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();