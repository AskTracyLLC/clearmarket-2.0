-- 1) Make FK columns nullable
ALTER TABLE public.vendor_activity_events
  ALTER COLUMN vendor_owner_user_id DROP NOT NULL,
  ALTER COLUMN actor_user_id DROP NOT NULL;

-- 2) Replace FKs with ON DELETE SET NULL
ALTER TABLE public.vendor_activity_events
  DROP CONSTRAINT IF EXISTS vendor_activity_events_vendor_owner_fkey;

ALTER TABLE public.vendor_activity_events
  DROP CONSTRAINT IF EXISTS vendor_activity_events_actor_fkey;

ALTER TABLE public.vendor_activity_events
  ADD CONSTRAINT vendor_activity_events_vendor_owner_fkey
  FOREIGN KEY (vendor_owner_user_id) REFERENCES public.profiles(id)
  ON DELETE SET NULL;

ALTER TABLE public.vendor_activity_events
  ADD CONSTRAINT vendor_activity_events_actor_fkey
  FOREIGN KEY (actor_user_id) REFERENCES public.profiles(id)
  ON DELETE SET NULL;

-- 3) Add snapshot columns to preserve identity after deletion
ALTER TABLE public.vendor_activity_events
  ADD COLUMN IF NOT EXISTS vendor_owner_label text NULL,
  ADD COLUMN IF NOT EXISTS actor_label text NULL;