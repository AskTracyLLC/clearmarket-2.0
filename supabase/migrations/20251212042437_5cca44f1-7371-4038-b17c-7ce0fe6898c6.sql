-- Add enable/disable toggle for review waiting period
ALTER TABLE public.review_settings 
ADD COLUMN IF NOT EXISTS enforce_waiting_period boolean NOT NULL DEFAULT true;

-- Update the existing row to have the default value
UPDATE public.review_settings SET enforce_waiting_period = true WHERE enforce_waiting_period IS NULL;