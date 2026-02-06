-- Allow 'declined' as a valid support queue status (and keep legacy 'cancelled')
ALTER TABLE public.support_queue_items
  DROP CONSTRAINT IF EXISTS support_queue_items_status_check;

ALTER TABLE public.support_queue_items
  ADD CONSTRAINT support_queue_items_status_check
  CHECK (
    status = ANY (
      ARRAY[
        'open'::text,
        'in_progress'::text,
        'waiting'::text,
        'resolved'::text,
        'declined'::text,
        'cancelled'::text
      ]
    )
  );
