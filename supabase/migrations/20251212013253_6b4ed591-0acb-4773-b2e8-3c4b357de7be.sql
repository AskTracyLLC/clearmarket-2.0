-- Add not_interested_reason column for rep-side "Not interested" action
ALTER TABLE public.rep_interest 
ADD COLUMN IF NOT EXISTS not_interested_reason text;

-- Add comment for clarity
COMMENT ON COLUMN public.rep_interest.not_interested_reason IS 'Optional reason when rep marks themselves as not interested in a post';