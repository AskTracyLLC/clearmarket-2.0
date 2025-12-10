-- Add open_to_new_systems boolean to rep_profile
ALTER TABLE public.rep_profile
ADD COLUMN open_to_new_systems boolean NOT NULL DEFAULT false;