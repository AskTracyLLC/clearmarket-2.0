-- Add region and inspection type context columns to reviews table
ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS state_code text,
  ADD COLUMN IF NOT EXISTS county_name text,
  ADD COLUMN IF NOT EXISTS zip_code text,
  ADD COLUMN IF NOT EXISTS inspection_category text,
  ADD COLUMN IF NOT EXISTS inspection_type_id uuid;

-- Add foreign key for inspection_type_id (nullable, references inspection_type_options)
-- Note: Using DO block to avoid error if constraint already exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'reviews_inspection_type_id_fkey'
  ) THEN
    ALTER TABLE public.reviews 
      ADD CONSTRAINT reviews_inspection_type_id_fkey 
      FOREIGN KEY (inspection_type_id) 
      REFERENCES public.inspection_type_options(id) 
      ON DELETE SET NULL;
  END IF;
END $$;

-- Create index for efficient grouping queries
CREATE INDEX IF NOT EXISTS idx_reviews_state_code ON public.reviews(state_code);
CREATE INDEX IF NOT EXISTS idx_reviews_inspection_type_id ON public.reviews(inspection_type_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewee_state ON public.reviews(reviewee_id, state_code);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewee_inspection ON public.reviews(reviewee_id, inspection_type_id);

-- Comment for documentation
COMMENT ON COLUMN public.reviews.state_code IS 'US state code (e.g., WI, IL) where the reviewed work was performed';
COMMENT ON COLUMN public.reviews.county_name IS 'County name where the reviewed work was performed';
COMMENT ON COLUMN public.reviews.zip_code IS 'ZIP code for granular location tracking (optional)';
COMMENT ON COLUMN public.reviews.inspection_category IS 'High-level category: Property Inspections, Loss / Insurance Claims, Commercial, Other';
COMMENT ON COLUMN public.reviews.inspection_type_id IS 'Reference to the detailed inspection type option';