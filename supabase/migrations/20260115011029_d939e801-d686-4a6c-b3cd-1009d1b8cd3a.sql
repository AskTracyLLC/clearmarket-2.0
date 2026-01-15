-- Fix FK constraints on auth.users to use SET NULL instead of NO ACTION
-- This allows user deletion without blocking

-- vendor_profile.verified_by
ALTER TABLE public.vendor_profile
  DROP CONSTRAINT IF EXISTS vendor_profile_verified_by_fkey;

ALTER TABLE public.vendor_profile
  ADD CONSTRAINT vendor_profile_verified_by_fkey
  FOREIGN KEY (verified_by) REFERENCES auth.users(id)
  ON DELETE SET NULL;

-- admin_users.created_by (make nullable first if needed)
ALTER TABLE public.admin_users
  ALTER COLUMN created_by DROP NOT NULL;

ALTER TABLE public.admin_users
  DROP CONSTRAINT IF EXISTS admin_users_created_by_fkey;

ALTER TABLE public.admin_users
  ADD CONSTRAINT admin_users_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id)
  ON DELETE SET NULL;

-- staff_users.created_by
ALTER TABLE public.staff_users
  ALTER COLUMN created_by DROP NOT NULL;

ALTER TABLE public.staff_users
  DROP CONSTRAINT IF EXISTS staff_users_created_by_fkey;

ALTER TABLE public.staff_users
  ADD CONSTRAINT staff_users_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id)
  ON DELETE SET NULL;

-- rep_contact_access_log.actor_user_id
ALTER TABLE public.rep_contact_access_log
  DROP CONSTRAINT IF EXISTS rep_contact_access_log_actor_user_id_fkey;

ALTER TABLE public.rep_contact_access_log
  ADD CONSTRAINT rep_contact_access_log_actor_user_id_fkey
  FOREIGN KEY (actor_user_id) REFERENCES auth.users(id)
  ON DELETE SET NULL;

-- vendor_code_reservations.created_by
ALTER TABLE public.vendor_code_reservations
  ALTER COLUMN created_by DROP NOT NULL;

ALTER TABLE public.vendor_code_reservations
  DROP CONSTRAINT IF EXISTS vendor_code_reservations_created_by_fkey;

ALTER TABLE public.vendor_code_reservations
  ADD CONSTRAINT vendor_code_reservations_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id)
  ON DELETE SET NULL;

-- vendor_staff.invited_by (already nullable, just fix the constraint)
ALTER TABLE public.vendor_staff
  DROP CONSTRAINT IF EXISTS vendor_staff_invited_by_fkey;

ALTER TABLE public.vendor_staff
  ADD CONSTRAINT vendor_staff_invited_by_fkey
  FOREIGN KEY (invited_by) REFERENCES auth.users(id)
  ON DELETE SET NULL;