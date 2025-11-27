-- Add pricing fields to seeking_coverage_posts
-- These fields represent what the vendor is offering to pay the rep per completed inspection

ALTER TABLE public.seeking_coverage_posts
ADD COLUMN IF NOT EXISTS pay_type text CHECK (pay_type IN ('fixed', 'range')) DEFAULT 'fixed',
ADD COLUMN IF NOT EXISTS pay_min numeric(10,2),
ADD COLUMN IF NOT EXISTS pay_max numeric(10,2),
ADD COLUMN IF NOT EXISTS pay_notes text;

COMMENT ON COLUMN public.seeking_coverage_posts.pay_type IS 'Payment structure: fixed = single rate (use pay_min only), range = min-max range (use both pay_min and pay_max)';
COMMENT ON COLUMN public.seeking_coverage_posts.pay_min IS 'Vendor offered rate per completed inspection (USD). If pay_type=fixed, this is the exact rate. If pay_type=range, this is the minimum.';
COMMENT ON COLUMN public.seeking_coverage_posts.pay_max IS 'Maximum offered rate per inspection (USD). Only used when pay_type=range. Must be >= pay_min.';
COMMENT ON COLUMN public.seeking_coverage_posts.pay_notes IS 'Optional context about pricing, e.g., "higher for remote/rural", "bonus for rush"';

-- Note: rep_coverage_areas already has base_price and rush_price columns for rep minimum rates
-- base_price = minimum amount rep will accept per order in that county
-- rush_price = optional higher amount for rush work