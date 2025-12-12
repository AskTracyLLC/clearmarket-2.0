-- Add effective_date and work_type to vendor_rep_agreements
ALTER TABLE public.vendor_rep_agreements 
ADD COLUMN effective_date date,
ADD COLUMN work_type text,
ADD COLUMN source_seeking_coverage_post_id uuid REFERENCES public.seeking_coverage_posts(id);

-- Add filled_at column to seeking_coverage_posts for tracking when filled
ALTER TABLE public.seeking_coverage_posts
ADD COLUMN filled_at timestamp with time zone;