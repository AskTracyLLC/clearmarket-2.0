-- Add decline tracking fields to rep_interest table
ALTER TABLE public.rep_interest 
ADD COLUMN IF NOT EXISTS declined_reason text,
ADD COLUMN IF NOT EXISTS declined_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS declined_by_user_id uuid REFERENCES public.profiles(id);

-- Add index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_rep_interest_status ON public.rep_interest(status);
CREATE INDEX IF NOT EXISTS idx_rep_interest_declined_at ON public.rep_interest(declined_at) WHERE declined_at IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.rep_interest.declined_reason IS 'Optional reason provided by vendor when declining a rep for this specific post';
COMMENT ON COLUMN public.rep_interest.declined_at IS 'Timestamp when vendor declined this rep for this specific post';
COMMENT ON COLUMN public.rep_interest.declined_by_user_id IS 'User ID of the vendor who declined this rep';